@echo off
rem ── Abi Peters Launch OS — one-click local start ────────────────────────────
rem Starts the API (port 5000) and the app (port 8090), then opens the browser.
rem Safe to run again if something stopped — it skips anything already running.

cd /d "%~dp0"

rem API (skip if already listening on 5000)
netstat -ano | findstr /r ":5000 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting API...
  start "Launch OS API" /min cmd /c "node --enable-source-maps --env-file-if-exists=./.env ./artifacts/api-server/dist/index.mjs"
) else (
  echo API already running.
)

rem Frontend (skip if already listening on 8090)
netstat -ano | findstr /r ":8090 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting app...
  start "Launch OS App" /min cmd /c "node artifacts\clinic-launch-os\node_modules\vite\bin\vite.js --config artifacts\clinic-launch-os\vite.config.ts --host 0.0.0.0 --port 8090 --strictPort"
) else (
  echo App already running.
)

timeout /t 6 /nobreak >nul
start http://localhost:8090/
echo.
echo Launch OS is starting at http://localhost:8090 — this window can be closed.
timeout /t 4 /nobreak >nul
