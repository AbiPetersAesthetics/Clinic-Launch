@echo off
rem Starts the Clinic Launch OS locally: API on port 5000, website on port 8090.
rem Close both terminal windows to stop it.
start "Clinic Launch API (port 5000)" cmd /k "cd /d %~dp0 && set PORT=5000&& pnpm --filter @workspace/api-server run dev"
start "Clinic Launch Website (port 8090)" cmd /k "cd /d %~dp0artifacts\clinic-launch-os && set PORT=8090&& set BASE_PATH=/&& pnpm run dev"
echo Waiting for servers to start...
timeout /t 10 >nul
start http://localhost:8090/
