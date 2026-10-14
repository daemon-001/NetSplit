#include "common_net.hpp"
#include <stdio.h>
#include "adapter_manager.hpp"
#include "app_discovery.hpp"
#include "assignment_manager.hpp"
#include "wfp_routing_engine.hpp"
#include "ipc_server.hpp"

#define SERVICE_NAME L"NetSplitService"
#define SERVICE_DISPLAY_NAME L"NetSplit Network Routing Service"

static std::atomic<bool> g_stopRequested{false};
static SERVICE_STATUS_HANDLE g_statusHandle = NULL;
static SERVICE_STATUS g_serviceStatus = {0};

BOOL WINAPI ConsoleCtrlHandler(DWORD ctrlType) {
    if (ctrlType == CTRL_C_EVENT || ctrlType == CTRL_BREAK_EVENT || ctrlType == CTRL_CLOSE_EVENT) {
        printf("\n[NetSplit] Shutdown requested. Cleaning up network filters...\n");
        g_stopRequested = true;
        return TRUE;
    }
    return FALSE;
}

static std::string GetAppDataFolder() {
    wchar_t path[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, path))) {
        std::wstring wpath = path;
        wpath += L"\\NetSplit";
        CreateDirectoryW(wpath.c_str(), NULL);
        int size = WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), (int)wpath.size(), NULL, 0, NULL, NULL);
        std::string str(size, 0);
        WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), (int)wpath.size(), &str[0], size, NULL, NULL);
        return str;
    }
    CreateDirectoryW(L".\\data", NULL);
    return ".\\data";
}

void RunDaemon(bool isService) {
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);

    std::string appData = GetAppDataFolder();
    std::string configPath = appData + "\\config.json";
    std::string tokenPath = appData + "\\ipc_auth.token";

    printf("====================================================================\n");
    printf("   NetSplit - Privileged Windows Networking Service Daemon          \n");
    printf("====================================================================\n");
    printf("Config path: %s\n", configPath.c_str());
    printf("Token path:  %s\n", tokenPath.c_str());

    AdapterManager adapterMgr;
    adapterMgr.Initialize();

    AppDiscoveryManager appMgr;
    appMgr.Initialize();

    AssignmentManager assignMgr(configPath);
    assignMgr.Load();

    WfpRoutingEngine routingEngine(&adapterMgr);
    routingEngine.Initialize();

    // Re-apply any persisted active rules
    auto existingRules = assignMgr.GetAllRules();
    for (const auto& r : existingRules) {
        if (r.enabled) {
            std::string err;
            if (routingEngine.ApplyRule(r, err)) {
                assignMgr.UpdateRuleStatus(r.id, "ACTIVE");
            } else {
                assignMgr.UpdateRuleStatus(r.id, "ERROR", err);
            }
        }
    }

    // Re-apply any persisted default adapter setting
    GlobalConfig cfg = assignMgr.GetGlobalConfig();
    if (cfg.defaultRoutingPolicy == "PREFER_ADAPTER" && !cfg.defaultAdapterId.empty()) {
        std::string defErr;
        if (adapterMgr.SetDefaultAdapter(cfg.defaultAdapterId, defErr)) {
            printf("[NetSplit] Applied persisted default adapter: %s (metric 5)\n", cfg.defaultAdapterId.c_str());
        } else {
            printf("[NetSplit] Notice: default adapter %s not applied: %s\n", cfg.defaultAdapterId.c_str(), defErr.c_str());
        }
    }

    IpcServer ipcServer(48192, tokenPath, &adapterMgr, &appMgr, &assignMgr, &routingEngine);
    ipcServer.Start();

    printf("\n[NetSplit] Core service daemon active. Press Ctrl+C to terminate.\n");

    while (!g_stopRequested) {
        Sleep(500);
    }

    printf("[NetSplit] Stopping IPC server...\n");
    ipcServer.Stop();

    printf("[NetSplit] Releasing WFP routing engine filters...\n");
    routingEngine.Shutdown();

    printf("[NetSplit] Restoring Windows default adapter route metrics...\n");
    std::string resetErr;
    adapterMgr.SetDefaultAdapter("WINDOWS_AUTO", resetErr);

    printf("[NetSplit] Saving assignment configuration...\n");
    assignMgr.Save();

    WSACleanup();
    printf("[NetSplit] Clean shutdown complete.\n");
}

VOID WINAPI ServiceCtrlHandler(DWORD control) {
    switch (control) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            g_serviceStatus.dwCurrentState = SERVICE_STOP_PENDING;
            SetServiceStatus(g_statusHandle, &g_serviceStatus);
            g_stopRequested = true;
            break;
        default:
            break;
    }
}

VOID WINAPI ServiceMain(DWORD, LPWSTR*) {
    g_statusHandle = RegisterServiceCtrlHandlerW(SERVICE_NAME, ServiceCtrlHandler);
    if (!g_statusHandle) return;

    g_serviceStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    g_serviceStatus.dwCurrentState = SERVICE_RUNNING;
    g_serviceStatus.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN;
    SetServiceStatus(g_statusHandle, &g_serviceStatus);

    RunDaemon(true);

    g_serviceStatus.dwCurrentState = SERVICE_STOPPED;
    SetServiceStatus(g_statusHandle, &g_serviceStatus);
}

bool InstallService() {
    SC_HANDLE schSCManager = OpenSCManagerW(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!schSCManager) {
        printf("[ERROR] OpenSCManager failed: %lu (Administrator rights required)\n", GetLastError());
        return false;
    }

    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::wstring binaryPath = L"\"";
    binaryPath += exePath;
    binaryPath += L"\" --run-service";

    SC_HANDLE schService = CreateServiceW(
        schSCManager,
        SERVICE_NAME,
        SERVICE_DISPLAY_NAME,
        SERVICE_ALL_ACCESS,
        SERVICE_WIN32_OWN_PROCESS,
        SERVICE_AUTO_START,
        SERVICE_ERROR_NORMAL,
        binaryPath.c_str(),
        NULL, NULL, NULL, NULL, NULL
    );

    if (!schService) {
        DWORD err = GetLastError();
        if (err == ERROR_SERVICE_EXISTS) {
            printf("[INFO] Service is already installed.\n");
        } else {
            printf("[ERROR] CreateService failed: %lu\n", err);
            CloseServiceHandle(schSCManager);
            return false;
        }
    } else {
        printf("[SUCCESS] NetSplit Windows Service installed successfully.\n");
        CloseServiceHandle(schService);
    }

    CloseServiceHandle(schSCManager);
    return true;
}

bool UninstallService() {
    SC_HANDLE schSCManager = OpenSCManagerW(NULL, NULL, SC_MANAGER_ALL_ACCESS);
    if (!schSCManager) {
        printf("[ERROR] OpenSCManager failed: %lu (Administrator rights required)\n", GetLastError());
        return false;
    }

    SC_HANDLE schService = OpenServiceW(schSCManager, SERVICE_NAME, SERVICE_STOP | DELETE);
    if (!schService) {
        printf("[ERROR] OpenService failed: %lu\n", GetLastError());
        CloseServiceHandle(schSCManager);
        return false;
    }

    SERVICE_STATUS status;
    ControlService(schService, SERVICE_CONTROL_STOP, &status);

    if (DeleteService(schService)) {
        printf("[SUCCESS] NetSplit Windows Service uninstalled successfully.\n");
    } else {
        printf("[ERROR] DeleteService failed: %lu\n", GetLastError());
    }

    CloseServiceHandle(schService);
    CloseServiceHandle(schSCManager);
    return true;
}

int main(int argc, char* argv[]) {
    // Ensure only one service instance runs at a time
    HANDLE hSingleInstance = CreateMutexW(NULL, TRUE, L"Local\\NetSplitService_SingleInstance");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        printf("[NetSplit] Service instance is already running.\n");
        if (hSingleInstance) CloseHandle(hSingleInstance);
        return 0;
    }

    SetConsoleCtrlHandler(ConsoleCtrlHandler, TRUE);

    if (argc > 1) {
        std::string arg = argv[1];
        if (arg == "--install") {
            return InstallService() ? 0 : 1;
        } else if (arg == "--uninstall") {
            return UninstallService() ? 0 : 1;
        } else if (arg == "--run-service") {
            SERVICE_TABLE_ENTRYW serviceTable[] = {
                { (LPWSTR)SERVICE_NAME, (LPSERVICE_MAIN_FUNCTIONW)ServiceMain },
                { NULL, NULL }
            };
            StartServiceCtrlDispatcherW(serviceTable);
            return 0;
        } else if (arg == "--background" || arg == "--hidden") {
            HWND hWnd = GetConsoleWindow();
            if (hWnd) {
                ShowWindow(hWnd, SW_HIDE);
            }
        }
    }

    // Default: Run interactively
    RunDaemon(false);
    return 0;
}
