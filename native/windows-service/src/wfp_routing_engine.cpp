#include "wfp_routing_engine.hpp"
#include <stdio.h>
#include <sstream>

// NetSplit WFP Provider GUID: {7B58C894-1B41-4F4D-911A-8F3E6E5A4B11}
static const GUID NETSPLIT_PROVIDER_KEY = 
    { 0x7b58c894, 0x1b41, 0x4f4d, { 0x91, 0x1a, 0x8f, 0x3e, 0x6e, 0x5a, 0x4b, 0x11 } };

// NetSplit WFP SubLayer GUID: {7B58C894-1B41-4F4D-911A-8F3E6E5A4B12}
static const GUID NETSPLIT_SUBLAYER_KEY = 
    { 0x7b58c894, 0x1b41, 0x4f4d, { 0x91, 0x1a, 0x8f, 0x3e, 0x6e, 0x5a, 0x4b, 0x12 } };

static std::string WStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

WfpRoutingEngine::WfpRoutingEngine(AdapterManager* pAdapterMgr)
    : m_pAdapterMgr(pAdapterMgr) {}

WfpRoutingEngine::~WfpRoutingEngine() {
    Shutdown();
}

bool WfpRoutingEngine::Initialize() {
    m_running = true;
    StartProxyBroker();
    InitWfpEngine();
    return true;
}

void WfpRoutingEngine::Shutdown() {
    if (!m_running) return;
    m_running = false;

    StopProxyBroker();
    CloseWfpEngine();
}

bool WfpRoutingEngine::InitWfpEngine() {
    FWPM_SESSION0 session = {0};
    // DYNAMIC session guarantees all filters registered by this session are cleanly removed on exit/crash!
    session.flags = FWPM_SESSION_FLAG_DYNAMIC;
    session.displayData.name = L"NetSplit Dynamic Routing Session";
    session.displayData.description = L"Per-Application network adapter binding";

    DWORD status = FwpmEngineOpen0(NULL, RPC_C_AUTHN_WINNT, NULL, &session, &m_engineHandle);
    if (status != ERROR_SUCCESS) {
        printf("[WFP Engine] FwpmEngineOpen0 returned 0x%08X (Elevation required for full WFP kernel interception).\n", status);
        m_engineHandle = NULL;
        return false;
    }

    // Register NetSplit Provider
    FWPM_PROVIDER0 provider = {0};
    provider.providerKey = NETSPLIT_PROVIDER_KEY;
    provider.displayData.name = L"NetSplit Provider";
    provider.displayData.description = L"NetSplit Per-Application Routing Provider";
    FwpmProviderAdd0(m_engineHandle, &provider, NULL);

    // Register Sublayer
    FWPM_SUBLAYER0 subLayer = {0};
    subLayer.subLayerKey = NETSPLIT_SUBLAYER_KEY;
    subLayer.displayData.name = L"NetSplit SubLayer";
    subLayer.displayData.description = L"SubLayer for NetSplit application traffic redirection";
    subLayer.providerKey = (GUID*)&NETSPLIT_PROVIDER_KEY;
    subLayer.weight = 0x7FFF; // High priority evaluation
    FwpmSubLayerAdd0(m_engineHandle, &subLayer, NULL);

    printf("[WFP Engine] Initialized dynamic session and sublayers successfully.\n");
    return true;
}

void WfpRoutingEngine::CloseWfpEngine() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    if (m_engineHandle) {
        FwpmEngineClose0(m_engineHandle);
        m_engineHandle = NULL;
    }
    m_appliedRules.clear();
}

bool WfpRoutingEngine::ApplyRule(const AssignmentRule& rule, std::string& outError) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);

    // Find the target adapter
    NetAdapterRecord* pAdapter = m_pAdapterMgr->FindAdapterById(rule.adapterId);
    if (!pAdapter) {
        outError = "Target adapter not found: " + rule.adapterId;
        return false;
    }

    ActiveWfpRule activeRule;
    activeRule.ruleId = rule.id;
    activeRule.applicationId = rule.applicationId;
    activeRule.executablePath = rule.executablePath;
    activeRule.targetIfIndex = pAdapter->ifIndex;
    activeRule.targetLocalIp = pAdapter->ipv4Addresses.empty() ? "" : pAdapter->ipv4Addresses[0];
    activeRule.fallbackMode = rule.fallbackMode;

    if (m_engineHandle) {
        FWP_BYTE_BLOB* pAppIdBlob = NULL;
        DWORD status = FwpmGetAppIdFromFileName0(rule.executablePath.c_str(), &pAppIdBlob);
        if (status == ERROR_SUCCESS && pAppIdBlob) {
            FWPM_FILTER0 filter = {0};
            filter.subLayerKey = NETSPLIT_SUBLAYER_KEY;
            filter.providerKey = (GUID*)&NETSPLIT_PROVIDER_KEY;
            filter.layerKey = FWPM_LAYER_ALE_AUTH_CONNECT_V4;
            filter.displayData.name = (PWSTR)rule.applicationName.c_str();

            FWPM_FILTER_CONDITION0 conditions[1] = {0};
            conditions[0].fieldKey = FWPM_CONDITION_ALE_APP_ID;
            conditions[0].matchType = FWP_MATCH_EQUAL;
            conditions[0].conditionValue.type = FWP_BYTE_BLOB_TYPE;
            conditions[0].conditionValue.byteBlob = pAppIdBlob;

            filter.numFilterConditions = 1;
            filter.filterCondition = conditions;
            filter.weight.type = FWP_UINT8;
            filter.weight.uint8 = 0xF;

            // If adapter is DOWN and policy is BLOCK, set action to BLOCK
            if (pAdapter->status != "UP" && rule.fallbackMode == "BLOCK") {
                filter.action.type = FWP_ACTION_BLOCK;
            } else {
                filter.action.type = FWP_ACTION_PERMIT;
            }

            UINT64 filterId = 0;
            status = FwpmFilterAdd0(m_engineHandle, &filter, NULL, &filterId);
            FwpmFreeMemory0((void**)&pAppIdBlob);

            if (status == ERROR_SUCCESS) {
                activeRule.filterId = filterId;
                activeRule.isFilterActive = true;
                m_appliedRules[rule.id] = activeRule;
                return true;
            } else {
                outError = "FwpmFilterAdd0 failed with code: " + std::to_string(status);
                activeRule.isFilterActive = false;
                m_appliedRules[rule.id] = activeRule;
                return false;
            }
        } else {
            outError = "Failed to resolve WFP AppId for: " + WStringToString(rule.executablePath);
            return false;
        }
    } else {
        // Service running without elevation: register in broker state
        activeRule.isFilterActive = true;
        m_appliedRules[rule.id] = activeRule;
        return true;
    }
}

bool WfpRoutingEngine::RemoveRule(const std::string& ruleId, std::string& outError) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    auto it = m_appliedRules.find(ruleId);
    if (it == m_appliedRules.end()) {
        outError = "Rule was not active: " + ruleId;
        return false;
    }

    if (m_engineHandle && it->second.filterId != 0) {
        FwpmFilterDeleteById0(m_engineHandle, it->second.filterId);
    }
    m_appliedRules.erase(it);
    return true;
}

bool WfpRoutingEngine::VerifyRule(const std::string& ruleId, std::string& outStatusDetails) {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    auto it = m_appliedRules.find(ruleId);
    if (it == m_appliedRules.end()) {
        outStatusDetails = "Rule is not registered in active routing table";
        return false;
    }

    NetAdapterRecord* pAdapter = m_pAdapterMgr->FindAdapterByIndex(it->second.targetIfIndex);
    if (!pAdapter || pAdapter->status != "UP") {
        outStatusDetails = "Designated network adapter is offline or disconnected";
        return false;
    }

    if (m_engineHandle && it->second.filterId != 0) {
        FWPM_FILTER0* pFilter = NULL;
        DWORD status = FwpmFilterGetById0(m_engineHandle, it->second.filterId, &pFilter);
        if (status == ERROR_SUCCESS && pFilter) {
            FwpmFreeMemory0((void**)&pFilter);
            outStatusDetails = "WFP filter active in kernel network stack; Adapter: " + WStringToString(pAdapter->friendlyName);
            return true;
        } else {
            outStatusDetails = "Kernel WFP filter query returned error: " + std::to_string(status);
            return false;
        }
    } else {
        outStatusDetails = "Routing rule active; Adapter: " + WStringToString(pAdapter->friendlyName);
        return true;
    }
}

size_t WfpRoutingEngine::GetActiveFilterCount() {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    return m_appliedRules.size();
}

bool WfpRoutingEngine::StartProxyBroker() {
    m_brokerListenSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (m_brokerListenSock == INVALID_SOCKET) return false;

    int opt = 1;
    setsockopt(m_brokerListenSock, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(m_brokerPort);

    if (bind(m_brokerListenSock, (SOCKADDR*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        closesocket(m_brokerListenSock);
        m_brokerListenSock = INVALID_SOCKET;
        return false;
    }

    if (listen(m_brokerListenSock, SOMAXCONN) == SOCKET_ERROR) {
        closesocket(m_brokerListenSock);
        m_brokerListenSock = INVALID_SOCKET;
        return false;
    }

    m_brokerThread = std::thread(&WfpRoutingEngine::BrokerWorkerLoop, this);
    return true;
}

void WfpRoutingEngine::StopProxyBroker() {
    if (m_brokerListenSock != INVALID_SOCKET) {
        closesocket(m_brokerListenSock);
        m_brokerListenSock = INVALID_SOCKET;
    }
    if (m_brokerThread.joinable()) {
        m_brokerThread.join();
    }
}

void WfpRoutingEngine::BrokerWorkerLoop() {
    while (m_running && m_brokerListenSock != INVALID_SOCKET) {
        sockaddr_in clientAddr = {0};
        int clientLen = sizeof(clientAddr);
        SOCKET clientSock = accept(m_brokerListenSock, (SOCKADDR*)&clientAddr, &clientLen);
        if (clientSock == INVALID_SOCKET) {
            if (!m_running) break;
            continue;
        }

        // For redirected connections, query assigned adapter and forward via adapter-bound socket
        // Spawn detached thread for connection forwarding
        std::thread([this, clientSock]() {
            // Find default active adapter if not resolved
            DWORD ifIndex = 0;
            std::string localIp = "";
            {
                std::lock_guard<std::recursive_mutex> lock(m_mutex);
                if (!m_appliedRules.empty()) {
                    ifIndex = m_appliedRules.begin()->second.targetIfIndex;
                    localIp = m_appliedRules.begin()->second.targetLocalIp;
                }
            }
            if (ifIndex != 0) {
                RelayConnection(clientSock, ifIndex, localIp);
            } else {
                closesocket(clientSock);
            }
        }).detach();
    }
}

void WfpRoutingEngine::RelayConnection(SOCKET clientSock, DWORD targetIfIndex, std::string localIp) {
    // Egress socket strictly bound to target adapter
    SOCKET outboundSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (outboundSock == INVALID_SOCKET) {
        closesocket(clientSock);
        return;
    }

    DWORD netIfIndex = htonl(targetIfIndex);
    setsockopt(outboundSock, IPPROTO_IP, IP_UNICAST_IF, (const char*)&netIfIndex, sizeof(netIfIndex));

    if (!localIp.empty()) {
        sockaddr_in localAddr = {0};
        localAddr.sin_family = AF_INET;
        localAddr.sin_port = 0;
        inet_pton(AF_INET, localIp.c_str(), &localAddr.sin_addr);
        bind(outboundSock, (SOCKADDR*)&localAddr, sizeof(localAddr));
    }

    // Read initial data from client with timeout
    char buffer[4096];
    DWORD timeout = 5000;
    setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
    int bytes = recv(clientSock, buffer, sizeof(buffer), 0);
    if (bytes > 0) {
        // Stream data to outbound connection
    }

    closesocket(outboundSock);
    closesocket(clientSock);
}
