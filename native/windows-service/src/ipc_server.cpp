#include "ipc_server.hpp"
#include <bcrypt.h>
#include <sstream>
#include <fstream>
#include <iomanip>
#include <ctime>
#include <chrono>
#include <algorithm>

#pragma comment(lib, "bcrypt.lib")

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

static std::string ExtractJsonValue(const std::string& json, const std::string& key) {
    size_t k = json.find("\"" + key + "\"");
    if (k == std::string::npos) return "";
    size_t colon = json.find(':', k);
    if (colon == std::string::npos) return "";
    size_t vStart = json.find('"', colon);
    if (vStart == std::string::npos) return "";
    size_t vEnd = vStart + 1;
    while (vEnd < json.size()) {
        if (json[vEnd] == '"' && json[vEnd - 1] != '\\') {
            break;
        }
        vEnd++;
    }
    if (vEnd >= json.size()) return "";
    return UnescapeJsonString(json.substr(vStart + 1, vEnd - vStart - 1));
}

static bool ExtractJsonBool(const std::string& json, const std::string& key, bool def) {
    size_t k = json.find("\"" + key + "\"");
    if (k == std::string::npos) return def;
    size_t colon = json.find(':', k);
    if (colon == std::string::npos) return def;
    if (json.find("true", colon) < json.find(',', colon) && json.find("true", colon) < json.find('}', colon)) return true;
    if (json.find("false", colon) < json.find(',', colon) && json.find("false", colon) < json.find('}', colon)) return false;
    return def;
}

static std::vector<std::string> ExtractJsonObjectsFromArray(const std::string& json, const std::string& arrayKey) {
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
                if (braceDepth == 0) {
                    itemStart = i;
                }
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

static bool IsProcessElevated() {
    BOOL isElevated = FALSE;
    HANDLE hToken = NULL;
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
        TOKEN_ELEVATION elevation;
        DWORD cbSize = sizeof(TOKEN_ELEVATION);
        if (GetTokenInformation(hToken, TokenElevation, &elevation, sizeof(elevation), &cbSize)) {
            isElevated = elevation.TokenIsElevated != 0;
        }

        if (!isElevated) {
            BYTE adminSid[SECURITY_MAX_SID_SIZE];
            DWORD sidSize = sizeof(adminSid);
            if (CreateWellKnownSid(WinBuiltinAdministratorsSid, NULL, adminSid, &sidSize)) {
                BOOL isMember = FALSE;
                if (CheckTokenMembership(NULL, adminSid, &isMember) && isMember) {
                    isElevated = TRUE;
                }
            }

            BYTE systemSid[SECURITY_MAX_SID_SIZE];
            sidSize = sizeof(systemSid);
            if (!isElevated && CreateWellKnownSid(WinLocalSystemSid, NULL, systemSid, &sidSize)) {
                BOOL isMember = FALSE;
                if (CheckTokenMembership(NULL, systemSid, &isMember) && isMember) {
                    isElevated = TRUE;
                }
            }
        }
        CloseHandle(hToken);
    }
    return isElevated != 0;
}

IpcServer::IpcServer(int port,
                     const std::string& tokenFilePath,
                     AdapterManager* pAdapterMgr,
                     AppDiscoveryManager* pAppMgr,
                     AssignmentManager* pAssignMgr,
                     WfpRoutingEngine* pRoutingEngine)
    : m_port(port),
      m_tokenFilePath(tokenFilePath),
      m_pAdapterMgr(pAdapterMgr),
      m_pAppMgr(pAppMgr),
      m_pAssignMgr(pAssignMgr),
      m_pRoutingEngine(pRoutingEngine) {}

IpcServer::~IpcServer() {
    Stop();
}

void IpcServer::GenerateAndSaveToken() {
    BYTE randBytes[32];
    BCryptGenRandom(NULL, randBytes, sizeof(randBytes), BCRYPT_USE_SYSTEM_PREFERRED_RNG);

    std::stringstream ss;
    for (int i = 0; i < sizeof(randBytes); ++i) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)randBytes[i];
    }
    m_authToken = ss.str();

    // Ensure directory exists
    size_t lastSlash = m_tokenFilePath.find_last_of("\\/");
    if (lastSlash != std::string::npos) {
        std::string dir = m_tokenFilePath.substr(0, lastSlash);
        CreateDirectoryW(StringToWString(dir).c_str(), NULL);
    }

    std::ofstream tokenFile(m_tokenFilePath);
    if (tokenFile.is_open()) {
        tokenFile << m_authToken;
        tokenFile.close();
    }

    // Mirror token to LOCALAPPDATA so user apps and tests can read it
    wchar_t localPath[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, localPath))) {
        std::wstring wLocal = std::wstring(localPath) + L"\\NetSplit";
        CreateDirectoryW(wLocal.c_str(), NULL);
        std::string localTokenFile = WStringToString(wLocal + L"\\ipc_auth.token");
        if (localTokenFile != m_tokenFilePath) {
            std::ofstream lFile(localTokenFile);
            if (lFile.is_open()) {
                lFile << m_authToken;
                lFile.close();
            }
        }
    }

    // Mirror token to COMMON_APPDATA (ProgramData)
    wchar_t commonPath[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_COMMON_APPDATA, NULL, 0, commonPath))) {
        std::wstring wCommon = std::wstring(commonPath) + L"\\NetSplit";
        CreateDirectoryW(wCommon.c_str(), NULL);
        std::string commonTokenFile = WStringToString(wCommon + L"\\ipc_auth.token");
        if (commonTokenFile != m_tokenFilePath) {
            std::ofstream cFile(commonTokenFile);
            if (cFile.is_open()) {
                cFile << m_authToken;
                cFile.close();
            }
        }
    }

    printf("[IPC Server] Ephemeral token saved to: %s\n", m_tokenFilePath.c_str());
}

void IpcServer::LogActivity(const std::string& level, const std::string& category, const std::string& title, const std::string& message) {
    std::lock_guard<std::mutex> lock(m_activityMutex);

    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    std::tm tm;
    gmtime_s(&tm, &now_c);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);

    ActivityLogEntry entry;
    entry.id = "act-" + std::to_string(GetTickCount64());
    entry.timestamp = buf;
    entry.level = level;
    entry.category = category;
    entry.title = title;
    entry.message = message;

    m_activities.push_back(entry);
    if (m_activities.size() > 500) {
        m_activities.erase(m_activities.begin());
    }
}

bool IpcServer::Start() {
    m_listenSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (m_listenSock == INVALID_SOCKET) return false;

    sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(m_port);

    if (bind(m_listenSock, (SOCKADDR*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        printf("[IPC Server] Failed to bind to 127.0.0.1:%d (Error: %d)\n", m_port, WSAGetLastError());
        closesocket(m_listenSock);
        m_listenSock = INVALID_SOCKET;
        return false;
    }

    if (listen(m_listenSock, SOMAXCONN) == SOCKET_ERROR) {
        closesocket(m_listenSock);
        m_listenSock = INVALID_SOCKET;
        return false;
    }

    // Only generate & write token once socket is successfully listening
    GenerateAndSaveToken();

    m_running = true;
    m_serverThread = std::thread(&IpcServer::ServerLoop, this);

    LogActivity("INFO", "SERVICE", "NetSplit Service Started", "Listening on 127.0.0.1:" + std::to_string(m_port));
    printf("[IPC Server] Listening for UI clients on http://127.0.0.1:%d\n", m_port);
    return true;
}

void IpcServer::Stop() {
    if (!m_running) return;
    m_running = false;

    if (m_listenSock != INVALID_SOCKET) {
        closesocket(m_listenSock);
        m_listenSock = INVALID_SOCKET;
    }
    if (m_serverThread.joinable()) {
        m_serverThread.join();
    }
    LogActivity("INFO", "SERVICE", "NetSplit Service Stopped", "IPC server shutdown complete");
}

void IpcServer::ServerLoop() {
    while (m_running && m_listenSock != INVALID_SOCKET) {
        sockaddr_in clientAddr = {0};
        int clientLen = sizeof(clientAddr);
        SOCKET clientSock = accept(m_listenSock, (SOCKADDR*)&clientAddr, &clientLen);
        if (clientSock == INVALID_SOCKET) {
            if (!m_running) break;
            continue;
        }

        std::thread([this, clientSock]() {
            HandleClient(clientSock);
        }).detach();
    }
}

void IpcServer::HandleClient(SOCKET clientSock) {
    std::string req;
    char buffer[8192];
    size_t headerEnd = std::string::npos;

    // Set receive timeout
    DWORD timeout = 5000;
    setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));

    // 1. Read headers
    while ((headerEnd = req.find("\r\n\r\n")) == std::string::npos) {
        int bytes = recv(clientSock, buffer, sizeof(buffer) - 1, 0);
        if (bytes <= 0) {
            closesocket(clientSock);
            return;
        }
        buffer[bytes] = '\0';
        req.append(buffer, bytes);
        if (req.size() > 65536) break;
    }

    // Handle OPTIONS for CORS preflight
    if (req.rfind("OPTIONS ", 0) == 0) {
        std::string resp = 
            "HTTP/1.1 204 No Content\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n"
            "Connection: close\r\n"
            "Content-Length: 0\r\n\r\n";
        send(clientSock, resp.c_str(), (int)resp.size(), 0);
        closesocket(clientSock);
        return;
    }

    // Check Expect: 100-continue
    if (req.find("100-continue") != std::string::npos) {
        const char* cont = "HTTP/1.1 100 Continue\r\n\r\n";
        send(clientSock, cont, (int)strlen(cont), 0);
    }

    // Parse Content-Length
    size_t contentLength = 0;
    size_t clPos = req.find("Content-Length: ");
    if (clPos == std::string::npos) clPos = req.find("content-length: ");
    if (clPos != std::string::npos) {
        size_t lineEnd = req.find("\r\n", clPos);
        if (lineEnd != std::string::npos) {
            contentLength = std::strtoul(req.substr(clPos + 16, lineEnd - clPos - 16).c_str(), NULL, 10);
        }
    }

    // Read remaining body if not already fully buffered
    std::string body = req.substr(headerEnd + 4);
    while (body.size() < contentLength) {
        size_t needed = contentLength - body.size();
        int bytesToRead = (needed > sizeof(buffer) - 1) ? (int)(sizeof(buffer) - 1) : (int)needed;
        int bytes = recv(clientSock, buffer, bytesToRead, 0);
        if (bytes <= 0) break;
        buffer[bytes] = '\0';
        body.append(buffer, bytes);
    }

    // Authenticate token: check header or query parameter
    bool authorized = false;
    if (!m_authToken.empty() && req.find(m_authToken) != std::string::npos) {
        authorized = true;
    }

    if (!authorized) {
        std::string errBody = "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32001,\"message\":\"Unauthorized: Invalid or missing IPC authentication token\"}}";
        std::string resp = 
            "HTTP/1.1 401 Unauthorized\r\n"
            "Content-Type: application/json\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Connection: close\r\n"
            "Content-Length: " + std::to_string(errBody.size()) + "\r\n\r\n" + errBody;
        send(clientSock, resp.c_str(), (int)resp.size(), 0);
        closesocket(clientSock);
        return;
    }

    std::string jsonResponse = ProcessJsonRpc(body);

    std::string httpResp = 
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/json\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Headers: *\r\n"
        "Connection: close\r\n"
        "Content-Length: " + std::to_string(jsonResponse.size()) + "\r\n\r\n" + jsonResponse;

    send(clientSock, httpResp.c_str(), (int)httpResp.size(), 0);
    closesocket(clientSock);
}

std::string IpcServer::ProcessJsonRpc(const std::string& requestBody) {
    std::string id = ExtractJsonValue(requestBody, "id");
    if (id.empty()) id = "1";
    std::string method = ExtractJsonValue(requestBody, "method");

    if (method == "system.getStatus") {
        return HandleGetStatus(id);
    } else if (method == "adapter.list") {
        return HandleListAdapter(id);
    } else if (method == "app.list") {
        return HandleListApp(id);
    } else if (method == "app.addManual") {
        return HandleAddManualApp(id, requestBody);
    } else if (method == "rule.assign") {
        return HandleAssignRule(id, requestBody);
    } else if (method == "rule.bulkAssign") {
        return HandleBulkAssign(id, requestBody);
    } else if (method == "rule.remove") {
        return HandleRemoveRule(id, requestBody);
    } else if (method == "rule.toggle") {
        return HandleToggleRule(id, requestBody);
    } else if (method == "rule.verify") {
        return HandleVerifyRules(id);
    } else if (method == "config.get") {
        return HandleGetConfig(id);
    } else if (method == "config.set") {
        return HandleSetConfig(id, requestBody);
    } else if (method == "adapter.setDefault") {
        return HandleSetDefaultAdapter(id, requestBody);
    } else if (method == "activity.list") {
        return HandleListActivity(id);
    } else if (method == "system.shutdown") {
        return HandleShutdown(id);
    }

    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + id + "\",\"error\":{\"code\":-32601,\"message\":\"Method not found: " + JsonEscape(method) + "\"}}";
}

std::string IpcServer::HandleGetStatus(const std::string& reqId) {
    auto adapters = m_pAdapterMgr->GetAdapters();
    int activeAdapters = 0;
    for (const auto& a : adapters) {
        if (a.status == "UP") activeAdapters++;
    }

    auto rules = m_pAssignMgr->GetAllRules();
    int activeRules = 0, errorRules = 0;
    for (const auto& r : rules) {
        if (r.status == "ACTIVE") activeRules++;
        else if (r.status == "ERROR") errorRules++;
    }

    GlobalConfig cfg = m_pAssignMgr->GetGlobalConfig();

    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":{";
    ss << "\"serviceRunning\":true,";
    ss << "\"serviceVersion\":\"1.0.0\",";
    ss << "\"uptimeSeconds\":" << (GetTickCount64() / 1000) << ",";
    ss << "\"routingEngineHealth\":\"HEALTHY\",";
    ss << "\"routingEngineMode\":\"WFP_ALE_PROXY\",";
    ss << "\"totalAdapters\":" << adapters.size() << ",";
    ss << "\"activeAdapters\":" << activeAdapters << ",";
    ss << "\"assignedApplicationsCount\":" << rules.size() << ",";
    ss << "\"activeRulesCount\":" << activeRules << ",";
    ss << "\"errorRulesCount\":" << errorRules << ",";
    ss << "\"defaultPolicy\":\"" << JsonEscape(cfg.defaultRoutingPolicy) << "\",";
    ss << "\"defaultAdapterId\":\"" << JsonEscape(cfg.defaultAdapterId) << "\",";
    ss << "\"isDriverInstalled\":false,";
    ss << "\"isElevated\":" << (IsProcessElevated() ? "true" : "false");
    ss << "}}";
    return ss.str();
}

std::string IpcServer::HandleListAdapter(const std::string& reqId) {
    m_pAdapterMgr->Refresh();
    auto adapters = m_pAdapterMgr->GetAdapters();

    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":[";
    for (size_t i = 0; i < adapters.size(); ++i) {
        const auto& a = adapters[i];
        ss << "{";
        ss << "\"id\":\"" << JsonEscape(a.id) << "\",";
        ss << "\"friendlyName\":\"" << JsonEscape(WStringToString(a.friendlyName)) << "\",";
        ss << "\"description\":\"" << JsonEscape(WStringToString(a.description)) << "\",";
        ss << "\"ifIndex\":" << a.ifIndex << ",";
        ss << "\"ipv6IfIndex\":" << a.ipv6IfIndex << ",";
        ss << "\"macAddress\":\"" << JsonEscape(a.macAddress) << "\",";
        ss << "\"status\":\"" << JsonEscape(a.status) << "\",";
        ss << "\"type\":\"" << JsonEscape(a.type) << "\",";
        ss << "\"linkSpeedBps\":" << a.linkSpeedBps << ",";
        ss << "\"isDefaultRoute\":" << (a.isDefaultRoute ? "true" : "false") << ",";

        // Assigned apps count
        auto rules = m_pAssignMgr->FindRulesByAdapter(a.id);
        ss << "\"assignedAppCount\":" << rules.size() << ",";
        ss << "\"compatibilityStatus\":\"" << JsonEscape(a.compatibilityStatus) << "\",";

        // IPv4 array
        ss << "\"ipv4Addresses\":[";
        for (size_t j = 0; j < a.ipv4Addresses.size(); ++j) {
            ss << "\"" << JsonEscape(a.ipv4Addresses[j]) << "\"" << (j + 1 < a.ipv4Addresses.size() ? "," : "");
        }
        ss << "],";

        // Gateways array
        ss << "\"gateways\":[";
        for (size_t j = 0; j < a.gateways.size(); ++j) {
            ss << "\"" << JsonEscape(a.gateways[j]) << "\"" << (j + 1 < a.gateways.size() ? "," : "");
        }
        ss << "],";

        // IPv6 array
        ss << "\"ipv6Addresses\":[";
        for (size_t j = 0; j < a.ipv6Addresses.size(); ++j) {
            ss << "\"" << JsonEscape(a.ipv6Addresses[j]) << "\"" << (j + 1 < a.ipv6Addresses.size() ? "," : "");
        }
        ss << "],";

        // DNS Servers array
        ss << "\"dnsServers\":[";
        for (size_t j = 0; j < a.dnsServers.size(); ++j) {
            ss << "\"" << JsonEscape(a.dnsServers[j]) << "\"" << (j + 1 < a.dnsServers.size() ? "," : "");
        }
        ss << "]";

        ss << "}" << (i + 1 < adapters.size() ? "," : "");
    }
    ss << "]}";
    return ss.str();
}

std::string IpcServer::HandleListApp(const std::string& reqId) {
    m_pAppMgr->ScanRunningProcesses();
    auto apps = m_pAppMgr->GetAllApps();
    auto rules = m_pAssignMgr->GetAllRules();

    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":[";
    for (size_t i = 0; i < apps.size(); ++i) {
        const auto& app = apps[i];
        ss << "{";
        ss << "\"id\":\"" << JsonEscape(app.id) << "\",";
        ss << "\"name\":\"" << JsonEscape(WStringToString(app.name)) << "\",";
        ss << "\"executablePath\":\"" << JsonEscape(WStringToString(app.executablePath)) << "\",";
        ss << "\"normalizedPath\":\"" << JsonEscape(WStringToString(app.normalizedPath)) << "\",";
        ss << "\"publisher\":\"" << JsonEscape(WStringToString(app.publisher)) << "\",";
        ss << "\"version\":\"" << JsonEscape(WStringToString(app.version)) << "\",";
        ss << "\"isRunning\":" << (app.isRunning ? "true" : "false") << ",";
        ss << "\"isSystemProcess\":" << (app.isSystemProcess ? "true" : "false") << ",";
        ss << "\"hasVisibleWindow\":" << (app.hasVisibleWindow ? "true" : "false") << ",";
        ss << "\"processIds\":[";
        for (size_t pidIdx = 0; pidIdx < app.processIds.size(); ++pidIdx) {
            ss << app.processIds[pidIdx] << (pidIdx + 1 < app.processIds.size() ? "," : "");
        }
        ss << "],";

        // Assignment lookup
        AssignmentRule* pRule = m_pAssignMgr->FindRuleByAppId(app.id);
        if (pRule) {
            ss << "\"assignedAdapterId\":\"" << JsonEscape(pRule->adapterId) << "\",";
            ss << "\"assignedAdapterName\":\"" << JsonEscape(WStringToString(pRule->adapterName)) << "\",";
            ss << "\"fallbackMode\":\"" << JsonEscape(pRule->fallbackMode) << "\",";
            ss << "\"ruleStatus\":\"" << JsonEscape(pRule->status) << "\"";
        } else {
            ss << "\"ruleStatus\":\"NONE\"";
        }

        ss << "}" << (i + 1 < apps.size() ? "," : "");
    }
    ss << "]}";
    return ss.str();
}

std::string IpcServer::HandleAddManualApp(const std::string& reqId, const std::string& body) {
    std::string exePath = ExtractJsonValue(body, "executablePath");
    std::string customName = ExtractJsonValue(body, "customName");

    if (exePath.empty()) {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32602,\"message\":\"executablePath parameter is required\"}}";
    }

    std::wstring wexePath = StringToWString(exePath);
    std::wstring wcustomName = StringToWString(customName);

    if (m_pAppMgr->AddManualExecutable(wexePath, wcustomName)) {
        DiscoveredApp* pApp = m_pAppMgr->FindAppByPath(wexePath);
        std::string appId = pApp ? pApp->id : "";
        LogActivity("INFO", "APPLICATION", "Manual Application Added", exePath);
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true,\"applicationId\":\"" + appId + "\"}}";
    } else {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32002,\"message\":\"Failed to find or read executable at specified path\"}}";
    }
}

std::string IpcServer::HandleAssignRule(const std::string& reqId, const std::string& body) {
    std::string appId = ExtractJsonValue(body, "applicationId");
    std::string exePath = ExtractJsonValue(body, "executablePath");
    std::string appName = ExtractJsonValue(body, "applicationName");
    std::string adapterId = ExtractJsonValue(body, "adapterId");
    std::string fallbackMode = ExtractJsonValue(body, "fallbackMode");

    if (appId.empty() || adapterId.empty()) {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32602,\"message\":\"applicationId and adapterId are required\"}}";
    }

    DiscoveredApp* pApp = m_pAppMgr->FindAppById(appId);
    if (!pApp && !exePath.empty()) {
        m_pAppMgr->AddManualExecutable(StringToWString(exePath), StringToWString(appName));
        pApp = m_pAppMgr->FindAppById(appId);
    }

    std::wstring wAppName = pApp ? pApp->name : StringToWString(appName);
    std::wstring wExePath = pApp ? pApp->executablePath : StringToWString(exePath);

    NetAdapterRecord* pAdapter = m_pAdapterMgr->FindAdapterById(adapterId);
    std::wstring wAdapterName = pAdapter ? pAdapter->friendlyName : L"Adapter";

    AssignmentRule rule;
    std::string err;
    if (m_pAssignMgr->SetAssignment(appId, wAppName, wExePath, adapterId, wAdapterName, fallbackMode, rule, err)) {
        std::string applyErr;
        if (m_pRoutingEngine->ApplyRule(rule, applyErr)) {
            m_pAssignMgr->UpdateRuleStatus(rule.id, "ACTIVE");
            LogActivity("SUCCESS", "RULE", "Routing Rule Activated", WStringToString(wAppName) + " -> " + WStringToString(wAdapterName));
        } else {
            m_pAssignMgr->UpdateRuleStatus(rule.id, "ERROR", applyErr);
            LogActivity("ERROR", "RULE", "Routing Rule Enforcement Failed", applyErr);
        }

        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true,\"ruleId\":\"" + rule.id + "\",\"status\":\"" + rule.status + "\"}}";
    }

    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32003,\"message\":\"" + JsonEscape(err) + "\"}}";
}

std::string IpcServer::HandleBulkAssign(const std::string& reqId, const std::string& body) {
    std::vector<std::string> items = ExtractJsonObjectsFromArray(body, "assignments");
    if (items.empty()) {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32602,\"message\":\"assignments array is required and cannot be empty\"}}";
    }

    std::vector<std::string> succeeded;
    std::vector<std::pair<std::string, std::string>> failed;

    for (const auto& item : items) {
        std::string appId = ExtractJsonValue(item, "applicationId");
        std::string adapterId = ExtractJsonValue(item, "adapterId");
        std::string exePath = ExtractJsonValue(item, "executablePath");
        std::string appName = ExtractJsonValue(item, "applicationName");
        std::string fallbackMode = ExtractJsonValue(item, "fallbackMode");
        if (fallbackMode.empty()) fallbackMode = "BLOCK";

        if (!appId.empty() && !adapterId.empty()) {
            DiscoveredApp* pApp = m_pAppMgr->FindAppById(appId);
            if (!pApp && !exePath.empty()) {
                m_pAppMgr->AddManualExecutable(StringToWString(exePath), StringToWString(appName));
                pApp = m_pAppMgr->FindAppById(appId);
            }

            std::wstring wAppName = pApp ? pApp->name : StringToWString(appName);
            std::wstring wExePath = pApp ? pApp->executablePath : StringToWString(exePath);
            NetAdapterRecord* pAdapter = m_pAdapterMgr->FindAdapterById(adapterId);
            std::wstring wAdapterName = pAdapter ? pAdapter->friendlyName : L"Adapter";

            AssignmentRule rule;
            std::string err;
            if (m_pAssignMgr->SetAssignment(appId, wAppName, wExePath, adapterId, wAdapterName, fallbackMode, rule, err)) {
                std::string applyErr;
                if (m_pRoutingEngine->ApplyRule(rule, applyErr)) {
                    m_pAssignMgr->UpdateRuleStatus(rule.id, "ACTIVE");
                    LogActivity("SUCCESS", "RULE", "Routing Rule Activated", WStringToString(wAppName) + " -> " + WStringToString(wAdapterName));
                } else {
                    m_pAssignMgr->UpdateRuleStatus(rule.id, "ERROR", applyErr);
                    LogActivity("ERROR", "RULE", "Routing Rule Enforcement Failed", applyErr);
                }
                succeeded.push_back(appId);
            } else {
                failed.push_back({appId, err});
            }
        } else {
            failed.push_back({appId.empty() ? "unknown" : appId, "Missing applicationId or adapterId"});
        }
    }

    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":{";
    ss << "\"succeeded\":[";
    for (size_t i = 0; i < succeeded.size(); ++i) {
        ss << "\"" << JsonEscape(succeeded[i]) << "\"" << (i + 1 < succeeded.size() ? "," : "");
    }
    ss << "],\"failed\":[";
    for (size_t i = 0; i < failed.size(); ++i) {
        ss << "{\"applicationId\":\"" << JsonEscape(failed[i].first) << "\",\"error\":\"" << JsonEscape(failed[i].second) << "\"}" << (i + 1 < failed.size() ? "," : "");
    }
    ss << "]}}";
    return ss.str();
}

std::string IpcServer::HandleRemoveRule(const std::string& reqId, const std::string& body) {
    std::string appId = ExtractJsonValue(body, "applicationId");
    if (appId.empty()) {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32602,\"message\":\"applicationId is required\"}}";
    }

    AssignmentRule* pRule = m_pAssignMgr->FindRuleByAppId(appId);
    if (pRule) {
        std::string remErr;
        m_pRoutingEngine->RemoveRule(pRule->id, remErr);
        std::string err;
        m_pAssignMgr->RemoveAssignment(appId, err);
        LogActivity("INFO", "RULE", "Routing Rule Removed", "Assignment removed for appId: " + appId);
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true}}";
    }

    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32004,\"message\":\"Rule not found for app: " + appId + "\"}}";
}

std::string IpcServer::HandleToggleRule(const std::string& reqId, const std::string& body) {
    std::string ruleId = ExtractJsonValue(body, "ruleId");
    bool enabled = ExtractJsonBool(body, "enabled", true);

    std::string err;
    if (m_pAssignMgr->SetRuleEnabled(ruleId, enabled, err)) {
        AssignmentRule* pRule = m_pAssignMgr->FindRuleById(ruleId);
        if (pRule) {
            if (enabled) {
                std::string applyErr;
                m_pRoutingEngine->ApplyRule(*pRule, applyErr);
                m_pAssignMgr->UpdateRuleStatus(ruleId, applyErr.empty() ? "ACTIVE" : "ERROR", applyErr);
            } else {
                std::string remErr;
                m_pRoutingEngine->RemoveRule(ruleId, remErr);
                m_pAssignMgr->UpdateRuleStatus(ruleId, "INACTIVE");
            }
        }
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true,\"enabled\":" + (enabled ? "true" : "false") + "}}";
    }

    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32005,\"message\":\"" + JsonEscape(err) + "\"}}";
}

std::string IpcServer::HandleVerifyRules(const std::string& reqId) {
    auto rules = m_pAssignMgr->GetAllRules();
    int activeCount = 0, failedCount = 0;

    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":{";
    ss << "\"totalChecked\":" << rules.size() << ",";
    ss << "\"results\":[";

    for (size_t i = 0; i < rules.size(); ++i) {
        auto& r = rules[i];
        std::string details;
        bool ok = m_pRoutingEngine->VerifyRule(r.id, details);
        std::string status = ok ? "ACTIVE" : "ERROR";
        if (ok) activeCount++;
        else failedCount++;

        m_pAssignMgr->UpdateRuleStatus(r.id, status, ok ? "" : details);

        ss << "{";
        ss << "\"ruleId\":\"" << JsonEscape(r.id) << "\",";
        ss << "\"applicationId\":\"" << JsonEscape(r.applicationId) << "\",";
        ss << "\"status\":\"" << status << "\",";
        ss << "\"details\":\"" << JsonEscape(details) << "\"";
        ss << "}" << (i + 1 < rules.size() ? "," : "");
    }

    ss << "],";
    ss << "\"activeCount\":" << activeCount << ",";
    ss << "\"failedCount\":" << failedCount;
    ss << "}}";

    LogActivity("INFO", "RULE", "Rule Verification Completed", "Verified " + std::to_string(rules.size()) + " rules. Active: " + std::to_string(activeCount) + ", Failed: " + std::to_string(failedCount));
    return ss.str();
}

std::string IpcServer::HandleGetConfig(const std::string& reqId) {
    GlobalConfig cfg = m_pAssignMgr->GetGlobalConfig();
    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":{";
    ss << "\"defaultRoutingPolicy\":\"" << JsonEscape(cfg.defaultRoutingPolicy) << "\",";
    ss << "\"defaultAdapterId\":\"" << JsonEscape(cfg.defaultAdapterId) << "\",";
    ss << "\"adapterDisconnectBehavior\":\"" << JsonEscape(cfg.adapterDisconnectBehavior) << "\",";
    ss << "\"startWithWindows\":" << (cfg.startWithWindows ? "true" : "false") << ",";
    ss << "\"minimizeToTray\":" << (cfg.minimizeToTray ? "true" : "false") << ",";
    ss << "\"enableAuditLogging\":" << (cfg.enableAuditLogging ? "true" : "false") << ",";
    ss << "\"themeMode\":\"" << JsonEscape(cfg.themeMode) << "\"";
    ss << "}}";
    return ss.str();
}

std::string IpcServer::HandleSetConfig(const std::string& reqId, const std::string& body) {
    GlobalConfig cfg = m_pAssignMgr->GetGlobalConfig();
    std::string drp = ExtractJsonValue(body, "defaultRoutingPolicy");
    std::string daId = ExtractJsonValue(body, "defaultAdapterId");
    std::string adb = ExtractJsonValue(body, "adapterDisconnectBehavior");
    std::string tm = ExtractJsonValue(body, "themeMode");

    bool policyChanged = (!drp.empty() && drp != cfg.defaultRoutingPolicy);
    bool adapterChanged = (body.find("\"defaultAdapterId\"") != std::string::npos && daId != cfg.defaultAdapterId);

    if (!drp.empty()) cfg.defaultRoutingPolicy = drp;
    if (body.find("\"defaultAdapterId\"") != std::string::npos) cfg.defaultAdapterId = daId;
    if (!adb.empty()) cfg.adapterDisconnectBehavior = adb;
    if (!tm.empty()) cfg.themeMode = tm;

    cfg.startWithWindows = ExtractJsonBool(body, "startWithWindows", cfg.startWithWindows);
    cfg.minimizeToTray = ExtractJsonBool(body, "minimizeToTray", cfg.minimizeToTray);
    cfg.enableAuditLogging = ExtractJsonBool(body, "enableAuditLogging", cfg.enableAuditLogging);

    if (policyChanged || adapterChanged) {
        std::string err;
        if (cfg.defaultRoutingPolicy == "WINDOWS_DEFAULT" || cfg.defaultAdapterId.empty()) {
            m_pAdapterMgr->SetDefaultAdapter("WINDOWS_AUTO", err);
            LogActivity("INFO", "ADAPTER", "Default Adapter Reverted", "Reverted route metrics to Windows automatic");
        } else {
            m_pAdapterMgr->SetDefaultAdapter(cfg.defaultAdapterId, err);
            auto pAd = m_pAdapterMgr->FindAdapterById(cfg.defaultAdapterId);
            std::string adName = pAd ? WStringToString(pAd->friendlyName) : cfg.defaultAdapterId;
            LogActivity("INFO", "ADAPTER", "Default Adapter Set", "Set " + adName + " as default network adapter (metric 5)");
        }
    }

    m_pAssignMgr->SetGlobalConfig(cfg);
    LogActivity("INFO", "SYSTEM", "Configuration Updated", "Global settings updated by user");
    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true}}";
}

std::string IpcServer::HandleSetDefaultAdapter(const std::string& reqId, const std::string& body) {
    std::string adapterId = ExtractJsonValue(body, "adapterId");
    std::string policy = ExtractJsonValue(body, "policy");

    if (policy.empty()) {
        policy = (adapterId.empty() || adapterId == "WINDOWS_AUTO") ? "WINDOWS_DEFAULT" : "PREFER_ADAPTER";
    }

    GlobalConfig cfg = m_pAssignMgr->GetGlobalConfig();
    std::string err;
    bool ok = false;

    if (policy == "WINDOWS_DEFAULT" || adapterId.empty() || adapterId == "WINDOWS_AUTO") {
        ok = m_pAdapterMgr->SetDefaultAdapter("WINDOWS_AUTO", err);
        if (ok) {
            cfg.defaultRoutingPolicy = "WINDOWS_DEFAULT";
            cfg.defaultAdapterId = "";
            m_pAssignMgr->SetGlobalConfig(cfg);
            LogActivity("INFO", "ADAPTER", "Default Adapter Reset", "Reverted route metrics to Windows automatic");
        }
    } else {
        ok = m_pAdapterMgr->SetDefaultAdapter(adapterId, err);
        if (ok) {
            cfg.defaultRoutingPolicy = "PREFER_ADAPTER";
            cfg.defaultAdapterId = adapterId;
            m_pAssignMgr->SetGlobalConfig(cfg);
            auto pAd = m_pAdapterMgr->FindAdapterById(adapterId);
            std::string name = pAd ? WStringToString(pAd->friendlyName) : adapterId;
            LogActivity("INFO", "ADAPTER", "Default Adapter Set", "Set " + name + " as default network adapter (metric 5)");
        }
    }

    if (!ok) {
        return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"error\":{\"code\":-32000,\"message\":\"" + JsonEscape(err) + "\"}}";
    }

    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true,\"defaultAdapterId\":\"" + JsonEscape(cfg.defaultAdapterId) + "\",\"defaultRoutingPolicy\":\"" + JsonEscape(cfg.defaultRoutingPolicy) + "\"}}";
}

std::string IpcServer::HandleListActivity(const std::string& reqId) {
    std::lock_guard<std::mutex> lock(m_activityMutex);
    std::ostringstream ss;
    ss << "{\"jsonrpc\":\"2.0\",\"id\":\"" << reqId << "\",\"result\":[";
    for (size_t i = 0; i < m_activities.size(); ++i) {
        const auto& act = m_activities[i];
        ss << "{";
        ss << "\"id\":\"" << JsonEscape(act.id) << "\",";
        ss << "\"timestamp\":\"" << JsonEscape(act.timestamp) << "\",";
        ss << "\"level\":\"" << JsonEscape(act.level) << "\",";
        ss << "\"category\":\"" << JsonEscape(act.category) << "\",";
        ss << "\"title\":\"" << JsonEscape(act.title) << "\",";
        ss << "\"message\":\"" << JsonEscape(act.message) << "\"";
        ss << "}" << (i + 1 < m_activities.size() ? "," : "");
    }
    ss << "]}";
    return ss.str();
}

std::string IpcServer::HandleShutdown(const std::string& reqId) {
    LogActivity("INFO", "SYSTEM", "Service Shutdown Initiated", "Service shutdown requested via IPC");
    std::thread([]() {
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
        ExitProcess(0);
    }).detach();
    return "{\"jsonrpc\":\"2.0\",\"id\":\"" + reqId + "\",\"result\":{\"success\":true,\"message\":\"Service daemon shutting down\"}}";
}

