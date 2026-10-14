# NetSplit Installation & Developer Setup Guide

**Target OS:** Windows 11 x64 / Windows 10 x64  
**Runtime:** Node.js v18+, Visual Studio 2022 C++ Tools, Windows 11 SDK  

---

## 1. Prerequisites & Environment Setup

Ensure the following development dependencies are installed:
1. **Node.js**: v18.0.0 or later (v20+ or v24+ recommended).
2. **Visual Studio 2022 / Build Tools**:
   - MSVC v143 (C++ x64/x86 build tools).
   - Windows 11 SDK (10.0.22000.0 or 10.0.26100.0).
3. **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+.

---

## 2. Compiling the Native Windows Service Daemon

The native service source is located in `native/windows-service`.

To compile `NetSplitService.exe`:
```powershell
# Open developer console or run the automated build script:
cmd.exe /c "native\windows-service\build.bat"
```

The script initializes `vcvars64.bat` and compiles:
- `native/windows-service/NetSplitService.exe`
Linked libraries: `ws2_32.lib`, `iphlpapi.lib`, `fwpuclnt.lib`, `version.lib`, `shlwapi.lib`, `bcrypt.lib`, `advapi32.lib`.

---

## 3. Running Modes

### Mode A: Interactive Developer Console (Recommended for Testing)
Run `NetSplitService.exe` directly in foreground:
```powershell
.\native\windows-service\NetSplitService.exe
```
Output:
```
====================================================================
   NetSplit - Privileged Windows Networking Service Daemon          
====================================================================
Config path: C:\Users\<User>\AppData\Local\NetSplit\config.json
Token path:  C:\Users\<User>\AppData\Local\NetSplit\ipc_auth.token
[IPC Server] Listening for UI clients on http://127.0.0.1:48192
[NetSplit] Core service daemon active. Press Ctrl+C to terminate.
```
- Pressing `Ctrl+C` triggers an orderly shutdown, releasing all dynamic WFP filters and closing sockets.

### Mode B: Windows Service Installation (Production Deployment)
To register NetSplit as an automated Windows Service running under `NT AUTHORITY\SYSTEM`:
```powershell
# In an Administrator PowerShell terminal:
.\native\windows-service\NetSplitService.exe --install
```
To verify the registered service:
```powershell
Get-Service -Name NetSplitService
Start-Service -Name NetSplitService
```

### Mode C: Clean Uninstallation & Service Removal
To stop and completely remove the service registration from the Windows Service Control Manager:
```powershell
# In an Administrator PowerShell terminal:
.\native\windows-service\NetSplitService.exe --uninstall
```
*Because NetSplit uses dynamic WFP sessions (`FWPM_SESSION_FLAG_DYNAMIC`), stopping or uninstalling the service instantly clears all network filters from the Windows kernel without leaving orphan redirects.*

---

## 4. Running the Desktop UI

1. Install project dependencies:
   ```powershell
   npm install --legacy-peer-deps
   ```
2. Build shared TypeScript contracts:
   ```powershell
   npm run build:types
   ```
3. Type-check the React Native for Windows desktop app:
   ```powershell
   .\node_modules\.bin\tsc --project .\apps\desktop\tsconfig.json --noEmit
   ```
4. Launch the desktop application:
   ```powershell
   npm run windows --workspace=@netsplit/desktop
   ```

---

## 5. Automated Verification & Testing

NetSplit includes complete end-to-end test harnesses:

1. **Hardware Egress Verification (Phase 1 PoC):**
   ```powershell
   cmd.exe /c "cl.exe /EHsc /std:c++17 native\poc-verifier\poc_adapter_routing.cpp /Fe:native\poc-verifier\poc_adapter_routing.exe /link ws2_32.lib iphlpapi.lib"
   .\native\poc-verifier\poc_adapter_routing.exe
   ```
2. **Service IPC & Rule Lifecycle Test:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\test_wifi_assign.ps1
   ```
