#include "assignment_manager.hpp"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <windows.h>
#include <shlobj.h>

static std::string WStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

static std::wstring StringToWString(const std::string& str) {
    if (str.empty()) return L"";
    int size = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), (int)str.size(), NULL, 0);
    std::wstring wstr(size, 0);
    MultiByteToWideChar(CP_UTF8, 0, str.c_str(), (int)str.size(), &wstr[0], size);
    return wstr;
}

// Simple JSON escaping
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

std::string AssignmentManager::GetCurrentIsoTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    std::tm tm;
    gmtime_s(&tm, &now_c);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return std::string(buf);
}

AssignmentManager::AssignmentManager(const std::string& configFilePath)
    : m_configPath(configFilePath) {}

AssignmentManager::~AssignmentManager() {
    Save();
}

bool AssignmentManager::Load() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    std::ifstream file(m_configPath);
    if (!file.is_open()) {
        return false;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();

    // Basic JSON parser for assignments
    // Look for rules array and global config
    size_t rulesPos = content.find("\"rules\"");
    if (rulesPos != std::string::npos) {
        size_t arrayStart = content.find('[', rulesPos);
        size_t arrayEnd = content.find(']', arrayStart);
        if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
            std::string rulesStr = content.substr(arrayStart + 1, arrayEnd - arrayStart - 1);
            size_t objStart = 0;
            while ((objStart = rulesStr.find('{', objStart)) != std::string::npos) {
                size_t objEnd = rulesStr.find('}', objStart);
                if (objEnd == std::string::npos) break;
                std::string obj = rulesStr.substr(objStart, objEnd - objStart + 1);

                auto extractString = [&](const std::string& key) -> std::string {
                    size_t k = obj.find("\"" + key + "\"");
                    if (k == std::string::npos) return "";
                    size_t colon = obj.find(':', k);
                    if (colon == std::string::npos) return "";
                    size_t vStart = obj.find('"', colon);
                    if (vStart == std::string::npos) return "";
                    size_t vEnd = obj.find('"', vStart + 1);
                    if (vEnd == std::string::npos) return "";
                    return obj.substr(vStart + 1, vEnd - vStart - 1);
                };

                auto extractBool = [&](const std::string& key, bool def) -> bool {
                    size_t k = obj.find("\"" + key + "\"");
                    if (k == std::string::npos) return def;
                    size_t colon = obj.find(':', k);
                    if (colon == std::string::npos) return def;
                    if (obj.find("true", colon) < obj.find(',', colon)) return true;
                    if (obj.find("false", colon) < obj.find(',', colon)) return false;
                    return def;
                };

                AssignmentRule rule;
                rule.id = extractString("id");
                rule.applicationId = extractString("applicationId");
                rule.applicationName = StringToWString(extractString("applicationName"));
                rule.executablePath = StringToWString(extractString("executablePath"));
                rule.adapterId = extractString("adapterId");
                rule.adapterName = StringToWString(extractString("adapterName"));
                rule.enabled = extractBool("enabled", true);
                rule.fallbackMode = extractString("fallbackMode");
                if (rule.fallbackMode.empty()) rule.fallbackMode = "BLOCK";
                rule.status = "UNVERIFIED";
                rule.createdAt = extractString("createdAt");
                rule.updatedAt = extractString("updatedAt");

                if (!rule.applicationId.empty() && !rule.adapterId.empty()) {
                    m_rulesByAppId[rule.applicationId] = rule;
                }
                objStart = objEnd + 1;
            }
        }
    }

    return true;
}

bool AssignmentManager::Save() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);

    // Ensure parent directory exists
    size_t lastSlash = m_configPath.find_last_of("\\/");
    if (lastSlash != std::string::npos) {
        std::string dir = m_configPath.substr(0, lastSlash);
        std::wstring wdir = StringToWString(dir);
        CreateDirectoryW(wdir.c_str(), NULL);
    }

    std::string tmpPath = m_configPath + ".tmp";
    std::ofstream out(tmpPath);
    if (!out.is_open()) return false;

    out << "{\n";
    out << "  \"version\": 1,\n";
    out << "  \"updatedAt\": \"" << GetCurrentIsoTimestamp() << "\",\n";
    out << "  \"config\": {\n";
    out << "    \"defaultRoutingPolicy\": \"" << JsonEscape(m_config.defaultRoutingPolicy) << "\",\n";
    out << "    \"defaultAdapterId\": \"" << JsonEscape(m_config.defaultAdapterId) << "\",\n";
    out << "    \"adapterDisconnectBehavior\": \"" << JsonEscape(m_config.adapterDisconnectBehavior) << "\",\n";
    out << "    \"startWithWindows\": " << (m_config.startWithWindows ? "true" : "false") << ",\n";
    out << "    \"minimizeToTray\": " << (m_config.minimizeToTray ? "true" : "false") << ",\n";
    out << "    \"enableAuditLogging\": " << (m_config.enableAuditLogging ? "true" : "false") << ",\n";
    out << "    \"themeMode\": \"" << JsonEscape(m_config.themeMode) << "\"\n";
    out << "  },\n";
    out << "  \"rules\": [\n";

    size_t i = 0;
    for (const auto& pair : m_rulesByAppId) {
        const auto& r = pair.second;
        out << "    {\n";
        out << "      \"id\": \"" << JsonEscape(r.id) << "\",\n";
        out << "      \"applicationId\": \"" << JsonEscape(r.applicationId) << "\",\n";
        out << "      \"applicationName\": \"" << JsonEscape(WStringToString(r.applicationName)) << "\",\n";
        out << "      \"executablePath\": \"" << JsonEscape(WStringToString(r.executablePath)) << "\",\n";
        out << "      \"adapterId\": \"" << JsonEscape(r.adapterId) << "\",\n";
        out << "      \"adapterName\": \"" << JsonEscape(WStringToString(r.adapterName)) << "\",\n";
        out << "      \"enabled\": " << (r.enabled ? "true" : "false") << ",\n";
        out << "      \"fallbackMode\": \"" << JsonEscape(r.fallbackMode) << "\",\n";
        out << "      \"status\": \"" << JsonEscape(r.status) << "\",\n";
        out << "      \"createdAt\": \"" << JsonEscape(r.createdAt) << "\",\n";
        out << "      \"updatedAt\": \"" << JsonEscape(r.updatedAt) << "\"\n";
        out << "    }" << (i + 1 < m_rulesByAppId.size() ? "," : "") << "\n";
        i++;
    }

    out << "  ]\n";
    out << "}\n";
    out.close();

    // Atomic rename
    std::wstring wtmp = StringToWString(tmpPath);
    std::wstring wdst = StringToWString(m_configPath);
    return MoveFileExW(wtmp.c_str(), wdst.c_str(), MOVEFILE_REPLACE_EXISTING) != 0;
}

bool AssignmentManager::SetAssignment(const std::string& applicationId,
                                     const std::wstring& appName,
                                     const std::wstring& executablePath,
                                     const std::string& adapterId,
                                     const std::wstring& adapterName,
                                     const std::string& fallbackMode,
                                     AssignmentRule& outRule,
                                     std::string& outError) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);

    if (applicationId.empty()) {
        outError = "applicationId cannot be empty";
        return false;
    }
    if (adapterId.empty()) {
        outError = "adapterId cannot be empty";
        return false;
    }

    std::string timestamp = GetCurrentIsoTimestamp();
    auto it = m_rulesByAppId.find(applicationId);
    if (it != m_rulesByAppId.end()) {
        // Atomic replacement of existing rule for this application
        it->second.adapterId = adapterId;
        it->second.adapterName = adapterName;
        it->second.fallbackMode = fallbackMode.empty() ? "BLOCK" : fallbackMode;
        it->second.updatedAt = timestamp;
        it->second.status = "UNVERIFIED";
        outRule = it->second;
    } else {
        // Create new rule
        AssignmentRule newRule;
        newRule.id = "rule-" + applicationId.substr(0, std::min<size_t>(applicationId.size(), 12)) + "-" + std::to_string(GetTickCount64() % 10000);
        newRule.applicationId = applicationId;
        newRule.applicationName = appName;
        newRule.executablePath = executablePath;
        newRule.adapterId = adapterId;
        newRule.adapterName = adapterName;
        newRule.fallbackMode = fallbackMode.empty() ? "BLOCK" : fallbackMode;
        newRule.enabled = true;
        newRule.status = "UNVERIFIED";
        newRule.createdAt = timestamp;
        newRule.updatedAt = timestamp;

        m_rulesByAppId[applicationId] = newRule;
        outRule = newRule;
    }

    Save();
    return true;
}

bool AssignmentManager::RemoveAssignment(const std::string& applicationId, std::string& outError) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    auto it = m_rulesByAppId.find(applicationId);
    if (it == m_rulesByAppId.end()) {
        outError = "No assignment found for application: " + applicationId;
        return false;
    }
    m_rulesByAppId.erase(it);
    Save();
    return true;
}

bool AssignmentManager::SetRuleEnabled(const std::string& ruleId, bool enabled, std::string& outError) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    for (auto& pair : m_rulesByAppId) {
        if (pair.second.id == ruleId) {
            pair.second.enabled = enabled;
            pair.second.updatedAt = GetCurrentIsoTimestamp();
            pair.second.status = enabled ? "UNVERIFIED" : "INACTIVE";
            Save();
            return true;
        }
    }
    outError = "Rule not found: " + ruleId;
    return false;
}

void AssignmentManager::UpdateRuleStatus(const std::string& ruleId, const std::string& status, const std::string& error) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    for (auto& pair : m_rulesByAppId) {
        if (pair.second.id == ruleId) {
            pair.second.status = status;
            pair.second.lastError = error;
            pair.second.lastVerifiedAt = GetCurrentIsoTimestamp();
            break;
        }
    }
}

std::vector<AssignmentRule> AssignmentManager::GetAllRules() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    std::vector<AssignmentRule> list;
    list.reserve(m_rulesByAppId.size());
    for (const auto& pair : m_rulesByAppId) {
        list.push_back(pair.second);
    }
    return list;
}

AssignmentRule* AssignmentManager::FindRuleByAppId(const std::string& appId) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    auto it = m_rulesByAppId.find(appId);
    if (it != m_rulesByAppId.end()) return &(it->second);
    return nullptr;
}

AssignmentRule* AssignmentManager::FindRuleById(const std::string& ruleId) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    for (auto& pair : m_rulesByAppId) {
        if (pair.second.id == ruleId) return &(pair.second);
    }
    return nullptr;
}

std::vector<AssignmentRule> AssignmentManager::FindRulesByAdapter(const std::string& adapterId) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    std::vector<AssignmentRule> list;
    for (const auto& pair : m_rulesByAppId) {
        if (pair.second.adapterId == adapterId) {
            list.push_back(pair.second);
        }
    }
    return list;
}

GlobalConfig AssignmentManager::GetGlobalConfig() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    return m_config;
}

void AssignmentManager::SetGlobalConfig(const GlobalConfig& config) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    m_config = config;
    Save();
}
