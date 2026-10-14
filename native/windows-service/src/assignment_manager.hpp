#pragma once
#include "common_net.hpp"

struct AssignmentRule {
    std::string id;               // rule-xxx
    std::string applicationId;    // app-xxx
    std::wstring applicationName;
    std::wstring executablePath;
    std::string adapterId;        // Adapter GUID or index
    std::wstring adapterName;
    bool enabled = true;
    std::string fallbackMode = "BLOCK"; // "BLOCK" or "WINDOWS_DEFAULT"
    std::string status = "UNVERIFIED";  // "ACTIVE", "INACTIVE", "ERROR", "UNVERIFIED"
    std::string lastVerifiedAt;
    std::string lastError;
    std::string createdAt;
    std::string updatedAt;
};

struct GlobalConfig {
    std::string defaultRoutingPolicy = "WINDOWS_DEFAULT"; // or "PREFER_ADAPTER"
    std::string defaultAdapterId = "";
    std::string adapterDisconnectBehavior = "BLOCK";       // "BLOCK" or "FALLBACK"
    bool startWithWindows = true;
    bool minimizeToTray = true;
    bool enableAuditLogging = true;
    std::string themeMode = "DARK";
};

class AssignmentManager {
public:
    AssignmentManager(const std::string& configFilePath);
    ~AssignmentManager();

    bool Load();
    bool Save();

    // Strict single assignment operations
    bool SetAssignment(const std::string& applicationId,
                       const std::wstring& appName,
                       const std::wstring& executablePath,
                       const std::string& adapterId,
                       const std::wstring& adapterName,
                       const std::string& fallbackMode,
                       AssignmentRule& outRule,
                       std::string& outError);

    bool RemoveAssignment(const std::string& applicationId, std::string& outError);
    bool SetRuleEnabled(const std::string& ruleId, bool enabled, std::string& outError);
    void UpdateRuleStatus(const std::string& ruleId, const std::string& status, const std::string& error = "");

    std::vector<AssignmentRule> GetAllRules();
    AssignmentRule* FindRuleByAppId(const std::string& appId);
    AssignmentRule* FindRuleById(const std::string& ruleId);
    std::vector<AssignmentRule> FindRulesByAdapter(const std::string& adapterId);

    GlobalConfig GetGlobalConfig();
    void SetGlobalConfig(const GlobalConfig& config);

private:
    std::string m_configPath;
    std::unordered_map<std::string, AssignmentRule> m_rulesByAppId;
    GlobalConfig m_config;
    std::recursive_mutex m_mutex;

    static std::string GetCurrentIsoTimestamp();
};
