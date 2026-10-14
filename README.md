# NetSplit — Per-Application Network Routing for Windows 11

[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20x64-0078D4?logo=windows)](https://microsoft.com/windows)
[![UI](https://img.shields.io/badge/UI-React%20Native%20for%20Windows-61DAFB?logo=react)](https://microsoft.github.io/react-native-windows/)
[![Language](https://img.shields.io/badge/Backend-C%2B%2B17%20%2F%20WFP-00599C?logo=c%2B%2B)](https://learn.microsoft.com/windows/win32/fwp/windows-filtering-platform-start-page)
[![Tests](https://img.shields.io/badge/Tests-16%20Passing-107c41)](#automated-testing)
[![Anti--Cheat](https://img.shields.io/badge/Anti--Cheat-Safe%20%26%20Compliant-107c41)](#zero-tampering--anti-cheat-compliance)

**NetSplit** is a native Windows 11 utility that enables users to bind individual applications, games, and background programs to specific network adapters (e.g. Ethernet, Wi-Fi, USB tethering, secondary Wi-Fi) without altering application binaries or modifying the global Windows default routing table.

---

## 1. Non-Negotiable Guarantees

- **Zero Binary Tampering:** Absolutely no DLL injection (`AppInit_DLLs`, `CreateRemoteThread`), no API hooking (Detours, MinHook, Layered Service Providers), and zero byte modifications to routed application executables.
- **Anti-Cheat Safe:** Fully transparent to Riot Vanguard, Easy Anti-Cheat, BattlEye, and VAC by executing entirely outside target process virtual memory at standard Windows network stack boundaries (WFP and socket layer).
- **Strict Least Privilege:** The desktop UI runs under normal Medium Integrity Level user privileges. Privileged operations are isolated to an authenticated C++ Windows Service communicating over local loopback (`127.0.0.1:48192`) with a cryptographically secure ephemeral token.
- **Strict Verifiable State:** No simulated routing or false indicators. Rule status is backed by live kernel and interface stack verifications.
- **Exclusive Assignment:** Exactly zero or one explicit adapter assignment per application. Conflicting rules are prevented atomically in the backend.

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

## 3. Hardware Feasibility Verification (Phase 1 PoC)

The interface binding mechanism was proven on live Windows 11 hardware with two concurrent connections (Wi-Fi 6 AX201 and USB Tethering):

```
====================================================================
   NetSplit - Phase 1 Technical Feasibility Proof of Concept        
   Independent Process/Socket-Level Network Interface Binding       
====================================================================

--- Testing Adapter: Ethernet 2 (Index: 6, Local IP: 10.232.65.65) ---
  [SUCCESS] setsockopt(IP_UNICAST_IF, ifIndex=6) applied.
  [BOUND] Local socket endpoint: 10.232.65.65:53372
  ===> RESULT: TCP Traffic successfully routed through adapter [Ethernet 2]!
       Observed Public Egress IP: 47.31.115.112
  [SUCCESS] UDP DNS query to 1.1.1.1 succeeded via Ethernet 2 (Received 61 bytes).

--- Testing Adapter: WiFi (Index: 11, Local IP: 192.168.31.85) ---
  [SUCCESS] setsockopt(IP_UNICAST_IF, ifIndex=11) applied.
  [BOUND] Local socket endpoint: 192.168.31.85:53373
  ===> RESULT: TCP Traffic successfully routed through adapter [WiFi]!
       Observed Public Egress IP: 49.37.73.231
  [SUCCESS] UDP DNS query to 1.1.1.1 succeeded via WiFi (Received 61 bytes).
```

*Two concurrent sockets egressed through distinct physical adapters, producing different public IP addresses (`47.31.115.112` vs `49.37.73.231`) without modifying the system routing table.*

---

## 4. Repository Structure

```
NetSplit/
├── apps/
│   └── desktop/                  # React Native for Windows Desktop Application
│       ├── src/
│       │   ├── components/       # Fluent Sidebar, TopBar, StatusBadge, QuickSelector, Modal
│       │   ├── screens/          # Overview, Applications, Adapters, Rules, Activity, Settings
│       │   ├── services/         # Typed JSON-RPC 2.0 Client (ipcClient.ts)
│       │   ├── store/            # Centralized Zustand State Management
│       │   └── theme/            # Fluent 2 Color Tokens, Spacing, Typography
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared-types/             # Shared TypeScript Contracts & JSON-RPC Schemas
├── native/
│   ├── windows-service/          # C++17 Privileged Windows Service Daemon
│   │   ├── src/
│   │   │   ├── adapter_manager   # GetAdaptersAddresses & Interface Events
│   │   │   ├── app_discovery     # Process & Installed Application Enumerator
│   │   │   ├── assignment_manager# Transactional Exclusive Assignment Store
│   │   │   ├── wfp_routing_engine# WFP Dynamic Engine & Proxy Broker
│   │   │   ├── ipc_server        # Authenticated Loopback JSON-RPC 2.0 Server
│   │   │   └── service_main      # SCM Service & Console Runner Entrypoint
│   │   └── build.bat             # MSVC x64 build script
│   └── poc-verifier/             # Phase 1 Socket-Level Verification Harness
├── scripts/
│   ├── install-service.ps1       # Elevated Windows Service installer
│   ├── uninstall-service.ps1     # Clean service removal & recovery
│   └── verify-routing.ps1        # Real-time multi-adapter routing tester
├── tests/
│   ├── unit/                     # Uniqueness & Protocol validation tests
│   └── integration/              # Live service daemon & IPC tests
├── docs/
│   ├── architecture.md           # Subsystem architecture & packet path
│   ├── security.md               # Threat model, IPC DACL, anti-cheat safety
│   ├── routing-limitations.md    # Multi-process & VPN boundaries
│   ├── installation.md           # Developer setup & service commands
│   └── routing-engine-feasibility-report.md # Feasibility experimental report
└── README.md
```

---

## 5. Quickstart & Developer Guide

### 1. Compile Native Windows Service
```powershell
cmd.exe /c "native\windows-service\build.bat"
```

### 2. Run Automated Verification Tests
```powershell
node --test tests/unit/*.test.js tests/integration/*.test.js
```
*(Runs 16 automated tests covering assignment uniqueness, IPC protocol validation, and live service daemon lifecycle)*.

### 3. Start Service Daemon
```powershell
# Interactive development mode:
.\native\windows-service\NetSplitService.exe

# Or install as automated Windows Service (Elevated):
powershell -ExecutionPolicy Bypass -File .\scripts\install-service.ps1
```

### 4. Build & Launch Desktop UI
```powershell
npm run build:types
npm run windows --workspace=@netsplit/desktop
```

---

## 6. Clean Uninstallation & System Recovery

NetSplit uses dynamic WFP sessions (`FWPM_SESSION_FLAG_DYNAMIC`). All rules are automatically freed by Windows upon exit. To remove the service cleanly without leaving orphaned configuration:

```powershell
# In an elevated PowerShell terminal:
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-service.ps1
```

---

## 7. License

Licensed under the MIT License.
