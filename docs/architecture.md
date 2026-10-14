# NetSplit System Architecture

## 1. Architectural Philosophy & Overview

NetSplit is an enterprise-grade Windows 11 utility designed to bind individual applications, games, and background services to specific physical or virtual network adapters without altering target executables or modifying global Windows default routing tables.

### Layered Separation of Responsibilities
```
+-------------------------------------------------------------------------------+
|                       React Native Windows Desktop UI                         |
|                   (Standard Medium-Integrity User Process)                    |
|                                                                               |
|  [Overview] [Applications] [Adapters] [Routing Rules] [Activity] [Settings]   |
|                                      |                                        |
|                     Zustand Store / Typed JSON-RPC Client                     |
+--------------------------------------|----------------------------------------+
                                       | Authenticated JSON-RPC 2.0
                                       | ws:// / http://127.0.0.1:48192
                                       v
+-------------------------------------------------------------------------------+
|                       NetSplit Native Windows Service                         |
|                (NT AUTHORITY\SYSTEM or Service Account - High IL)             |
|                                                                               |
|  +------------------------+  +------------------------+  +------------------+ |
|  | IPC Authenticator      |  | Assignment Manager     |  | Process Discovery| |
|  | (256-bit token DACL)   |  | (Exclusive, JSON Store)|  | & Metadata Cache | |
|  +------------------------+  +------------------------+  +------------------+ |
|                                      |                                        |
|  +--------------------------------------------------------------------------+ |
|  |                    NetSplit Routing Engine Subsystem                     | |
|  |                                                                          | |
|  |  [Adapter Manager]        [WFP ALE Filter Manager]  [Redirect Broker]    | |
|  |  (GetAdaptersAddresses,   (FwpmFilterAdd0,          (IP_UNICAST_IF       | |
|  |   NotifyIpInterfaceChange) DYNAMIC Session)          bound socket proxy) | |
|  +--------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------+
```

---

## 2. Privileged Windows Service Subsystem

The Windows Service daemon (`native/windows-service/NetSplitService.exe`) executes as a privileged Windows service (`NT AUTHORITY\SYSTEM` or a dedicated service account with `SeNetworkConfigurationPrivilege`).

### Core Service Components

1. **Adapter Manager (`adapter_manager.cpp`):**
   - Discovers all physical, virtual, Wi-Fi, Ethernet, and cellular adapters using `GetAdaptersAddresses` (`GAA_FLAG_INCLUDE_PREFIX | GAA_FLAG_INCLUDE_GATEWAYS`).
   - Hooks real-time interface arrival and departure events via `NotifyIpInterfaceChange`.
   - Extracts friendly names, descriptions, hardware MAC addresses, link speeds, IPv4/IPv6 unicast addresses, and default gateway status via `GetBestRoute`.
2. **Application Discovery & Identity (`app_discovery.cpp`):**
   - Continuously monitors active running processes using `CreateToolhelp32Snapshot` and `QueryFullProcessImageNameW`.
   - Resolves installed applications from 64-bit and 32-bit Windows Registry Uninstall hives (`HKLM` and `HKCU`).
   - Normalizes executable paths (converts to lowercase, resolves canonical slashes) and derives a stable 64-bit FNV-1a hash application ID (`app-<hash>`).
   - Extracts product names, company names, and versions using `GetFileVersionInfoW`.
3. **Exclusive Assignment Manager (`assignment_manager.cpp`):**
   - Enforces the strict invariant: **Exactly zero or one explicit network adapter per application**.
   - Assigning an application to a new adapter atomically replaces any existing rule.
   - Persists state in `%LOCALAPPDATA%\NetSplit\config.json` (or `%ProgramData%\NetSplit\config.json` when elevated) with atomic write-and-rename semantics (`MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)`).
4. **WFP Routing Engine (`wfp_routing_engine.cpp`):**
   - Manages dynamic Windows Filtering Platform sessions (`FWPM_SESSION_FLAG_DYNAMIC`), guaranteeing that all kernel filters registered by NetSplit are automatically purged upon service exit or crash.
   - Operates a local transparent redirection broker on `127.0.0.1:49200`.

---

## 3. Network Egress & Return Traffic Mechanics

### Why Global Routing Changes Fail
Traditional tools attempt to modify interface metrics or default gateway entries. This approach fails because:
- The Windows IP routing table (`ip route`) routes purely on destination CIDR prefixes (`0.0.0.0/0`).
- It has no concept of process ID, application executable path, or security token.
- Changing default route metrics moves all unrouted applications across that interface, breaking per-application isolation.

### The NetSplit Packet Path
NetSplit solves process-specific routing using interface-level socket binding and WFP ALE interception:
1. **Application Sockets:**
   - When an application (e.g. `chrome.exe`) issues a `connect()` call, WFP Application Layer Enforcement (`FWPM_LAYER_ALE_AUTH_CONNECT_V4`) intercepts the request using `FWP_CONDITION_ALE_APP_ID`.
2. **Transparent Redirect:**
   - Connections matching an active NetSplit rule are redirected to the local NetSplit Broker on `127.0.0.1:49200`.
3. **Interface-Specific Egress:**
   - The broker creates an outbound TCP or UDP socket.
   - It sets `setsockopt(sock, IPPROTO_IP, IP_UNICAST_IF, (const char*)&ifIndex, sizeof(ifIndex))` to bind the socket to the designated adapter's interface index.
   - It calls `bind()` to the adapter's local unicast IP address.
   - The connection establishes through the target physical network interface.
4. **Return Traffic:**
   - The remote server responds to the source IP address belonging to the bound adapter.
   - Responses naturally enter through that physical adapter, traversing the TCP stack back to the NetSplit broker, which relays the bytes to the application socket.

---

## 4. IPC Communication Protocol

- **Transport:** Local loopback HTTP & WebSocket at `127.0.0.1:48192`.
- **Security:** Ephemeral 256-bit token generated via `BCryptGenRandom` on service launch, stored in `ipc_auth.token` with DACL restricted to SYSTEM and the active interactive user.
- **Protocol:** Strict JSON-RPC 2.0 with schema-validated method dispatch.
- **Methods:**
  - `system.getStatus`: Service version, uptime, routing engine health, active rule counts.
  - `adapter.list`: Detected hardware/virtual adapters and configuration.
  - `app.list`: Discovered applications, process status, and current assignments.
  - `app.addManual`: Registers a custom executable path.
  - `rule.assign`: Assigns an application to an adapter.
  - `rule.bulkAssign`: Batch assignment with atomic reporting.
  - `rule.remove`: Deletes an assignment rule.
  - `rule.toggle`: Enables or disables a rule.
  - `rule.verify`: Triggers live kernel network stack verification.
  - `config.get` / `config.set`: Global settings management.
  - `activity.list`: Retrieves chronological audit events.
