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

static std::string UnescapeJsonString(const std::string& in) {
    std::string out;
    out.reserve(in.size());
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '\\' && i + 1 < in.size()) {
            char next = in[i + 1];
            if (next == '\\') { out += '\\'; i++; }
            else if (next == '"') { out += '"'; i++; }
            else if (next == '/') { out += '/'; i++; }
            else if (next == 'n') { out += '\n'; i++; }
            else if (next == 'r') { out += '\r'; i++; }
            else if (next == 't') { out += '\t'; i++; }
            else { out += in[i]; }
        } else {
            out += in[i];
        }
    }
    return out;
}

static std::string ExtractJsonStr(const std::string& obj, const std::string& key) {
    size_t k = obj.find("\"" + key + "\"");
    if (k == std::string::npos) return "";
    size_t colon = obj.find(':', k);
    if (colon == std::string::npos) return "";
    size_t vStart = obj.find('"', colon);
    if (vStart == std::string::npos) return "";
    size_t vEnd = vStart + 1;
    bool inEscape = false;
    while (vEnd < obj.size()) {
        if (inEscape) {
            inEscape = false;
        } else if (obj[vEnd] == '\\') {
            inEscape = true;
        } else if (obj[vEnd] == '"') {
            break;
        }
        vEnd++;
    }
    if (vEnd >= obj.size()) return "";
    return UnescapeJsonString(obj.substr(vStart + 1, vEnd - vStart - 1));
}

static bool ExtractJsonBoolVal(const std::string& obj, const std::string& key, bool def) {
    size_t k = obj.find("\"" + key + "\"");
    if (k == std::string::npos) return def;
    size_t colon = obj.find(':', k);
    if (colon == std::string::npos) return def;
    size_t truePos = obj.find("true", colon);
    size_t falsePos = obj.find("false", colon);
    size_t commaPos = obj.find(',', colon);
    size_t bracePos = obj.find('}', colon);
    size_t endPos = (commaPos < bracePos) ? commaPos : bracePos;

    if (truePos != std::string::npos && (endPos == std::string::npos || truePos < endPos)) return true;
    if (falsePos != std::string::npos && (endPos == std::string::npos || falsePos < endPos)) return false;
    return def;
}

static std::vector<std::string> ExtractObjectsFromArray(const std::string& json, const std::string& arrayKey) {
    std::vector<std::string> results;
    size_t k = json.find("\"" + arrayKey + "\"");
    if (k == std::string::npos) return results;

    size_t arrStart = json.find('[', k);
    if (arrStart == std::string::npos) return results;

    bool inString = false;
    bool escape = false;
    int braceDepth = 0;
    size_t itemStart = std::string::npos;

    for (size_t i = arrStart + 1; i < json.size(); ++i) {
        char c = json[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (c == '\\') {
                escape = true;
            } else if (c == '"') {
                inString = false;
            }
        } else {
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                if (braceDepth == 0) itemStart = i;
                braceDepth++;
            } else if (c == '}') {
                braceDepth--;
                if (braceDepth == 0 && itemStart != std::string::npos) {
                    results.push_back(json.substr(itemStart, i - itemStart + 1));
                    itemStart = std::string::npos;
                }
            } else if (c == ']' && braceDepth == 0) {
                break;
            }
        }
    }
    return results;
}

static void UpdateWindowsStartupRegistry(bool enable) {
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_SET_VALUE, &hKey) == ERROR_SUCCESS) {
        if (enable) {
            wchar_t exePath[MAX_PATH];
            GetModuleFileNameW(NULL, exePath, MAX_PATH);
            std::wstring cmd = L"\"";
            cmd += exePath;
            cmd += L"\" --background";
            RegSetValueExW(hKey, L"NetSplitService", 0, REG_SZ, (const BYTE*)cmd.c_str(), (DWORD)((cmd.size() + 1) * sizeof(wchar_t)));
        } else {
            RegDeleteValueW(hKey, L"NetSplitService");
        }
        RegCloseKey(hKey);
    }
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
        wchar_t commonPath[MAX_PATH];
        if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_COMMON_APPDATA, NULL, 0, commonPath))) {
            std::wstring wCommonFile = std::wstring(commonPath) + L"\\NetSplit\\config.json";
            file.open(WStringToString(wCommonFile));
        }
    }
    if (!file.is_open()) {
        return false;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();
    file.close();

    // 1. Load global config
    size_t cfgPos = content.find("\"config\"");
    if (cfgPos != std::string::npos) {
        size_t cfgObjStart = content.find('{', cfgPos);
        if (cfgObjStart != std::string::npos) {
            bool inStr = false, esc = false;
            int depth = 0;
            size_t cfgObjEnd = std::string::npos;
            for (size_t i = cfgObjStart; i < content.size(); ++i) {
                char c = content[i];
                if (inStr) {
                    if (esc) esc = false;
                    else if (c == '\\') esc = true;
                    else if (c == '"') inStr = false;
                } else {
                    if (c == '"') inStr = true;
                    else if (c == '{') depth++;
                    else if (c == '}') {
                        depth--;
                        if (depth == 0) {
                            cfgObjEnd = i;
                            break;
                        }
                    }
                }
            }

            if (cfgObjEnd != std::string::npos) {
                std::string cfgStr = content.substr(cfgObjStart, cfgObjEnd - cfgObjStart + 1);
                std::string drp = ExtractJsonStr(cfgStr, "defaultRoutingPolicy");
                if (!drp.empty()) m_config.defaultRoutingPolicy = drp;

                std::string daId = ExtractJsonStr(cfgStr, "defaultAdapterId");
                if (!daId.empty()) m_config.defaultAdapterId = daId;

                std::string adb = ExtractJsonStr(cfgStr, "adapterDisconnectBehavior");
                if (!adb.empty()) m_config.adapterDisconnectBehavior = adb;

                std::string tm = ExtractJsonStr(cfgStr, "themeMode");
                if (!tm.empty()) m_config.themeMode = tm;

                m_config.startWithWindows = ExtractJsonBoolVal(cfgStr, "startWithWindows", m_config.startWithWindows);
                m_config.minimizeToTray = ExtractJsonBoolVal(cfgStr, "minimizeToTray", m_config.minimizeToTray);
                m_config.enableAuditLogging = ExtractJsonBoolVal(cfgStr, "enableAuditLogging", m_config.enableAuditLogging);
            }
        }
    }

    // 2. Load rules (quote-aware, GUID safe)
    std::vector<std::string> ruleObjs = ExtractObjectsFromArray(content, "rules");
    for (const auto& obj : ruleObjs) {
        AssignmentRule rule;
        rule.id = ExtractJsonStr(obj, "id");
        rule.applicationId = ExtractJsonStr(obj, "applicationId");
        rule.applicationName = StringToWString(ExtractJsonStr(obj, "applicationName"));
        rule.executablePath = StringToWString(ExtractJsonStr(obj, "executablePath"));
        rule.adapterId = ExtractJsonStr(obj, "adapterId");
        rule.adapterName = StringToWString(ExtractJsonStr(obj, "adapterName"));
        rule.enabled = ExtractJsonBoolVal(obj, "enabled", true);
        rule.fallbackMode = ExtractJsonStr(obj, "fallbackMode");
        if (rule.fallbackMode.empty()) rule.fallbackMode = "WINDOWS_DEFAULT";
        rule.status = "UNVERIFIED";
        rule.createdAt = ExtractJsonStr(obj, "createdAt");
        rule.updatedAt = ExtractJsonStr(obj, "updatedAt");

        if (!rule.applicationId.empty() && !rule.adapterId.empty()) {
            m_rulesByAppId[rule.applicationId] = rule;
        }
    }

    UpdateWindowsStartupRegistry(m_config.startWithWindows);
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
    bool ok = MoveFileExW(wtmp.c_str(), wdst.c_str(), MOVEFILE_REPLACE_EXISTING) != 0;

    // Also mirror to ProgramData if accessible so service has access when running as system service
    wchar_t commonPath[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_COMMON_APPDATA, NULL, 0, commonPath))) {
        std::wstring wCommonDir = std::wstring(commonPath) + L"\\NetSplit";
        CreateDirectoryW(wCommonDir.c_str(), NULL);
        std::wstring wCommonFile = wCommonDir + L"\\config.json";
        CopyFileW(wdst.c_str(), wCommonFile.c_str(), FALSE);
    }

    return ok;
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
        it->second.fallbackMode = fallbackMode.empty() ? "WINDOWS_DEFAULT" : fallbackMode;
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
        newRule.fallbackMode = fallbackMode.empty() ? "WINDOWS_DEFAULT" : fallbackMode;
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
    UpdateWindowsStartupRegistry(m_config.startWithWindows);
    Save();
}
