# NetSplit Architectural Specification

**Product Name:** NetSplit  
**Platform:** Windows 11 x64 (compatible with Windows 10 x64)  
**Date:** 2026-10-14  
**Status:** Approved for Implementation  

---

## 1. Executive Summary & Objective

NetSplit is a production-grade Windows 11 utility enabling users to bind individual desktop applications, games, and background processes to specific network adapters (e.g., Ethernet, Wi-Fi, USB cellular tethering). 

### Key Principles & Non-Negotiables
- **Zero Binary Tampering:** Absolutely no DLL injection, API hooking (Detours/MinHook), LSP (Layered Service Providers), or modification of target executables.
- **Anti-Cheat Safe:** Fully transparent to game anti-cheat engines (Riot Vanguard, Easy Anti-Cheat, BattlEye) by operating purely at standard Windows network stack boundaries (WFP and socket layer).
- **Security & Least Privilege:** The desktop UI runs under normal medium-integrity user privileges. Privileged operations are strictly segregated to a native Windows Service communicating over an authenticated local IPC channel.
- **Strict Verifiable State:** No simulated routing or false indicators. Routing status displayed in the UI is backed by live kernel/network stack verifications.
- **Exclusive Assignment:** Exactly zero or one explicit adapter assignment per application. Grouping and multi-process rules resolve deterministically.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                         React Native Windows Desktop UI                           |
|                    (Standard User Privileges - Medium IL)                         |
|                                                                                   |
|  [Overview] [Applications] [Adapters] [Routing Rules] [Activity Log] [Settings]   |
|                                     |                                             |
|                     Zustand Store / Typed JSON-RPC Client                         |
+-------------------------------------|---------------------------------------------+
                                      | JSON-RPC 2.0 over Secure Loopback WebSocket
                                      | ws://127.0.0.1:48192 (Ephemeral Token Auth)
                                      v
+-----------------------------------------------------------------------------------+
|                           NetSplit Windows Service                                |
|                        (NT AUTHORITY\SYSTEM or Service)                           |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +------------------+  |
|  | IPC Server & Auth Gate  |  | Assignment Manager       |  | App Discovery &  |  |
|  | (127.0.0.1 token auth)  |  | (Exclusive, JSON journal)|  | Running Mon      |  |
|  +-------------------------+  +--------------------------+  +------------------+  |
|                                     |                                             |
|  +------------------------------------------------------------------------------+ |
|  |                        NetSplit Routing Engine                               | |
|  |                                                                              | |
|  |  [Adapter Enumerator]        [WFP ALE Filter Manager]    [Redirect Broker]   | |
|  |  (GetAdaptersAddresses,      (FwpmFilterAdd0,            (IP_UNICAST_IF      | |
|  |   IP Helper, Netlink events)  ALE_CONNECT_REDIRECT)       transparent proxy) | |
|  +------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown

### 3.1 Privileged Windows Service & IPC Layer (`native/windows-service`)
- **Role:** Central coordination daemon running as a Windows Service or background broker.
- **Responsibilities:**
  - Enumerates network adapters via `GetAdaptersAddresses`, IP Helper, and network change notifications (`NotifyIpInterfaceChange`).
  - Discovers installed applications and running processes (`CreateToolhelp32Snapshot`, `QueryFullProcessImageNameW`, Windows Registry uninstall keys).
  - Maintains persistent configuration and atomic journal of active assignments (`%ProgramData%\NetSplit\config.json`).
  - Manages the WFP engine session (`FwpmEngineOpen0`) and redirect broker.
  - Implements an authenticated JSON-RPC 2.0 WebSocket server on `127.0.0.1:48192`.
- **Security & Authorization:**
  - Generates a 256-bit cryptographically random token on launch stored in `%ProgramData%\NetSplit\ipc_auth.token`.
  - File DACL restricts read access exclusively to `SYSTEM` and the active interactive user's SID (`SECURITY_MANDATORY_MEDIUM_RID`).
  - Strict input validation on all RPC parameters: sanitizes file paths, prevents path traversal, and enforces schema limits.

### 3.2 Routing Engine Core (`native/routing-engine`)
- **Feasibility & Mechanism:**
  - Standard Windows routing routes based purely on destination IP/CIDR in the IP routing table (`ip route`). To route based on the originating process path without modifying binaries:
  - **Phase 1 Dual-Engine Architecture:**
    1. **Primary Engine (User-mode WFP ALE Transparent Redirect):**
       - Windows Filtering Platform (WFP) ALE Connect Redirect layer (`FWPM_LAYER_ALE_CONNECT_REDIRECT_V4` / `FWPM_LAYER_ALE_CONNECT_REDIRECT_V6`).
       - Adds a non-persistent WFP filter matching `FWP_CONDITION_ALE_APP_ID` (normalized full path of target application executable).
       - Redirects outbound connection requests to a local broker socket bound on `127.0.0.1`.
       - The NetSplit broker accepts the connection, resolves the target application's intended destination, and dials the remote host using a socket explicitly bound to the target network interface using `IP_UNICAST_IF` (IPv4) / `IPV6_UNICAST_IF` (IPv6) or `bind()` to the interface's local IP address.
       - High throughput streaming via zero-copy I/O completion ports (IOCP).
    2. **Extensible Kernel Callout Driver Interface:**
       - Abstract C++ interface `IRoutingDriver` designed to accommodate an optional WDF kernel callout driver (`FWPS_LAYER_ALE_BIND_REDIRECT_V4/V6`) in enterprise/enthusiast deployments requiring kernel-level bypass without proxy overhead.
- **Return Traffic & Disconnect Handling:**
  - Outbound packets egressing via the specific adapter receive incoming responses naturally on that adapter's IP address.
  - If an assigned adapter is disconnected or unavailable:
    - *Default policy:* Drop/block (kill-switch) to prevent IP leakage.
    - *Fallback policy:* Optional failover to default Windows route if configured by user.

### 3.3 Application Discovery & Identity (`packages/app-discovery`)
- **Identity Scheme:**
  - Primary key: Normalized lowercase absolute executable path (`C:\Program Files\Example\app.exe`).
  - Secondary metadata: SHA-256 binary hash, File Version Info (Product Name, Company, Version), and Application Icon extraction.
- **Sources:**
  - Active running processes via `EnumProcesses` / `CreateToolhelp32Snapshot`.
  - Windows Registry App Paths (`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths` and `HKCU`).
  - Windows Uninstall registry keys (64-bit and 32-bit WoW64).
  - Windows Start Menu shortcuts (`.lnk` target resolution).
  - User manual file picker for custom/portable executables.
- **Multi-Process Grouping:**
  - Allows grouping related executables (e.g., `Steam.exe`, `steamwebhelper.exe`, `gameoverlayui.exe`).
  - Conflict resolution: If process A is explicitly assigned to Adapter 1 and also belongs to Group B assigned to Adapter 2, the individual explicit assignment wins deterministically.

### 3.4 React Native Windows Desktop UI (`apps/desktop`)
- **Technology Stack:**
  - React Native for Windows (TypeScript).
  - React Navigation with custom Fluent-inspired desktop layout.
  - Zustand for reactive state management.
  - Native Windows vector icons and Fluent Design System (Acrylic/Mica backdrop accents, subtle elevation, responsive grid).
- **Screens:**
  1. **Overview:** System status, active adapter cards with live link speed/traffic metrics, routing engine health, quick counters.
  2. **Applications:** Searchable, filterable virtualized table of installed and running apps with inline quick adapter selectors, bulk assignment, and manual executable browser.
  3. **Network Adapters:** Detailed inventory of all hardware, virtual, Wi-Fi, Ethernet, and tethered interfaces with assigned app lists.
  4. **Routing Rules:** Authoritative system enforcement table showing live verified kernel state, verification timestamps, and rule toggles.
  5. **Activity Log:** Real-time chronological audit trail of all adapter events, rule activations, and system telemetry.
  6. **Settings:** Default routing policy, fallback behavior, startup settings, dark/light theme toggle, and service diagnostics.

---

## 4. Typed IPC Protocol (JSON-RPC 2.0)

### Methods
- `system.getStatus`: Returns service version, uptime, routing engine health, and driver status.
- `adapter.list`: Returns all detected network adapters, interface indices, GUIDs, IP addresses, link state, and speed.
- `app.list`: Returns discovered applications with process status and current assignment.
- `app.addManual`: Registers a manually selected executable path.
- `rule.assign`: Assigns an application or group to an adapter (`{ appId, executablePath, adapterId, fallbackMode }`).
- `rule.bulkAssign`: Transactional batch assignment for multiple applications.
- `rule.remove`: Deletes an assignment and cleanly tears down its WFP filters.
- `rule.verify`: Triggers active verification of system routing rules against the network stack.
- `config.get` / `config.set`: Global policy configuration (default route, killswitch vs fallback).

### Push Events (Server -> Client)
- `adapter.changed`: Emitted when an adapter connects, disconnects, or changes IP.
- `process.changed`: Emitted when tracked applications start or terminate.
- `rule.enforcementChanged`: Emitted when a rule's active enforcement state changes.
- `activity.log`: Emitted for audit log records.

---

## 5. Verification & Testing Strategy
1. **Phase 1 CLI Proof of Concept (`native/poc-verifier`):**
   - Independent C++ executable testing socket creation bound to specific network interfaces (`IP_UNICAST_IF`).
   - Initiates an HTTP/HTTPS request through Adapter 1 (e.g. Wi-Fi) and simultaneously through Adapter 2 (e.g. USB Tethering), querying `https://api.ipify.org` to prove differing egress public IP addresses and interface traffic counters.
2. **Unit Tests:**
   - Assignment uniqueness, conflict detection, path normalization, JSON serialization.
3. **Integration Tests:**
   - WebSocket RPC request/response cycle, token authentication rejection, rule lifecycle (create, verify, delete).
4. **Safety & Uninstall Tests:**
   - Clean shutdown guarantees removal of all NetSplit WFP filters without leaving orphan redirects.
