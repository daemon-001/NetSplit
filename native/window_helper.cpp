#include <windows.h>
#include <dwmapi.h>
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <iomanip>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "user32.lib")

struct WindowEntry {
    DWORD pid;
    std::string title;
    std::string className;
};

static std::string WStringToUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

static std::string JsonEscape(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ((unsigned char)c < 0x20) {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)(unsigned char)c;
        } else {
            o << c;
        }
    }
    return o.str();
}

BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    if (!IsWindow(hwnd)) return TRUE;
    if (!IsWindowVisible(hwnd)) return TRUE;

    // Check cloaked state (Windows 10/11 virtual desktops)
    DWORD cloaked = 0;
    if (SUCCEEDED(DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &cloaked, sizeof(cloaked)))) {
        if (cloaked & DWM_CLOAKED_SHELL) return TRUE;
    }

    LONG exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
    if (exStyle & WS_EX_TOOLWINDOW) return TRUE;

    HWND hOwner = GetWindow(hwnd, GW_OWNER);
    if (hOwner != NULL && !(exStyle & WS_EX_APPWINDOW)) {
        return TRUE;
    }

    int len = GetWindowTextLengthW(hwnd);
    if (len == 0) return TRUE;

    RECT rc;
    if (GetWindowRect(hwnd, &rc)) {
        if ((rc.right - rc.left) <= 0 || (rc.bottom - rc.top) <= 0) return TRUE;
    }

    wchar_t className[256] = {0};
    GetClassNameW(hwnd, className, 255);

    // Ignore shell system surfaces
    if (_wcsicmp(className, L"Progman") == 0 ||
        _wcsicmp(className, L"WorkerW") == 0 ||
        _wcsicmp(className, L"Shell_TrayWnd") == 0 ||
        _wcsicmp(className, L"Shell_SecondaryTrayWnd") == 0) {
        return TRUE;
    }

    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);

    // For ApplicationFrameHost (UWP apps like WhatsApp), resolve real child window PID
    if (_wcsicmp(className, L"ApplicationFrameWindow") == 0) {
        HWND hChild = FindWindowExW(hwnd, NULL, L"Windows.UI.Core.CoreWindow", NULL);
        if (hChild) {
            DWORD childPid = 0;
            GetWindowThreadProcessId(hChild, &childPid);
            if (childPid != 0) pid = childPid;
        }
    }

    if (pid != 0) {
        wchar_t title[512] = {0};
        GetWindowTextW(hwnd, title, 511);

        auto* list = reinterpret_cast<std::vector<WindowEntry>*>(lParam);
        list->push_back({ pid, WStringToUtf8(title), WStringToUtf8(className) });
    }

    return TRUE;
}

int main() {
    HWINSTA hWinSta = OpenWindowStationW(L"WinSta0", FALSE, MAXIMUM_ALLOWED);
    if (hWinSta) {
        SetProcessWindowStation(hWinSta);
        HDESK hDesk = OpenDesktopW(L"Default", 0, FALSE, MAXIMUM_ALLOWED);
        if (hDesk) {
            SetThreadDesktop(hDesk);
        }
    }

    std::vector<WindowEntry> entries;
    EnumWindows(EnumWindowsProc, (LPARAM)&entries);

    // Output UTF-8 JSON array
    std::cout << "[";
    for (size_t i = 0; i < entries.size(); ++i) {
        std::cout << "{\"pid\":" << entries[i].pid
                  << ",\"title\":\"" << JsonEscape(entries[i].title) << "\""
                  << ",\"className\":\"" << JsonEscape(entries[i].className) << "\"}";
        if (i + 1 < entries.size()) std::cout << ",";
    }
    std::cout << "]" << std::endl;

    return 0;
}
