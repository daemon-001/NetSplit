#pragma once
#include <windows.h>

#define NETSPLIT_SHARED_MEM_NAME L"Local\\NetSplit_RoutingRules"
#define NETSPLIT_SHARED_MEM_GLOBAL L"Global\\NetSplit_RoutingRules"
#define NETSPLIT_MAX_RULES 64

struct SharedProcessRule {
    wchar_t executablePath[MAX_PATH];
    DWORD ifIndex;
    DWORD ipv6IfIndex;
    char localIpv4[64];
    char localIpv6[64];
    bool blockIfDown;
    bool isAdapterUp;
    bool active;
};

struct SharedRoutingTable {
    DWORD magic; // 0x4E53504C ('NSPL')
    DWORD version;
    DWORD ruleCount;
    SharedProcessRule rules[NETSPLIT_MAX_RULES];
};
