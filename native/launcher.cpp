#include <windows.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <string>

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

static bool IsServiceAlreadyRunning() {
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return false;

    PROCESSENTRY32W pe = { sizeof(pe) };
    bool found = false;
    if (Process32FirstW(hSnap, &pe)) {
        do {
            if (_wcsicmp(pe.szExeFile, L"NetSplitService.exe") == 0) {
                found = true;
                break;
            }
        } while (Process32NextW(hSnap, &pe));
    }
    CloseHandle(hSnap);
    return found;
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

    // 2. Ensure NetSplitService is running
    // If not running, launch NetSplitService.exe elevated in background
    if (!IsServiceAlreadyRunning()) {
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
        // Give service a moment to initialize token and socket
        Sleep(600);
    }

    // 3. Launch the NetSplit Desktop GUI Application window (elevated)
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
