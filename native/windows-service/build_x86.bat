@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsamd64_x86.bat"
cl.exe /nologo /LD /EHsc /O2 /W3 /std:c++17 ^
    native\router\NetSplitRouter.cpp ^
    native\minhook\src\buffer.c ^
    native\minhook\src\hook.c ^
    native\minhook\src\trampoline.c ^
    native\minhook\src\hde\hde32.c ^
    /I native\minhook\include ^
    /I native\minhook\src ^
    /I native\common ^
    /Fe:native\windows-service\NetSplitRouter32.dll ^
    /link ws2_32.lib iphlpapi.lib
if %ERRORLEVEL% equ 0 (
    copy /y native\windows-service\NetSplitRouter32.dll native\router\NetSplitRouter32.dll >nul 2>&1
)
