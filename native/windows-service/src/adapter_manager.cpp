#include "adapter_manager.hpp"
#include <stdio.h>
#include <sstream>
#include <iomanip>

static std::string WStringToString(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

static std::string FormatMacAddress(PBYTE mac, DWORD length) {
    if (!mac || length == 0) return "";
    char buf[32] = {0};
    if (length == 6) {
        snprintf(buf, sizeof(buf), "%02X-%02X-%02X-%02X-%02X-%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    } else {
        std::string res;
        for (DWORD i = 0; i < length; ++i) {
            char b[4];
            snprintf(b, sizeof(b), "%02X%s", mac[i], (i + 1 < length ? "-" : ""));
            res += b;
        }
        return res;
    }
    return std::string(buf);
}

AdapterManager::AdapterManager() {}

AdapterManager::~AdapterManager() {
    if (m_changeHandle) {
        CancelMibChangeNotify2(m_changeHandle);
        m_changeHandle = NULL;
    }
}

bool AdapterManager::Initialize() {
    Refresh();

    // Register for IP interface notifications
    NotifyIpInterfaceChange(AF_UNSPEC, OnInterfaceChanged, this, FALSE, &m_changeHandle);
    return true;
}

VOID WINAPI AdapterManager::OnInterfaceChanged(PVOID CallerContext, PMIB_IPINTERFACE_ROW, MIB_NOTIFICATION_TYPE) {
    AdapterManager* pThis = (AdapterManager*)CallerContext;
    if (pThis) {
        pThis->Refresh();
    }
}

void AdapterManager::Refresh() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_adapters.clear();

    ULONG outBufLen = 15000;
    PIP_ADAPTER_ADDRESSES pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(outBufLen);
    if (!pAddresses) return;

    ULONG flags = GAA_FLAG_INCLUDE_PREFIX | GAA_FLAG_INCLUDE_GATEWAYS;
    DWORD dwRetVal = GetAdaptersAddresses(AF_UNSPEC, flags, NULL, pAddresses, &outBufLen);
    if (dwRetVal == ERROR_BUFFER_OVERFLOW) {
        free(pAddresses);
        pAddresses = (IP_ADAPTER_ADDRESSES*)malloc(outBufLen);
        if (!pAddresses) return;
        dwRetVal = GetAdaptersAddresses(AF_UNSPEC, flags, NULL, pAddresses, &outBufLen);
    }

    // Determine default IPv4 route interface index
    DWORD defaultIfIndex = 0;
    MIB_IPFORWARDROW bestRoute;
    if (GetBestRoute(inet_addr("8.8.8.8"), 0, &bestRoute) == NO_ERROR) {
        defaultIfIndex = bestRoute.dwForwardIfIndex;
    }

    if (dwRetVal == NO_ERROR) {
        for (PIP_ADAPTER_ADDRESSES pCurr = pAddresses; pCurr != NULL; pCurr = pCurr->Next) {
            // Skip loopback and tunnel interfaces
            if (pCurr->IfType == IF_TYPE_SOFTWARE_LOOPBACK || pCurr->IfType == IF_TYPE_TUNNEL) {
                continue;
            }

            // Skip internal filter and non-routable interface types
            if (pCurr->IfType == 1 || pCurr->IfType == 243 || pCurr->IfType == 244) {
                continue;
            }

            std::wstring desc = pCurr->Description ? pCurr->Description : L"";
            std::wstring name = pCurr->FriendlyName ? pCurr->FriendlyName : L"";

            auto toLowerW = [](std::wstring s) {
                for (auto& c : s) c = towlower(c);
                return s;
            };
            std::wstring lDesc = toLowerW(desc);
            std::wstring lName = toLowerW(name);

            // Filter out NDIS filters, QoS packet schedulers, kernel debuggers, Wi-Fi Direct, and virtual miniports
            if (lDesc.find(L"filter") != std::wstring::npos ||
                lDesc.find(L"packet scheduler") != std::wstring::npos ||
                lDesc.find(L"lightweight") != std::wstring::npos ||
                lDesc.find(L"kernel debugger") != std::wstring::npos ||
                lDesc.find(L"qos") != std::wstring::npos ||
                lDesc.find(L"wfp") != std::wstring::npos ||
                lDesc.find(L"pseudo-interface") != std::wstring::npos ||
                lDesc.find(L"wi-fi direct") != std::wstring::npos ||
                lName.find(L"filter") != std::wstring::npos ||
                lName.find(L"packet scheduler") != std::wstring::npos) {
                continue;
            }

            NetAdapterRecord record;
            record.id = pCurr->AdapterName ? pCurr->AdapterName : "";
            record.friendlyName = name;
            record.description = desc;
            record.ifIndex = pCurr->IfIndex;
            record.ipv6IfIndex = pCurr->Ipv6IfIndex;
            record.macAddress = FormatMacAddress(pCurr->PhysicalAddress, pCurr->PhysicalAddressLength);

            // Oper status
            switch (pCurr->OperStatus) {
                case IfOperStatusUp: record.status = "UP"; break;
                case IfOperStatusDown: record.status = "DOWN"; break;
                case IfOperStatusTesting: record.status = "TESTING"; break;
                default: record.status = "UNKNOWN"; break;
            }

            // Link speed
            record.linkSpeedBps = pCurr->TransmitLinkSpeed;

            // Type classification
            switch (pCurr->IfType) {
                case IF_TYPE_ETHERNET_CSMACD:
                    record.type = "ETHERNET";
                    break;
                case IF_TYPE_IEEE80211:
                    record.type = "WIFI";
                    break;
                case IF_TYPE_WWANPP:
                case IF_TYPE_WWANPP2:
                    record.type = "CELLULAR";
                    break;
                case IF_TYPE_SOFTWARE_LOOPBACK:
                    record.type = "LOOPBACK";
                    break;
                default:
                    // Check description keywords
                    if (record.description.find(L"Wi-Fi") != std::wstring::npos ||
                        record.description.find(L"Wireless") != std::wstring::npos ||
                        record.description.find(L"802.11") != std::wstring::npos) {
                        record.type = "WIFI";
                    } else if (record.description.find(L"Virtual") != std::wstring::npos ||
                               record.description.find(L"TAP") != std::wstring::npos ||
                               record.description.find(L"VPN") != std::wstring::npos) {
                        record.type = "VIRTUAL";
                    } else if (record.description.find(L"Bluetooth") != std::wstring::npos) {
                        record.type = "BLUETOOTH";
                    } else if (record.description.find(L"UsbNcm") != std::wstring::npos ||
                               record.description.find(L"Tethering") != std::wstring::npos) {
                        record.type = "CELLULAR";
                    } else {
                        record.type = "OTHER";
                    }
                    break;
            }

            // IP addresses
            for (PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurr->FirstUnicastAddress; pUnicast != NULL; pUnicast = pUnicast->Next) {
                if (pUnicast->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = (sockaddr_in*)pUnicast->Address.lpSockaddr;
                    char ipStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(sa_in->sin_addr), ipStr, INET_ADDRSTRLEN);
                    record.ipv4Addresses.push_back(ipStr);
                } else if (pUnicast->Address.lpSockaddr->sa_family == AF_INET6) {
                    sockaddr_in6* sa_in6 = (sockaddr_in6*)pUnicast->Address.lpSockaddr;
                    char ip6Str[INET6_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET6, &(sa_in6->sin6_addr), ip6Str, INET6_ADDRSTRLEN);
                    record.ipv6Addresses.push_back(ip6Str);
                }
            }

            // Gateways
            for (PIP_ADAPTER_GATEWAY_ADDRESS_LH pGateway = pCurr->FirstGatewayAddress; pGateway != NULL; pGateway = pGateway->Next) {
                if (pGateway->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = (sockaddr_in*)pGateway->Address.lpSockaddr;
                    char gwStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(sa_in->sin_addr), gwStr, INET_ADDRSTRLEN);
                    record.gateways.push_back(gwStr);
                } else if (pGateway->Address.lpSockaddr->sa_family == AF_INET6) {
                    sockaddr_in6* sa_in6 = (sockaddr_in6*)pGateway->Address.lpSockaddr;
                    char gw6Str[INET6_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET6, &(sa_in6->sin6_addr), gw6Str, INET6_ADDRSTRLEN);
                    record.gateways.push_back(gw6Str);
                }
            }

            // DNS Servers
            for (PIP_ADAPTER_DNS_SERVER_ADDRESS pDns = pCurr->FirstDnsServerAddress; pDns != NULL; pDns = pDns->Next) {
                if (pDns->Address.lpSockaddr->sa_family == AF_INET) {
                    sockaddr_in* sa_in = (sockaddr_in*)pDns->Address.lpSockaddr;
                    char dnsStr[INET_ADDRSTRLEN] = {0};
                    inet_ntop(AF_INET, &(sa_in->sin_addr), dnsStr, INET_ADDRSTRLEN);
                    record.dnsServers.push_back(dnsStr);
                }
            }

            record.isDefaultRoute = (record.ifIndex == defaultIfIndex);
            record.compatibilityStatus = (record.type == "LOOPBACK") ? "UNSUPPORTED" : "SUPPORTED";

            m_adapters.push_back(record);
        }

        // Sort adapters: Default Internet connection first, then active adapters with IPv4, then others
        std::sort(m_adapters.begin(), m_adapters.end(), [](const NetAdapterRecord& a, const NetAdapterRecord& b) {
            if (a.isDefaultRoute != b.isDefaultRoute) return a.isDefaultRoute > b.isDefaultRoute;
            bool aHasIp = !a.ipv4Addresses.empty() && a.status == "UP";
            bool bHasIp = !b.ipv4Addresses.empty() && b.status == "UP";
            if (aHasIp != bHasIp) return aHasIp > bHasIp;
            if ((a.status == "UP") != (b.status == "UP")) return (a.status == "UP") > (b.status == "UP");
            return a.friendlyName < b.friendlyName;
        });
    }

    free(pAddresses);
}

std::vector<NetAdapterRecord> AdapterManager::GetAdapters() {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_adapters;
}

NetAdapterRecord* AdapterManager::FindAdapterById(const std::string& adapterId) {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& a : m_adapters) {
        if (a.id == adapterId) return &a;
    }
    return nullptr;
}

NetAdapterRecord* AdapterManager::FindAdapterByIndex(DWORD ifIndex) {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& a : m_adapters) {
        if (a.ifIndex == ifIndex) return &a;
    }
    return nullptr;
}

bool AdapterManager::SetDefaultAdapter(const std::string& adapterId, std::string& outError) {
    std::lock_guard<std::mutex> lock(m_mutex);

    // If adapterId is empty or "WINDOWS_AUTO", reset to automatic metric for all adapters
    if (adapterId.empty() || adapterId == "WINDOWS_AUTO" || adapterId == "windows_auto") {
        for (const auto& a : m_adapters) {
            // IPv4
            MIB_IPINTERFACE_ROW row;
            InitializeIpInterfaceEntry(&row);
            row.Family = AF_INET;
            row.InterfaceIndex = a.ifIndex;
            row.UseAutomaticMetric = TRUE;
            row.SitePrefixLength = 0;
            DWORD err4 = SetIpInterfaceEntry(&row);
            if (err4 != NO_ERROR && err4 != ERROR_ACCESS_DENIED) {
                char cmd[256];
                snprintf(cmd, sizeof(cmd), "netsh interface ipv4 set interface %lu metric=automatic >nul 2>&1", a.ifIndex);
                system(cmd);
            }

            // IPv6
            MIB_IPINTERFACE_ROW row6;
            InitializeIpInterfaceEntry(&row6);
            row6.Family = AF_INET6;
            row6.InterfaceIndex = (a.ipv6IfIndex != 0) ? a.ipv6IfIndex : a.ifIndex;
            row6.UseAutomaticMetric = TRUE;
            DWORD err6 = SetIpInterfaceEntry(&row6);
            if (err6 != NO_ERROR && err6 != ERROR_ACCESS_DENIED) {
                char cmd[256];
                snprintf(cmd, sizeof(cmd), "netsh interface ipv6 set interface %lu metric=automatic >nul 2>&1", (a.ipv6IfIndex != 0) ? a.ipv6IfIndex : a.ifIndex);
                system(cmd);
            }
        }

        // Reset default routes in routing table
        PMIB_IPFORWARD_TABLE2 pRouteTable = NULL;
        if (GetIpForwardTable2(AF_INET, &pRouteTable) == NO_ERROR) {
            for (ULONG i = 0; i < pRouteTable->NumEntries; ++i) {
                MIB_IPFORWARD_ROW2& route = pRouteTable->Table[i];
                if (route.DestinationPrefix.Prefix.Ipv4.sin_addr.s_addr == 0 && route.DestinationPrefix.PrefixLength == 0) {
                    route.Metric = 0;
                    SetIpForwardEntry2(&route);
                }
            }
            FreeMibTable(pRouteTable);
        }
        return true;
    }

    NetAdapterRecord* pTarget = nullptr;
    for (auto& a : m_adapters) {
        if (a.id == adapterId) {
            pTarget = &a;
            break;
        }
    }

    if (!pTarget) {
        outError = "Adapter not found: " + adapterId;
        return false;
    }

    DWORD targetIndex = pTarget->ifIndex;

    // Set target interface to lowest metric (5), others to higher metric (35)
    // Applies to both IPv4 and IPv6 so unassigned programs default through this adapter
    for (const auto& a : m_adapters) {
        ULONG metric = (a.ifIndex == targetIndex) ? 5 : 35;

        // IPv4
        MIB_IPINTERFACE_ROW row;
        InitializeIpInterfaceEntry(&row);
        row.Family = AF_INET;
        row.InterfaceIndex = a.ifIndex;
        row.UseAutomaticMetric = FALSE;
        row.Metric = metric;
        row.SitePrefixLength = 0;
        DWORD err = SetIpInterfaceEntry(&row);

        // Fallback to netsh if SetIpInterfaceEntry had an issue (e.g. parameter check)
        if (err != NO_ERROR && err != ERROR_ACCESS_DENIED) {
            char cmd[256];
            snprintf(cmd, sizeof(cmd), "netsh interface ipv4 set interface %lu metric=%lu >nul 2>&1", a.ifIndex, metric);
            int sysRes = system(cmd);
            if (sysRes == 0) {
                err = NO_ERROR;
            }
        }

        if (a.ifIndex == targetIndex && err != NO_ERROR) {
            if (err == ERROR_ACCESS_DENIED) {
                outError = "Administrator privileges required to change Windows default adapter metric. Please run NetSplit as Administrator or install the Windows Service.";
            } else {
                outError = "SetIpInterfaceEntry IPv4 failed: " + std::to_string(err);
            }
            return false;
        }

        // IPv6
        MIB_IPINTERFACE_ROW row6;
        InitializeIpInterfaceEntry(&row6);
        row6.Family = AF_INET6;
        row6.InterfaceIndex = (a.ipv6IfIndex != 0) ? a.ipv6IfIndex : a.ifIndex;
        row6.UseAutomaticMetric = FALSE;
        row6.Metric = metric;
        DWORD err6 = SetIpInterfaceEntry(&row6);
        if (err6 != NO_ERROR && err6 != ERROR_ACCESS_DENIED) {
            char cmd[256];
            snprintf(cmd, sizeof(cmd), "netsh interface ipv6 set interface %lu metric=%lu >nul 2>&1", (a.ipv6IfIndex != 0) ? a.ipv6IfIndex : a.ifIndex, metric);
            system(cmd);
        }
    }

    // Also update active default gateway routes in forwarding table
    PMIB_IPFORWARD_TABLE2 pRouteTable = NULL;
    if (GetIpForwardTable2(AF_INET, &pRouteTable) == NO_ERROR) {
        for (ULONG i = 0; i < pRouteTable->NumEntries; ++i) {
            MIB_IPFORWARD_ROW2& route = pRouteTable->Table[i];
            if (route.DestinationPrefix.Prefix.Ipv4.sin_addr.s_addr == 0 && route.DestinationPrefix.PrefixLength == 0) {
                route.Metric = (route.InterfaceIndex == targetIndex) ? 5 : 35;
                SetIpForwardEntry2(&route);
            }
        }
        FreeMibTable(pRouteTable);
    }

    pRouteTable = NULL;
    if (GetIpForwardTable2(AF_INET6, &pRouteTable) == NO_ERROR) {
        for (ULONG i = 0; i < pRouteTable->NumEntries; ++i) {
            MIB_IPFORWARD_ROW2& route = pRouteTable->Table[i];
            if (route.DestinationPrefix.PrefixLength == 0) {
                route.Metric = (route.InterfaceIndex == targetIndex) ? 5 : 35;
                SetIpForwardEntry2(&route);
            }
        }
        FreeMibTable(pRouteTable);
    }

    return true;
}

