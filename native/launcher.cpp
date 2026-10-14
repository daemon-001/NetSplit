#include <windows.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <string>

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

    // 1. Only request elevation if NetSplitService.exe is NOT already running!
    if (!IsServiceAlreadyRunning()) {
        std::wstring serviceExe = dir + L"\\native\\windows-service\\NetSplitService.exe";
        SHELLEXECUTEINFOW sei = { sizeof(sei) };
        sei.cbSize = sizeof(sei);
        sei.lpVerb = L"runas";
        sei.lpFile = serviceExe.c_str();
        sei.lpParameters = L"--background";
        sei.nShow = SW_HIDE;
        sei.fMask = SEE_MASK_NOASYNC;
        if (!ShellExecuteExW(&sei)) {
            // Graceful fallback to un-elevated process if user declines UAC
            STARTUPINFOW siService = { sizeof(siService) };
            PROCESS_INFORMATION piService = { 0 };
            siService.dwFlags = STARTF_USESHOWWINDOW;
            siService.wShowWindow = SW_HIDE;
            std::wstring serviceCmd = serviceExe + L" --background";
            if (CreateProcessW(NULL, &serviceCmd[0], NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, dir.c_str(), &siService, &piService)) {
                CloseHandle(piService.hProcess);
                CloseHandle(piService.hThread);
            }
        }
        // Give service a moment to initialize token and socket
        Sleep(500);
    }

    // 2. Launch the NetSplit Desktop GUI Application window
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
