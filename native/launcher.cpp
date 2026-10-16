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
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "shell32.lib")

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

struct WindowCheckData {
    DWORD pid;
    bool hasVisible;
};

static BOOL CALLBACK EnumWindowsCallback(HWND hwnd, LPARAM lParam) {
    WindowCheckData* data = (WindowCheckData*)lParam;
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid == data->pid && IsWindowVisible(hwnd)) {
        data->hasVisible = true;
        return FALSE;
    }
    return TRUE;
}

static void KillZombieUIProcesses() {
    DWORD currentPid = GetCurrentProcessId();
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32W pe = { sizeof(pe) };
    if (Process32FirstW(hSnap, &pe)) {
        do {
            if (pe.th32ProcessID != currentPid && _wcsicmp(pe.szExeFile, L"NetSplit.exe") == 0) {
                WindowCheckData data = { pe.th32ProcessID, false };
                EnumWindows(EnumWindowsCallback, (LPARAM)&data);
                if (!data.hasVisible) {
                    HANDLE hProc = OpenProcess(PROCESS_TERMINATE, FALSE, pe.th32ProcessID);
                    if (hProc) {
                        TerminateProcess(hProc, 0);
                        CloseHandle(hProc);
                    }
                }
            }
        } while (Process32NextW(hSnap, &pe));
    }
    CloseHandle(hSnap);
    Sleep(150);
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
        sei.nShow = (nCmdShow == SW_HIDE || nCmdShow == 0) ? SW_SHOWNORMAL : nCmdShow;
        sei.fMask = SEE_MASK_NOASYNC;
        if (ShellExecuteExW(&sei)) {
            return 0; // Elevated instance launched successfully
        }
        MessageBoxW(NULL, 
            L"NetSplit requires Administrator privileges to manage network adapter routing and WFP engine rules.\nPlease run as administrator.",
            L"NetSplit - Elevation Required", 
            MB_ICONWARNING | MB_OK);
        return 1;
    }

    EnableDebugPrivilege();
    KillZombieUIProcesses();

    // 2. Launch the NetSplit Desktop GUI Application window
    STARTUPINFOW siUI = { sizeof(siUI) };
    PROCESS_INFORMATION piUI = { 0 };
    siUI.cb = sizeof(siUI);
    siUI.dwFlags = STARTF_USESHOWWINDOW;
    siUI.wShowWindow = (nCmdShow == SW_HIDE || nCmdShow == 0) ? SW_SHOWNORMAL : nCmdShow;

    std::wstring runtimeExe = dir + L"\\runtime\\NetSplit.exe";
    std::wstring appAsar = dir + L"\\runtime\\resources\\app.asar";
    std::wstring uiCmd;
    if (GetFileAttributesW(runtimeExe.c_str()) != INVALID_FILE_ATTRIBUTES) {
        if (GetFileAttributesW(appAsar.c_str()) != INVALID_FILE_ATTRIBUTES) {
            uiCmd = L"\"" + runtimeExe + L"\" \"" + appAsar + L"\"";
        } else {
            uiCmd = L"\"" + runtimeExe + L"\"";
        }
    } else {
        uiCmd = L"cmd.exe /c npx electron apps/desktop";
    }

    BOOL success = CreateProcessW(
        NULL,
        &uiCmd[0],
        NULL,
        NULL,
        FALSE,
        0,
        NULL,
        dir.c_str(),
        &siUI,
        &piUI
    );

    if (!success) {
        DWORD err = GetLastError();
        std::wstring msg = L"Failed to start NetSplit UI runtime.\nError code: " + std::to_wstring(err) + L"\nPath: " + uiCmd;
        MessageBoxW(NULL, msg.c_str(), L"NetSplit - Startup Error", MB_ICONERROR | MB_OK);
        return 1;
    }

    if (piUI.hProcess) {
        CloseHandle(piUI.hProcess);
        CloseHandle(piUI.hThread);
    }

    return 0;
}
