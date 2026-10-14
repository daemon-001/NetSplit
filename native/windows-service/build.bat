@echo off
setlocal
echo Compiling NetSplit Router DLLs and Windows Service...

if not exist native\router mkdir native\router

REM Handle temporarily locked DLLs by moving them if needed
if exist native\windows-service\NetSplitRouter.dll (
    del /f /q native\windows-service\NetSplitRouter.dll >nul 2>&1
    if exist native\windows-service\NetSplitRouter.dll (
        move /y native\windows-service\NetSplitRouter.dll native\windows-service\NetSplitRouter.dll.old >nul 2>&1
    )
)
if exist native\windows-service\NetSplitRouter32.dll (
    del /f /q native\windows-service\NetSplitRouter32.dll >nul 2>&1
    if exist native\windows-service\NetSplitRouter32.dll (
        move /y native\windows-service\NetSplitRouter32.dll native\windows-service\NetSplitRouter32.dll.old >nul 2>&1
    )
)

echo [1/3] Compiling NetSplitRouter.dll x64...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cl.exe /nologo /LD /EHsc /O2 /W3 /std:c++17 ^
    native\router\NetSplitRouter.cpp ^
    native\minhook\src\buffer.c ^
    native\minhook\src\hook.c ^
    native\minhook\src\trampoline.c ^
    native\minhook\src\hde\hde64.c ^
    /I native\minhook\include ^
    /I native\minhook\src ^
    /I native\common ^
    /Fe:native\windows-service\NetSplitRouter.dll ^
    /link ws2_32.lib iphlpapi.lib

if %ERRORLEVEL% neq 0 (
    echo [ERROR] NetSplitRouter.dll x64 compilation failed with error %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
copy /y native\windows-service\NetSplitRouter.dll native\router\NetSplitRouter.dll >nul 2>&1

echo [2/3] Compiling NetSplitRouter32.dll x86...
cmd.exe /c "native\windows-service\build_x86.bat >nul"

if %ERRORLEVEL% neq 0 (
    echo [WARNING] NetSplitRouter32.dll x86 compilation failed or was skipped.
) else (
    copy /y native\windows-service\NetSplitRouter32.dll native\router\NetSplitRouter32.dll >nul 2>&1
)

echo [3/3] Compiling NetSplitService.exe x64...
cl.exe /nologo /EHsc /O2 /W3 /std:c++17 ^
    native\windows-service\src\adapter_manager.cpp ^
    native\windows-service\src\app_discovery.cpp ^
    native\windows-service\src\assignment_manager.cpp ^
    native\windows-service\src\wfp_routing_engine.cpp ^
    native\windows-service\src\ipc_server.cpp ^
    native\windows-service\src\service_main.cpp ^
    /I native\windows-service\src ^
    /I native\common ^
    /Fe:native\windows-service\NetSplitService.exe ^
    /link ws2_32.lib iphlpapi.lib version.lib shlwapi.lib fwpuclnt.lib bcrypt.lib advapi32.lib shell32.lib ole32.lib user32.lib

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] NetSplitRouter.dll x64, NetSplitRouter32.dll x86, and NetSplitService.exe compiled successfully!
) else (
    echo [ERROR] Service compilation failed with error code %ERRORLEVEL%
)
endlocal
