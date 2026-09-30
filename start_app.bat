@echo off
title ZenViva Launcher
cd /d "%~dp0"

echo ===================================================
echo               Starting ZenViva...
echo ===================================================

:: Check if server is already running on port 5000
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo Server is already active on port 5000!
    echo Opening browser at http://127.0.0.1:5000...
    start http://127.0.0.1:5000
    exit /b 0
)

:: Start the Flask server
start "ZenViva Server" python app.py

:: Wait 2 seconds for the server to bind
timeout /t 2 /nobreak >nul

:: Open default browser
start http://127.0.0.1:5000

echo Application launched successfully!
exit /b 0
