#include <windows.h>
#include <shellapi.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // 1. Ensure privileged service daemon is running in background without console
    STARTUPINFOW siService = { sizeof(siService) };
    PROCESS_INFORMATION piService = { 0 };
    siService.dwFlags = STARTF_USESHOWWINDOW;
    siService.wShowWindow = SW_HIDE;

    wchar_t serviceCmd[] = L"native\\windows-service\\NetSplitService.exe --background";
    CreateProcessW(
        NULL,
        serviceCmd,
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        NULL,
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

    wchar_t uiCmd[] = L"cmd.exe /c npx electron apps/desktop";
    CreateProcessW(
        NULL,
        uiCmd,
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        NULL,
        &siUI,
        &piUI
    );
    if (piUI.hProcess) {
        CloseHandle(piUI.hProcess);
        CloseHandle(piUI.hThread);
    }

    return 0;
}
