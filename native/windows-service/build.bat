@echo off
setlocal
echo Compiling NetSplit Windows Service...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

cl.exe /nologo /EHsc /O2 /W3 /std:c++17 ^
    native\windows-service\src\adapter_manager.cpp ^
    native\windows-service\src\app_discovery.cpp ^
    native\windows-service\src\assignment_manager.cpp ^
    native\windows-service\src\wfp_routing_engine.cpp ^
    native\windows-service\src\ipc_server.cpp ^
    native\windows-service\src\service_main.cpp ^
    /I native\windows-service\src ^
    /Fe:native\windows-service\NetSplitService.exe ^
    /link ws2_32.lib iphlpapi.lib version.lib shlwapi.lib fwpuclnt.lib bcrypt.lib advapi32.lib shell32.lib ole32.lib

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] NetSplitService.exe compiled successfully!
) else (
    echo [ERROR] Compilation failed with error code %ERRORLEVEL%
)
endlocal
