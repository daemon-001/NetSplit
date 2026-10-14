#pragma once
#include "common_net.hpp"

struct DiscoveredApp {
    std::string id;               // Normalized key / hash
    std::wstring name;
    std::wstring executablePath;
    std::wstring normalizedPath;
    std::wstring publisher;
    std::wstring version;
    std::string iconBase64;
    std::vector<DWORD> processIds;
    bool isRunning = false;
    bool isSystemProcess = false;
    bool isManual = false;
};

class AppDiscoveryManager {
public:
    AppDiscoveryManager();
    ~AppDiscoveryManager();

    bool Initialize();
    void ScanRunningProcesses();
    void ScanInstalledApps();
    bool AddManualExecutable(const std::wstring& path, const std::wstring& customName = L"");

    std::vector<DiscoveredApp> GetAllApps();
    DiscoveredApp* FindAppById(const std::string& appId);
    DiscoveredApp* FindAppByPath(const std::wstring& path);

    static std::wstring NormalizePath(const std::wstring& path);
    static std::string ComputeAppId(const std::wstring& normalizedPath);

private:
    std::unordered_map<std::string, DiscoveredApp> m_apps;
    std::mutex m_mutex;

    void ExtractMetadata(DiscoveredApp& app);
    void ScanRegistryKey(HKEY rootKey, const wchar_t* subKey);
};
