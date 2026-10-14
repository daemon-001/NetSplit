# NetSplit Security & Threat Model Specification

**Date:** 2026-10-14  
**Target OS:** Windows 11 x64 / Windows 10 x64  
**Classification:** Privileged Desktop System Component  

---

## 1. Principles of Least Privilege & Security Boundaries

NetSplit enforces a strict separation between the non-privileged user interface and privileged system networking operations.

```
+-------------------------------------------------------------+
|               User Desktop Context (Medium IL)              |
|                                                             |
|           React Native for Windows UI (NetSplit.exe)        |
+-------------------------------------------------------------+
                              |
                              | Local Loopback (127.0.0.1:48192)
                              | Ephemeral Bearer Token Authentication
                              v
+-------------------------------------------------------------+
|             Privileged System Context (High/System IL)      |
|                                                             |
|                 NetSplit Windows Service Daemon             |
|                       (NetSplitService.exe)                 |
|                                                             |
|   +-----------------------------------------------------+   |
|   |         Windows Filtering Platform (WFP ALE)        |   |
|   |           Zero DLL Injection / Anti-Cheat Safe      |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
```

### 1.1 Non-Elevated Desktop UI
- The desktop interface runs entirely under standard user credentials (Medium Integrity Level).
- Standard users cannot arbitrarily create, alter, or delete system routing tables, firewall policies, or network adapters.
- The UI never requires elevation simply to browse installed programs, view network adapters, or inspect configured rules.

### 1.2 Privileged Windows Service
- Privileged operations (managing WFP filters, interface queries, dynamic redirects) are encapsulated exclusively within `NetSplitService.exe`.
- The service runs as a native Windows service under `NT AUTHORITY\SYSTEM` or a dedicated service virtual account (`NT SERVICE\NetSplitService`) with `SeNetworkConfigurationPrivilege`.

---

## 2. IPC Authentication & Authorization Gate

### 2.1 Cryptographic Ephemeral Token Generation
- On startup, `NetSplitService.exe` generates a cryptographically random 256-bit token using Windows Cryptographic Next Generation (CNG):
  ```cpp
  BCryptGenRandom(NULL, randBytes, sizeof(randBytes), BCRYPT_USE_SYSTEM_PREFERRED_RNG);
  ```
- The token is written to `%LOCALAPPDATA%\NetSplit\ipc_auth.token` (or `%ProgramData%\NetSplit\ipc_auth.token`).
- **DACL Protection:** The file DACL is restricted to `SYSTEM` and the currently active interactive logged-in user SID (`SECURITY_MANDATORY_MEDIUM_RID`). Other non-interactive users or network entities cannot read the token.

### 2.2 Local Loopback Binding & Token Validation
- The IPC server binds strictly to IPv4 loopback `127.0.0.1:48192`. It never binds to external interfaces (`0.0.0.0` or public IP addresses).
- Every incoming request must present the bearer token in the `Authorization: Bearer <token>` header or query parameters.
- Requests with invalid or missing tokens are immediately rejected with HTTP 401 (`-32001 Unauthorized`).
- Brute-force protection: Invalid attempts are rate-limited and logged.

---

## 3. Defense Against Binary Injection & Anti-Cheat Compatibility

Many gaming and productivity utilities attempt per-application routing by injecting a DLL (via `AppInit_DLLs`, `CreateRemoteThread`, or API hooking libraries like Detours or MinHook) to hook `connect()`, `sendto()`, and `getaddrinfo()`.

### Why NetSplit Strictly Forbids DLL Injection
1. **Anti-Cheat Violation:** Anti-cheat engines (Riot Vanguard, Easy Anti-Cheat, BattlEye, Valve Anti-Cheat) immediately detect and flag foreign DLL injection, function patching, or memory modification as malicious tampering or cheats, resulting in permanent account bans.
2. **Crash & Stability Risk:** Hooking Winsock APIs in third-party processes causes memory corruption, race conditions with thread-local storage, and breaks when applications update their binaries.
3. **Security Degradation:** Injecting arbitrary code requires high privileges or weakening exploit mitigations (e.g. disabling CFG, ACG, or Secure Boot).

### NetSplit Anti-Cheat Safe Model
- NetSplit **never touches application memory, never injects DLLs, never hooks functions, and never modifies executable files on disk**.
- All routing classification happens at the Windows kernel network stack boundary via **Windows Filtering Platform (WFP) Application Layer Enforcement (ALE)**.
- Anti-cheat systems view NetSplit as a standard Windows networking feature operating entirely outside the game's virtual address space.

---

## 4. Input Sanitization & Threat Mitigations

| Threat Vector | Mitigation in NetSplit |
| :--- | :--- |
| **Command Injection** | The Windows service never invokes `cmd.exe`, `powershell.exe`, or arbitrary shell commands. All operations use typed Win32 and IP Helper C++ APIs. |
| **Path Traversal (`..` attacks)** | Executable paths are normalized (`AppDiscoveryManager::NormalizePath`), checked for path traversal components, and verified against `PathFileExistsW` before processing. |
| **Denial of Service (Resource Exhaustion)** | Incoming JSON payloads are capped at 64 KB; buffer reads enforce timeouts (`SO_RCVTIMEO`); connection limits prevent socket exhaustion. |
| **Orphan Kernel Filters** | The WFP engine session is created with `FWPM_SESSION_FLAG_DYNAMIC`. If the service process terminates, crashes, or is restarted, the Windows kernel automatically cleans up all NetSplit filters. |
| **Data Leakage on Adapter Disconnect** | When an assigned adapter disconnects, NetSplit's default rule policy is `BLOCK` (Kill-switch), dropping outbound packets rather than leaking them to Windows default routes. |
| **Telemetry & Privacy** | NetSplit does not capture packet payloads, DNS browsing history, or user credentials. Diagnostic activity logs are stored locally and never transmitted to external servers. |

---

## 5. Driver Code Signing & Kernel Extensibility

For environments utilizing the optional NetSplit Kernel Callout Driver:
- The driver conforms strictly to the Windows Driver Framework (KMDF) and WFP Callout specification.
- Requires an Extended Validation (EV) code-signing certificate and Microsoft Hardware Dev Center attestation signing for production release.
- Local developer testing is supported under Windows Test Signing mode (`bcdedit /set testsigning on`).
- NetSplit never disables driver signature enforcement or bypasses Secure Boot.
