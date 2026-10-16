#pragma once
#include "common_net.hpp"
#include "adapter_manager.hpp"
#include "assignment_manager.hpp"

#include "routing_shared.hpp"
#include <set>

struct ActiveWfpRule {
    std::string ruleId;
    std::string applicationId;
    std::wstring executablePath;
    DWORD targetIfIndex = 0;
    DWORD targetIpv6IfIndex = 0;
    std::string targetLocalIp;
    std::string targetLocalIpv6;
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

    // Master Engine Switch: Suspend/Resume routing enforcement
    bool SuspendEngine(std::string& outError);
    bool ResumeEngine(const std::vector<AssignmentRule>& rules, std::string& outError);
    bool IsEngineSuspended() const { return m_engineSuspended; }

    bool IsRunning() const { return m_running; }
    size_t GetActiveFilterCount();

    void ResetConnectionsForPids(const std::vector<DWORD>& pids);
    void ResetConnectionsForProcessName(const std::wstring& processName);

private:
    AdapterManager* m_pAdapterMgr;
    HANDLE m_engineHandle = NULL;
    std::atomic<bool> m_running{false};
    std::atomic<bool> m_engineSuspended{false};
    std::recursive_mutex m_mutex;

    // Track applied filters: ruleId -> ActiveWfpRule
    std::unordered_map<std::string, ActiveWfpRule> m_appliedRules;

    // Shared Memory Routing Table for Process Binding
    HANDLE m_hSharedMap = NULL;
    SharedRoutingTable* m_pSharedTable = NULL;
    std::wstring m_routerDllPath;
    std::wstring m_routerDll32Path;
    std::thread m_watcherThread;

    void InitSharedMemory();
    void CloseSharedMemory();
    void UpdateSharedTable();
    void InjectProcess(DWORD pid);
    void WatcherWorkerLoop();

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
