#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <mswsock.h>
#include <iphlpapi.h>
#include <string>
#include <algorithm>
#include <cwctype>
#include "../minhook/include/MinHook.h"
#include "../common/routing_shared.hpp"

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "iphlpapi.lib")

static const GUID GUID_CONNECTEX = {0x25a207b9, 0xddf3, 0x4660, {0x8e, 0xe9, 0x76, 0xe5, 0x8c, 0x74, 0x06, 0x3e}};

typedef int (WSAAPI *connect_fn)(SOCKET s, const struct sockaddr *name, int namelen);
typedef int (WSAAPI *WSAConnect_fn)(SOCKET s, const struct sockaddr *name, int namelen,
                                    LPWSABUF lpCallerData, LPWSABUF lpCalleeData,
                                    LPQOS lpSQOS, LPQOS lpGQOS);
typedef int (WSAAPI *sendto_fn)(SOCKET s, const char *buf, int len, int flags,
                                const struct sockaddr *to, int tolen);
typedef int (WSAAPI *WSASendTo_fn)(SOCKET s, LPWSABUF lpBuffers, DWORD dwBufferCount,
                                   LPDWORD lpNumberOfBytesSent, DWORD dwFlags,
                                   const struct sockaddr *lpTo, int iTolen,
                                   LPWSAOVERLAPPED lpOverlapped,
                                   LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine);
typedef int (WSAAPI *bind_fn)(SOCKET s, const struct sockaddr *name, int namelen);
typedef int (WSAAPI *WSAIoctl_fn)(SOCKET s, DWORD dwIoControlCode, LPVOID lpvInBuffer,
                                  DWORD cbInBuffer, LPVOID lpvOutBuffer, DWORD cbOutBuffer,
                                  LPDWORD lpcbBytesReturned, LPWSAOVERLAPPED lpOverlapped,
                                  LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine);
typedef BOOL (PASCAL *ConnectEx_fn)(SOCKET s, const struct sockaddr *name, int namelen,
                                    PVOID lpSendBuffer, DWORD dwSendDataLength,
                                    LPDWORD lpdwBytesSent, LPOVERLAPPED lpOverlapped);

static connect_fn fpConnect = NULL;
static WSAConnect_fn fpWSAConnect = NULL;
static sendto_fn fpSendTo = NULL;
static WSASendTo_fn fpWSASendTo = NULL;
static bind_fn fpBind = NULL;
static WSAIoctl_fn fpWSAIoctl = NULL;
static ConnectEx_fn fpConnectEx = NULL;

static HANDLE g_hSharedMap = NULL;
static SharedRoutingTable* g_pSharedTable = NULL;
static wchar_t g_myExePath[MAX_PATH] = {0};
static wchar_t g_myExeName[MAX_PATH] = {0};

static std::wstring ToLowerW(const std::wstring& s) {
    std::wstring out = s;
    std::transform(out.begin(), out.end(), out.begin(), [](wchar_t c) { return std::towlower(c); });
    return out;
}

static void InitSharedMemory() {
    if (g_pSharedTable) return;

    g_hSharedMap = OpenFileMappingW(FILE_MAP_READ, FALSE, NETSPLIT_SHARED_MEM_GLOBAL);
    if (!g_hSharedMap) {
        g_hSharedMap = OpenFileMappingW(FILE_MAP_READ, FALSE, NETSPLIT_SHARED_MEM_NAME);
    }

    if (g_hSharedMap) {
        g_pSharedTable = (SharedRoutingTable*)MapViewOfFile(g_hSharedMap, FILE_MAP_READ, 0, 0, sizeof(SharedRoutingTable));
    }
}

static bool FindMatchingRule(SharedProcessRule& outRule) {
    InitSharedMemory();
    if (!g_pSharedTable) return false;

    std::wstring myPathLower = ToLowerW(g_myExePath);
    std::wstring myNameLower = ToLowerW(g_myExeName);

    DWORD count = g_pSharedTable->ruleCount;
    if (count > NETSPLIT_MAX_RULES) count = NETSPLIT_MAX_RULES;

    for (DWORD i = 0; i < count; ++i) {
        const auto& r = g_pSharedTable->rules[i];
        if (!r.active) continue;

        std::wstring rulePathLower = ToLowerW(r.executablePath);
        if (rulePathLower.empty()) continue;

        // Extract rule filename
        size_t lastSlash = rulePathLower.find_last_of(L"\\/");
        std::wstring ruleNameLower = (lastSlash != std::wstring::npos) ? rulePathLower.substr(lastSlash + 1) : rulePathLower;

        if (myPathLower == rulePathLower || myNameLower == ruleNameLower) {
            outRule = r;
            return true;
        }
    }
    return false;
}

static void BindSocketIfApplicable(SOCKET s, const struct sockaddr *name) {
    if (!name || (name->sa_family != AF_INET && name->sa_family != AF_INET6)) {
        return;
    }

    SharedProcessRule rule;
    if (!FindMatchingRule(rule)) {
        return;
    }

    if (name->sa_family == AF_INET) {
        const sockaddr_in* pDest = (const sockaddr_in*)name;
        // Ignore loopback (127.0.0.0/8)
        if ((ntohl(pDest->sin_addr.s_addr) & 0xFF000000) == 0x7F000000) {
            return;
        }

        if (rule.ifIndex != 0) {
            // Force interface via IP_UNICAST_IF (network byte order)
            DWORD netIfIndex = htonl(rule.ifIndex);
            setsockopt(s, IPPROTO_IP, IP_UNICAST_IF, (const char*)&netIfIndex, sizeof(netIfIndex));

            // Check if socket is already bound. If unbound (port is 0), bind to local IP!
            sockaddr_in localCheck = {0};
            int localCheckLen = sizeof(localCheck);
            if (getsockname(s, (sockaddr*)&localCheck, &localCheckLen) == 0) {
                if (localCheck.sin_addr.s_addr == INADDR_ANY && localCheck.sin_port == 0) {
                    if (rule.localIpv4[0] != '\0') {
                        sockaddr_in localAddr = {0};
                        localAddr.sin_family = AF_INET;
                        localAddr.sin_port = 0;
                        inet_pton(AF_INET, rule.localIpv4, &localAddr.sin_addr);
                        bind(s, (SOCKADDR*)&localAddr, sizeof(localAddr));
                    }
                }
            }
        }
    } else if (name->sa_family == AF_INET6) {
        const sockaddr_in6* pDest6 = (const sockaddr_in6*)name;
        if (IN6_IS_ADDR_LOOPBACK(&pDest6->sin6_addr)) {
            return;
        }

        if (rule.ipv6IfIndex != 0) {
            DWORD ifIndex = rule.ipv6IfIndex; // host byte order for IPv6
            setsockopt(s, IPPROTO_IPV6, IPV6_UNICAST_IF, (const char*)&ifIndex, sizeof(ifIndex));

            sockaddr_in6 localCheck6 = {0};
            int localCheckLen6 = sizeof(localCheck6);
            if (getsockname(s, (sockaddr*)&localCheck6, &localCheckLen6) == 0) {
                if (IN6_IS_ADDR_UNSPECIFIED(&localCheck6.sin6_addr) && localCheck6.sin6_port == 0) {
                    if (rule.localIpv6[0] != '\0') {
                        sockaddr_in6 localAddr6 = {0};
                        localAddr6.sin6_family = AF_INET6;
                        localAddr6.sin6_port = 0;
                        inet_pton(AF_INET6, rule.localIpv6, &localAddr6.sin6_addr);
                        bind(s, (SOCKADDR*)&localAddr6, sizeof(localAddr6));
                    }
                }
            }
        }
    }
}

int WSAAPI Detour_connect(SOCKET s, const struct sockaddr *name, int namelen) {
    BindSocketIfApplicable(s, name);
    return fpConnect(s, name, namelen);
}

int WSAAPI Detour_WSAConnect(SOCKET s, const struct sockaddr *name, int namelen,
                             LPWSABUF lpCallerData, LPWSABUF lpCalleeData,
                             LPQOS lpSQOS, LPQOS lpGQOS) {
    BindSocketIfApplicable(s, name);
    return fpWSAConnect(s, name, namelen, lpCallerData, lpCalleeData, lpSQOS, lpGQOS);
}

int WSAAPI Detour_sendto(SOCKET s, const char *buf, int len, int flags,
                         const struct sockaddr *to, int tolen) {
    BindSocketIfApplicable(s, to);
    return fpSendTo(s, buf, len, flags, to, tolen);
}

int WSAAPI Detour_WSASendTo(SOCKET s, LPWSABUF lpBuffers, DWORD dwBufferCount,
                            LPDWORD lpNumberOfBytesSent, DWORD dwFlags,
                            const struct sockaddr *lpTo, int iTolen,
                            LPWSAOVERLAPPED lpOverlapped,
                            LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine) {
    BindSocketIfApplicable(s, lpTo);
    return fpWSASendTo(s, lpBuffers, dwBufferCount, lpNumberOfBytesSent, dwFlags,
                       lpTo, iTolen, lpOverlapped, lpCompletionRoutine);
}

int WSAAPI Detour_bind(SOCKET s, const struct sockaddr *name, int namelen) {
    if (!name || (name->sa_family != AF_INET && name->sa_family != AF_INET6)) {
        return fpBind(s, name, namelen);
    }

    SharedProcessRule rule;
    if (!FindMatchingRule(rule)) {
        return fpBind(s, name, namelen);
    }

    if (name->sa_family == AF_INET) {
        const sockaddr_in* sin = (const sockaddr_in*)name;
        // If binding explicitly to loopback (127.0.0.0/8), preserve it!
        if ((ntohl(sin->sin_addr.s_addr) & 0xFF000000) == 0x7F000000) {
            return fpBind(s, name, namelen);
        }

        // If binding to INADDR_ANY (0.0.0.0) with port 0 (standard for client sockets before ConnectEx)
        if (sin->sin_addr.s_addr == INADDR_ANY && sin->sin_port == 0) {
            if (rule.ifIndex != 0) {
                DWORD netIf = htonl(rule.ifIndex);
                setsockopt(s, IPPROTO_IP, IP_UNICAST_IF, (const char*)&netIf, sizeof(netIf));
            }
            if (rule.localIpv4[0] != '\0') {
                sockaddr_in localAddr = *sin;
                inet_pton(AF_INET, rule.localIpv4, &localAddr.sin_addr);
                return fpBind(s, (const struct sockaddr*)&localAddr, namelen);
            }
        }
    } else if (name->sa_family == AF_INET6) {
        const sockaddr_in6* sin6 = (const sockaddr_in6*)name;
        if (IN6_IS_ADDR_LOOPBACK(&sin6->sin6_addr)) {
            return fpBind(s, name, namelen);
        }

        if (IN6_IS_ADDR_UNSPECIFIED(&sin6->sin6_addr) && sin6->sin6_port == 0) {
            if (rule.ipv6IfIndex != 0) {
                DWORD ifIdx = rule.ipv6IfIndex;
                setsockopt(s, IPPROTO_IPV6, IPV6_UNICAST_IF, (const char*)&ifIdx, sizeof(ifIdx));
            }
            if (rule.localIpv6[0] != '\0') {
                sockaddr_in6 localAddr6 = *sin6;
                inet_pton(AF_INET6, rule.localIpv6, &localAddr6.sin6_addr);
                return fpBind(s, (const struct sockaddr*)&localAddr6, namelen);
            }
        }
    }

    return fpBind(s, name, namelen);
}

BOOL PASCAL Detour_ConnectEx(
    SOCKET s,
    const struct sockaddr *name,
    int namelen,
    PVOID lpSendBuffer,
    DWORD dwSendDataLength,
    LPDWORD lpdwBytesSent,
    LPOVERLAPPED lpOverlapped
) {
    BindSocketIfApplicable(s, name);
    if (fpConnectEx) {
        return fpConnectEx(s, name, namelen, lpSendBuffer, dwSendDataLength, lpdwBytesSent, lpOverlapped);
    }
    return FALSE;
}

int WSAAPI Detour_WSAIoctl(
    SOCKET s,
    DWORD dwIoControlCode,
    LPVOID lpvInBuffer,
    DWORD cbInBuffer,
    LPVOID lpvOutBuffer,
    DWORD cbOutBuffer,
    LPDWORD lpcbBytesReturned,
    LPWSAOVERLAPPED lpOverlapped,
    LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine
) {
    int ret = fpWSAIoctl(s, dwIoControlCode, lpvInBuffer, cbInBuffer, lpvOutBuffer, cbOutBuffer,
                         lpcbBytesReturned, lpOverlapped, lpCompletionRoutine);
    if (ret == 0 && dwIoControlCode == SIO_GET_EXTENSION_FUNCTION_POINTER &&
        lpvInBuffer && cbInBuffer >= sizeof(GUID) && lpvOutBuffer && cbOutBuffer >= sizeof(void*)) {
        if (memcmp(lpvInBuffer, &GUID_CONNECTEX, sizeof(GUID)) == 0) {
            LPFN_CONNECTEX realFn = *(LPFN_CONNECTEX*)lpvOutBuffer;
            if (realFn && realFn != (LPFN_CONNECTEX)&Detour_ConnectEx) {
                if (!fpConnectEx) {
                    fpConnectEx = realFn;
                    MH_CreateHook((LPVOID)realFn, (LPVOID)&Detour_ConnectEx, (LPVOID*)&fpConnectEx);
                    MH_EnableHook((LPVOID)realFn);
                }
                *(LPFN_CONNECTEX*)lpvOutBuffer = &Detour_ConnectEx;
            }
        }
    }
    return ret;
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    if (fdwReason == DLL_PROCESS_ATTACH) {
        DisableThreadLibraryCalls(hinstDLL);

        GetModuleFileNameW(NULL, g_myExePath, MAX_PATH);
        wchar_t* pSlash = wcsrchr(g_myExePath, L'\\');
        if (pSlash) {
            wcsncpy_s(g_myExeName, MAX_PATH, pSlash + 1, _TRUNCATE);
        } else {
            wcsncpy_s(g_myExeName, MAX_PATH, g_myExePath, _TRUNCATE);
        }

        if (MH_Initialize() == MH_OK) {
            MH_CreateHookApi(L"ws2_32.dll", "connect", (LPVOID)&Detour_connect, (LPVOID*)&fpConnect);
            MH_CreateHookApi(L"ws2_32.dll", "WSAConnect", (LPVOID)&Detour_WSAConnect, (LPVOID*)&fpWSAConnect);
            MH_CreateHookApi(L"ws2_32.dll", "sendto", (LPVOID)&Detour_sendto, (LPVOID*)&fpSendTo);
            MH_CreateHookApi(L"ws2_32.dll", "WSASendTo", (LPVOID)&Detour_WSASendTo, (LPVOID*)&fpWSASendTo);
            MH_CreateHookApi(L"ws2_32.dll", "bind", (LPVOID)&Detour_bind, (LPVOID*)&fpBind);
            MH_CreateHookApi(L"ws2_32.dll", "WSAIoctl", (LPVOID)&Detour_WSAIoctl, (LPVOID*)&fpWSAIoctl);

            // Pre-resolve and hook ConnectEx directly via a temporary dummy socket
            SOCKET dummy = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
            if (dummy != INVALID_SOCKET) {
                LPFN_CONNECTEX pfnConnectEx = NULL;
                GUID guid = GUID_CONNECTEX;
                DWORD bytes = 0;
                if (WSAIoctl(dummy, SIO_GET_EXTENSION_FUNCTION_POINTER, &guid, sizeof(guid),
                             &pfnConnectEx, sizeof(pfnConnectEx), &bytes, NULL, NULL) == 0 && pfnConnectEx) {
                    fpConnectEx = pfnConnectEx;
                    MH_CreateHook((LPVOID)pfnConnectEx, (LPVOID)&Detour_ConnectEx, (LPVOID*)&fpConnectEx);
                }
                closesocket(dummy);
            }

            MH_EnableHook(MH_ALL_HOOKS);
        }
    } else if (fdwReason == DLL_PROCESS_DETACH) {
        MH_DisableHook(MH_ALL_HOOKS);
        MH_Uninitialize();

        if (g_pSharedTable) {
            UnmapViewOfFile(g_pSharedTable);
            g_pSharedTable = NULL;
        }
        if (g_hSharedMap) {
            CloseHandle(g_hSharedMap);
            g_hSharedMap = NULL;
        }
    }
    return TRUE;
}
