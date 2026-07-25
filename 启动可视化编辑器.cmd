@echo off
cd /d "%~dp0"
title Personal Portfolio Visual Editor
set "CODEX_NODE_DIR=C:\Users\Administrator\Documents\Codex\Tools\nodejs"
if exist "%CODEX_NODE_DIR%\npm.cmd" (
  "%CODEX_NODE_DIR%\npm.cmd" run editor
) else (
  npm.cmd run editor
)
pause
