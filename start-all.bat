@echo off
title PlanSanction Launcher
echo ========================================================
echo   PlanSanction - Smart Building Plan Approval Portal
echo   Starting all services (Python AI + Java Spring + Vite)
echo ========================================================
echo.

echo [1/3] Starting Python AI Scrutiny Service (Port 8000)...
start "PlanSanction - Python AI (Port 8000)" cmd /k "cd /d d:\PlanSanction\PlanSanction\python-ai && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Java Spring Boot Backend (Port 8080)...
start "PlanSanction - Java Backend (Port 8080)" cmd /k "cd /d d:\PlanSanction\PlanSanction\java-backend && set JAVA_HOME=C:\Users\subhi\.jdks\microsoft-jdk-17.0.13\jdk-17.0.13+11 && mvnw.cmd spring-boot:run"

echo [3/3] Starting React Frontend (Port 5173)...
start "PlanSanction - React Frontend (Port 5173)" cmd /k "cd /d d:\PlanSanction\PlanSanction && npm run dev"

echo.
echo ========================================================
echo   All 3 services launched in separate windows!
echo   Frontend URL : http://localhost:5173
echo   Java Backend : http://localhost:8080
echo   Python AI    : http://localhost:8000/docs
echo ========================================================
echo.
timeout /t 5 >nul
start http://localhost:5173
