@echo off
rem Inicia o ambiente ChokNexus: backend Node (server) + auto deploy do frontend.
cd /d "%~dp0"

netstat -ano | findstr /R /C:":3311 .*LISTENING" >nul
if errorlevel 1 (
    start "ChokNexus Backend" /D "%~dp0server" cmd /k npm start
) else (
    echo Backend ja esta em execucao na porta 3311.
)

start "ChokNexus Auto Deploy" /D "%~dp0" cmd /k node tools\auto-deploy.mjs
