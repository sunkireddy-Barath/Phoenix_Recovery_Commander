@echo off
title Phoenix Recovery Commander

echo.
echo  =====================================================
echo   PHOENIX RECOVERY COMMANDER — Starting...
echo  =====================================================
echo.

:: Kill any existing processes on the required ports
echo  Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 1 /nobreak >nul

:: Start backend in a new window
echo  [1/2] Starting Backend  (http://localhost:3001)...
start "Phoenix Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

:: Give backend a moment to bind the port
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo  [2/2] Starting Frontend (http://localhost:5173)...
start "Phoenix Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  Both servers are launching in separate windows.
echo  Open http://localhost:5173 in your browser.
echo.
pause
