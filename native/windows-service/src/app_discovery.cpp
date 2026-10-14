#include "app_discovery.hpp"
#include <tlhelp32.h>
#include <psapi.h>
#include <algorithm>
#include <cwctype>
#include <sstream>
#include <iomanip>
#include <set>
#include <shlwapi.h>

#pragma comment(lib, "shlwapi.lib")

static std::string WStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

std::wstring AppDiscoveryManager::NormalizePath(const std::wstring& path) {
    if (path.empty()) return L"";
    std::wstring normalized = path;

    // Replace forward slashes with backslashes
    std::replace(normalized.begin(), normalized.end(), L'/', L'\\');

    // Convert to lowercase for case-insensitive Windows filesystem matching
    std::transform(normalized.begin(), normalized.end(), normalized.begin(), ::towlower);

    // Remove surrounding quotes or whitespace
    while (!normalized.empty() && (normalized.front() == L' ' || normalized.front() == L'"')) {
        normalized.erase(normalized.begin());
    }
    while (!normalized.empty() && (normalized.back() == L' ' || normalized.back() == L'"')) {
        normalized.pop_back();
    }

    return normalized;
}

std::string AppDiscoveryManager::ComputeAppId(const std::wstring& normalizedPath) {
    // Generate FNV-1a 64-bit hash of normalized path for compact stable identifier
    unsigned __int64 hash = 14695981039346656037ULL;
    for (wchar_t wc : normalizedPath) {
        hash ^= (unsigned __int64)(wc & 0xFF);
        hash *= 1099511628211ULL;
        hash ^= (unsigned __int64)((wc >> 8) & 0xFF);
        hash *= 1099511628211ULL;
    }
    std::stringstream ss;
    ss << "app-" << std::hex << std::setw(16) << std::setfill('0') << hash;
    return ss.str();
}

AppDiscoveryManager::AppDiscoveryManager() {}

AppDiscoveryManager::~AppDiscoveryManager() {}

bool AppDiscoveryManager::Initialize() {
    ScanInstalledApps();
    ScanRunningProcesses();
    return true;
}

void AppDiscoveryManager::ExtractMetadata(DiscoveredApp& app) {
    DWORD handle = 0;
    DWORD size = GetFileVersionInfoSizeW(app.executablePath.c_str(), &handle);
    if (size > 0) {
        std::vector<BYTE> data(size);
        if (GetFileVersionInfoW(app.executablePath.c_str(), 0, size, data.data())) {
            struct LANGANDCODEPAGE {
                WORD wLanguage;
                WORD wCodePage;
            } *lpTranslate;
            UINT cbTranslate = 0;

            if (VerQueryValueW(data.data(), L"\\VarFileInfo\\Translation", (LPVOID*)&lpTranslate, &cbTranslate) && cbTranslate >= sizeof(LANGANDCODEPAGE)) {
                wchar_t subBlock[128];
                LPVOID lpBuffer = NULL;
                UINT dwBytes = 0;

                // FileDescription
                swprintf_s(subBlock, L"\\StringFileInfo\\%04x%04x\\FileDescription", lpTranslate[0].wLanguage, lpTranslate[0].wCodePage);
                if (VerQueryValueW(data.data(), subBlock, &lpBuffer, &dwBytes) && dwBytes > 0 && lpBuffer) {
                    if (app.name.empty() || app.name == PathFindFileNameW(app.executablePath.c_str())) {
                        app.name = (wchar_t*)lpBuffer;
                    }
                }

                // ProductName fallback
                if (app.name.empty()) {
                    swprintf_s(subBlock, L"\\StringFileInfo\\%04x%04x\\ProductName", lpTranslate[0].wLanguage, lpTranslate[0].wCodePage);
                    if (VerQueryValueW(data.data(), subBlock, &lpBuffer, &dwBytes) && dwBytes > 0 && lpBuffer) {
                        app.name = (wchar_t*)lpBuffer;
                    }
                }

                // CompanyName
                swprintf_s(subBlock, L"\\StringFileInfo\\%04x%04x\\CompanyName", lpTranslate[0].wLanguage, lpTranslate[0].wCodePage);
                if (VerQueryValueW(data.data(), subBlock, &lpBuffer, &dwBytes) && dwBytes > 0 && lpBuffer) {
                    app.publisher = (wchar_t*)lpBuffer;
                }

                // ProductVersion
                swprintf_s(subBlock, L"\\StringFileInfo\\%04x%04x\\ProductVersion", lpTranslate[0].wLanguage, lpTranslate[0].wCodePage);
                if (VerQueryValueW(data.data(), subBlock, &lpBuffer, &dwBytes) && dwBytes > 0 && lpBuffer) {
                    app.version = (wchar_t*)lpBuffer;
                }
            }
        }
    }

    if (app.name.empty()) {
        app.name = PathFindFileNameW(app.executablePath.c_str());
        // Strip extension
        size_t dotPos = app.name.find_last_of(L'.');
        if (dotPos != std::wstring::npos) {
            app.name = app.name.substr(0, dotPos);
        }
    }
}

static BOOL CALLBACK CollectVisibleWindowPids(HWND hwnd, LPARAM lParam) {
    if (!IsWindowVisible(hwnd)) return TRUE;
    if (GetWindowTextLengthW(hwnd) == 0) return TRUE;
    LONG exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
    if (exStyle & WS_EX_TOOLWINDOW) return TRUE;
    if (GetWindow(hwnd, GW_OWNER) != NULL) return TRUE;

    RECT rc;
    if (GetWindowRect(hwnd, &rc)) {
        if ((rc.right - rc.left) <= 0 || (rc.bottom - rc.top) <= 0) return TRUE;
    }

    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    if (pid != 0) {
        auto* pids = reinterpret_cast<std::set<DWORD>*>(lParam);
        pids->insert(pid);
    }
    return TRUE;
}

void AppDiscoveryManager::ScanRunningProcesses() {
    std::lock_guard<std::mutex> lock(m_mutex);

    // Reset running status across all tracked apps
    for (auto& pair : m_apps) {
        pair.second.isRunning = false;
        pair.second.hasVisibleWindow = false;
        pair.second.processIds.clear();
    }

    HWINSTA hOrigStation = GetProcessWindowStation();
    HDESK hOrigDesk = GetThreadDesktop(GetCurrentThreadId());

    HWINSTA hWinSta = OpenWindowStationW(L"WinSta0", FALSE, MAXIMUM_ALLOWED);
    HDESK hDesk = NULL;
    if (hWinSta) {
        SetProcessWindowStation(hWinSta);
        hDesk = OpenDesktopW(L"Default", 0, FALSE, MAXIMUM_ALLOWED);
        if (hDesk) {
            SetThreadDesktop(hDesk);
        }
    }

    std::set<DWORD> windowPids;
    EnumWindows(CollectVisibleWindowPids, (LPARAM)&windowPids);

    if (hOrigDesk) SetThreadDesktop(hOrigDesk);
    if (hOrigStation) SetProcessWindowStation(hOrigStation);
    if (hDesk) CloseDesktop(hDesk);
    if (hWinSta) CloseWindowStation(hWinSta);

    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);

    if (Process32FirstW(hSnapshot, &pe)) {
        do {
            if (pe.th32ProcessID <= 4) continue; // Skip System and Idle

            HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pe.th32ProcessID);
            if (!hProcess) continue;

            wchar_t exePath[MAX_PATH * 2] = {0};
            DWORD size = sizeof(exePath) / sizeof(wchar_t);
            if (QueryFullProcessImageNameW(hProcess, 0, exePath, &size) && size > 0) {
                std::wstring norm = NormalizePath(exePath);
                std::string appId = ComputeAppId(norm);

                auto it = m_apps.find(appId);
                if (it != m_apps.end()) {
                    it->second.isRunning = true;
                    it->second.processIds.push_back(pe.th32ProcessID);
                    if (windowPids.find(pe.th32ProcessID) != windowPids.end()) {
                        it->second.hasVisibleWindow = true;
                    }
                } else {
                    DiscoveredApp newApp;
                    newApp.id = appId;
                    newApp.executablePath = exePath;
                    newApp.normalizedPath = norm;
                    newApp.isRunning = true;
                    newApp.processIds.push_back(pe.th32ProcessID);
                    if (windowPids.find(pe.th32ProcessID) != windowPids.end()) {
                        newApp.hasVisibleWindow = true;
                    }

                    // Check if system directory
                    if (norm.find(L"\\windows\\system32\\") != std::wstring::npos ||
                        norm.find(L"\\windows\\syswow64\\") != std::wstring::npos) {
                        newApp.isSystemProcess = true;
                    }

                    ExtractMetadata(newApp);
                    m_apps[appId] = newApp;
                }
            }
            CloseHandle(hProcess);
        } while (Process32NextW(hSnapshot, &pe));
    }

    CloseHandle(hSnapshot);
}

void AppDiscoveryManager::ScanRegistryKey(HKEY rootKey, const wchar_t* subKey) {
    HKEY hKey;
    if (RegOpenKeyExW(rootKey, subKey, 0, KEY_READ, &hKey) != ERROR_SUCCESS) return;

    DWORD index = 0;
    wchar_t subKeyName[256];
    DWORD subKeyNameLen = sizeof(subKeyName) / sizeof(wchar_t);

    while (RegEnumKeyExW(hKey, index, subKeyName, &subKeyNameLen, NULL, NULL, NULL, NULL) == ERROR_SUCCESS) {
        HKEY hAppKey;
        if (RegOpenKeyExW(hKey, subKeyName, 0, KEY_READ, &hAppKey) == ERROR_SUCCESS) {
            wchar_t displayName[256] = {0};
            DWORD dnLen = sizeof(displayName);
            wchar_t installLocation[MAX_PATH] = {0};
            DWORD ilLen = sizeof(installLocation);
            wchar_t displayIcon[MAX_PATH] = {0};
            DWORD diLen = sizeof(displayIcon);
            wchar_t publisher[256] = {0};
            DWORD pubLen = sizeof(publisher);
            wchar_t version[64] = {0};
            DWORD verLen = sizeof(version);

            RegQueryValueExW(hAppKey, L"DisplayName", NULL, NULL, (LPBYTE)displayName, &dnLen);
            RegQueryValueExW(hAppKey, L"InstallLocation", NULL, NULL, (LPBYTE)installLocation, &ilLen);
            RegQueryValueExW(hAppKey, L"DisplayIcon", NULL, NULL, (LPBYTE)displayIcon, &diLen);
            RegQueryValueExW(hAppKey, L"Publisher", NULL, NULL, (LPBYTE)publisher, &pubLen);
            RegQueryValueExW(hAppKey, L"DisplayVersion", NULL, NULL, (LPBYTE)version, &verLen);

            std::wstring targetExe;
            if (wcslen(displayIcon) > 0) {
                wchar_t iconClean[MAX_PATH];
                wcscpy_s(iconClean, displayIcon);
                wchar_t* comma = wcschr(iconClean, L',');
                if (comma) *comma = L'\0';
                if (PathFileExistsW(iconClean) && wcsstr(iconClean, L".exe")) {
                    targetExe = iconClean;
                }
            }

            if (!targetExe.empty()) {
                std::wstring norm = NormalizePath(targetExe);
                std::string appId = ComputeAppId(norm);

                if (m_apps.find(appId) == m_apps.end()) {
                    DiscoveredApp app;
                    app.id = appId;
                    app.name = (wcslen(displayName) > 0 ? displayName : PathFindFileNameW(targetExe.c_str()));
                    app.executablePath = targetExe;
                    app.normalizedPath = norm;
                    app.publisher = publisher;
                    app.version = version;
                    app.isRunning = false;
                    app.isSystemProcess = false;
                    m_apps[appId] = app;
                }
            }
            RegCloseKey(hAppKey);
        }
        index++;
        subKeyNameLen = sizeof(subKeyName) / sizeof(wchar_t);
    }
    RegCloseKey(hKey);
}

void AppDiscoveryManager::ScanInstalledApps() {
    std::lock_guard<std::mutex> lock(m_mutex);

    ScanRegistryKey(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
    ScanRegistryKey(HKEY_LOCAL_MACHINE, L"SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
    ScanRegistryKey(HKEY_CURRENT_USER, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
}

bool AppDiscoveryManager::AddManualExecutable(const std::wstring& path, const std::wstring& customName) {
    std::lock_guard<std::mutex> lock(m_mutex);

    if (!PathFileExistsW(path.c_str())) return false;

    std::wstring norm = NormalizePath(path);
    std::string appId = ComputeAppId(norm);

    DiscoveredApp app;
    app.id = appId;
    app.executablePath = path;
    app.normalizedPath = norm;
    app.name = customName.empty() ? PathFindFileNameW(path.c_str()) : customName;
    app.isManual = true;
    app.isSystemProcess = false;

    ExtractMetadata(app);
    m_apps[appId] = app;
    return true;
}

std::vector<DiscoveredApp> AppDiscoveryManager::GetAllApps() {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<DiscoveredApp> list;
    list.reserve(m_apps.size());
    for (const auto& pair : m_apps) {
        list.push_back(pair.second);
    }
    return list;
}

DiscoveredApp* AppDiscoveryManager::FindAppById(const std::string& appId) {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto it = m_apps.find(appId);
    if (it != m_apps.end()) return &(it->second);
    return nullptr;
}

DiscoveredApp* AppDiscoveryManager::FindAppByPath(const std::wstring& path) {
    std::wstring norm = NormalizePath(path);
    std::string appId = ComputeAppId(norm);
    return FindAppById(appId);
}
