#pragma once
#include "common_net.hpp"
#include "adapter_manager.hpp"
#include "app_discovery.hpp"
#include "assignment_manager.hpp"
#include "wfp_routing_engine.hpp"

struct ActivityLogEntry {
    std::string id;
    std::string timestamp;
    std::string level;    // "INFO", "WARNING", "ERROR", "SUCCESS"
    std::string category; // "ADAPTER", "RULE", "SERVICE", "APP"
    std::string title;
    std::string message;
};

class IpcServer {
public:
    IpcServer(int port,
              const std::string& tokenFilePath,
              AdapterManager* pAdapterMgr,
              AppDiscoveryManager* pAppMgr,
              AssignmentManager* pAssignMgr,
              WfpRoutingEngine* pRoutingEngine);
    ~IpcServer();

    bool Start();
    void Stop();

    void LogActivity(const std::string& level, const std::string& category, const std::string& title, const std::string& message);
    std::string GetAuthToken() const { return m_authToken; }

private:
    int m_port;
    std::string m_tokenFilePath;
    std::string m_authToken;

    AdapterManager* m_pAdapterMgr;
    AppDiscoveryManager* m_pAppMgr;
    AssignmentManager* m_pAssignMgr;
    WfpRoutingEngine* m_pRoutingEngine;

    SOCKET m_listenSock = INVALID_SOCKET;
    std::atomic<bool> m_running{false};
    std::thread m_serverThread;

    std::vector<ActivityLogEntry> m_activities;
    std::mutex m_activityMutex;

    void GenerateAndSaveToken();
    void ServerLoop();
    void HandleClient(SOCKET clientSock);
    std::string ProcessJsonRpc(const std::string& requestBody);

    // RPC Method Handlers
    std::string HandleGetStatus(const std::string& reqId);
    std::string HandleListAdapter(const std::string& reqId);
    std::string HandleListApp(const std::string& reqId);
    std::string HandleAddManualApp(const std::string& reqId, const std::string& body);
    std::string HandleAssignRule(const std::string& reqId, const std::string& body);
    std::string HandleBulkAssign(const std::string& reqId, const std::string& body);
    std::string HandleRemoveRule(const std::string& reqId, const std::string& body);
    std::string HandleToggleRule(const std::string& reqId, const std::string& body);
    std::string HandleVerifyRules(const std::string& reqId);
    std::string HandleGetConfig(const std::string& reqId);
    std::string HandleSetConfig(const std::string& reqId, const std::string& body);
    std::string HandleSetDefaultAdapter(const std::string& reqId, const std::string& body);
    std::string HandleListActivity(const std::string& reqId);
    std::string HandleToggleEngine(const std::string& reqId, const std::string& body);
    std::string HandleShutdown(const std::string& reqId);
};
