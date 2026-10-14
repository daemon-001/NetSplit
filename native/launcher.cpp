#include <windows.h>
#include <shellapi.h>
#include <string>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::wstring dir = exePath;
    size_t lastSlash = dir.find_last_of(L"\\/");
    if (lastSlash != std::wstring::npos) {
        dir = dir.substr(0, lastSlash);
    }
    SetCurrentDirectoryW(dir.c_str());

    // 1. Ensure privileged service daemon is running in background without console
    STARTUPINFOW siService = { sizeof(siService) };
    PROCESS_INFORMATION piService = { 0 };
    siService.dwFlags = STARTF_USESHOWWINDOW;
    siService.wShowWindow = SW_HIDE;

    std::wstring serviceCmd = dir + L"\\native\\windows-service\\NetSplitService.exe --background";
    CreateProcessW(
        NULL,
        &serviceCmd[0],
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        dir.c_str(),
        &siService,
        &piService
    );
    if (piService.hProcess) {
        CloseHandle(piService.hProcess);
        CloseHandle(piService.hThread);
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
