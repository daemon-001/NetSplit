#pragma once
#include "common_net.hpp"

struct NetAdapterRecord {
    std::string id;              // GUID or synthetic unique key
    std::wstring friendlyName;
    std::wstring description;
    DWORD ifIndex = 0;
    DWORD ipv6IfIndex = 0;
    std::string macAddress;
    std::string status;          // "UP", "DOWN", "UNKNOWN"
    std::string type;            // "ETHERNET", "WIFI", "CELLULAR", "VIRTUAL", "LOOPBACK", "OTHER"
    unsigned __int64 linkSpeedBps = 0;
    std::vector<std::string> ipv4Addresses;
    std::vector<std::string> ipv6Addresses;
    std::vector<std::string> gateways;
    std::vector<std::string> dnsServers;
    bool isDefaultRoute = false;
    int assignedAppCount = 0;
    std::string compatibilityStatus = "SUPPORTED";
    std::string compatibilityNotes;
};

class AdapterManager {
public:
    AdapterManager();
    ~AdapterManager();

    bool Initialize();
    void Refresh();
    std::vector<NetAdapterRecord> GetAdapters();
    NetAdapterRecord* FindAdapterById(const std::string& adapterId);
    NetAdapterRecord* FindAdapterByIndex(DWORD ifIndex);
    bool SetDefaultAdapter(const std::string& adapterId, std::string& outError);

private:
    std::vector<NetAdapterRecord> m_adapters;
    std::mutex m_mutex;
    HANDLE m_changeHandle = NULL;

    static VOID WINAPI OnInterfaceChanged(PVOID CallerContext, PMIB_IPINTERFACE_ROW Row, MIB_NOTIFICATION_TYPE NotificationType);
};
