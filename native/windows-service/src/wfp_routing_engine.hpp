#pragma once
#include "common_net.hpp"
#include "adapter_manager.hpp"
#include "assignment_manager.hpp"

struct ActiveWfpRule {
    std::string ruleId;
    std::string applicationId;
    std::wstring executablePath;
    DWORD targetIfIndex = 0;
    std::string targetLocalIp;
    std::string fallbackMode;
    UINT64 filterId = 0;
    bool isFilterActive = false;
};

class WfpRoutingEngine {
public:
    WfpRoutingEngine(AdapterManager* pAdapterMgr);
    ~WfpRoutingEngine();

    bool Initialize();
    void Shutdown();

    // Rule management
    bool ApplyRule(const AssignmentRule& rule, std::string& outError);
    bool RemoveRule(const std::string& ruleId, std::string& outError);
    bool VerifyRule(const std::string& ruleId, std::string& outStatusDetails);

    bool IsRunning() const { return m_running; }
    size_t GetActiveFilterCount();

private:
    AdapterManager* m_pAdapterMgr;
    HANDLE m_engineHandle = NULL;
    std::atomic<bool> m_running{false};
    std::recursive_mutex m_mutex;

    // Track applied filters: ruleId -> ActiveWfpRule
    std::unordered_map<std::string, ActiveWfpRule> m_appliedRules;

    // Local Transparent Proxy Broker
    SOCKET m_brokerListenSock = INVALID_SOCKET;
    int m_brokerPort = 49200;
    std::thread m_brokerThread;

    bool InitWfpEngine();
    void CloseWfpEngine();
    bool StartProxyBroker();
    void StopProxyBroker();
    void BrokerWorkerLoop();

    static void RelayConnection(SOCKET clientSock, DWORD targetIfIndex, std::string localIp);
};
