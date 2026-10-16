#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <string>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "advapi32.lib")

static bool IsElevated() {
    BOOL isElevated = FALSE;
    HANDLE hToken = NULL;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
        TOKEN_ELEVATION elevation;
        DWORD cbSize = sizeof(TOKEN_ELEVATION);
        if (GetTokenInformation(hToken, TokenElevation, &elevation, sizeof(elevation), &cbSize)) {
            isElevated = elevation.TokenIsElevated;
        }
        CloseHandle(hToken);
    }
    return isElevated != 0;
}

static void EnableDebugPrivilege() {
    HANDLE hToken;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &hToken)) {
        TOKEN_PRIVILEGES tp;
        tp.PrivilegeCount = 1;
        LookupPrivilegeValue(NULL, SE_DEBUG_NAME, &tp.Privileges[0].Luid);
        tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
        AdjustTokenPrivileges(hToken, FALSE, &tp, sizeof(tp), NULL, NULL);
        CloseHandle(hToken);
    }
}

static bool IsPortResponding(int port) {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return false;

    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) {
        WSACleanup();
        return false;
    }

    DWORD timeout = 400;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeout, sizeof(timeout));

    sockaddr_in addr = { 0 };
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(port);

    bool ok = (connect(s, (sockaddr*)&addr, sizeof(addr)) != SOCKET_ERROR);
    closesocket(s);
    WSACleanup();
    return ok;
}

static void KillZombieServiceProcesses() {
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32W pe = { sizeof(pe) };
    if (Process32FirstW(hSnap, &pe)) {
        do {
            if (_wcsicmp(pe.szExeFile, L"NetSplitService.exe") == 0) {
                HANDLE hProc = OpenProcess(PROCESS_TERMINATE, FALSE, pe.th32ProcessID);
                if (hProc) {
                    TerminateProcess(hProc, 0);
                    CloseHandle(hProc);
                }
            }
        } while (Process32NextW(hSnap, &pe));
    }
    CloseHandle(hSnap);
}

static void RestartOrStartService(const std::wstring& dir) {
    // 1. If Windows Service is installed in SCM, restart it cleanly
    SC_HANDLE schSCM = OpenSCManagerW(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    bool isWindowsService = false;
    if (schSCM) {
        SC_HANDLE schSvc = OpenServiceW(schSCM, L"NetSplitService", SERVICE_STOP | SERVICE_START | SERVICE_QUERY_STATUS);
        if (schSvc) {
            isWindowsService = true;
            SERVICE_STATUS status;
            ControlService(schSvc, SERVICE_CONTROL_STOP, &status);
            Sleep(400);
            KillZombieServiceProcesses();
            Sleep(300);
            StartServiceW(schSvc, 0, NULL);
            CloseServiceHandle(schSvc);
        }
        CloseServiceHandle(schSCM);
    }

    // 2. If not a Windows Service, kill any lingering zombie processes and start standalone daemon
    if (!isWindowsService) {
        KillZombieServiceProcesses();
        Sleep(300);

        std::wstring serviceExe = dir + L"\\native\\windows-service\\NetSplitService.exe";
        STARTUPINFOW siService = { sizeof(siService) };
        PROCESS_INFORMATION piService = { 0 };
        siService.dwFlags = STARTF_USESHOWWINDOW;
        siService.wShowWindow = SW_HIDE;
        std::wstring serviceCmd = L"\"" + serviceExe + L"\" --background";
        if (CreateProcessW(NULL, &serviceCmd[0], NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, dir.c_str(), &siService, &piService)) {
            CloseHandle(piService.hProcess);
            CloseHandle(piService.hThread);
        }
    }
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::wstring dir = exePath;
    size_t lastSlash = dir.find_last_of(L"\\/");
    if (lastSlash != std::wstring::npos) {
        dir = dir.substr(0, lastSlash);
    }
    SetCurrentDirectoryW(dir.c_str());

    // 1. Mandatory Elevation Check: Always ensure NetSplit runs as Administrator
    if (!IsElevated()) {
        SHELLEXECUTEINFOW sei = { sizeof(sei) };
        sei.cbSize = sizeof(sei);
        sei.lpVerb = L"runas";
        sei.lpFile = exePath;
        sei.lpParameters = NULL;
        sei.nShow = nCmdShow;
        sei.fMask = SEE_MASK_NOASYNC;
        if (ShellExecuteExW(&sei)) {
            return 0; // Elevated instance launched successfully
        }
        // If user cancelled UAC, inform them
        MessageBoxW(NULL, 
            L"NetSplit requires Administrator privileges to manage network adapter routing and WFP engine rules.\nPlease run as administrator.",
            L"NetSplit - Elevation Required", 
            MB_ICONWARNING | MB_OK);
        return 1;
    }

    EnableDebugPrivilege();

    // 2. Launch the NetSplit Desktop GUI Application window (elevated)
    STARTUPINFOW siUI = { sizeof(siUI) };
    PROCESS_INFORMATION piUI = { 0 };
    siUI.dwFlags = STARTF_USESHOWWINDOW;
    siUI.wShowWindow = SW_HIDE;

    std::wstring uiCmd = L"cmd.exe /c npx electron apps/desktop";
    CreateProcessW(
        NULL,
        &uiCmd[0],
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        dir.c_str(),
        &siUI,
        &piUI
    );
    if (piUI.hProcess) {
        CloseHandle(piUI.hProcess);
        CloseHandle(piUI.hThread);
    }

    return 0;
}
