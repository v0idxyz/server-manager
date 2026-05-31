@echo off
REM Launches the Server Manager desktop app.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
call npm start
if errorlevel 1 pause
