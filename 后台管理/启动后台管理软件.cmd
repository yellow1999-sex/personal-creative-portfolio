@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动后台管理软件.ps1"
if errorlevel 1 pause
