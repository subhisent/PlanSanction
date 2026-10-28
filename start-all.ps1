Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PlanSanction - Smart Building Plan Approval Portal" -ForegroundColor Green
Write-Host "  Starting all services (Python AI + Java Spring + Vite)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Python AI
Write-Host "`n[1/3] Launching Python AI Scrutiny Engine (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\PlanSanction\PlanSanction\python-ai'; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Spring Boot
Write-Host "[2/3] Launching Java Spring Boot Backend (Port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:JAVA_HOME = 'C:\Users\subhi\.jdks\microsoft-jdk-17.0.13\jdk-17.0.13+11'; cd 'd:\PlanSanction\PlanSanction\java-backend'; .\mvnw.cmd spring-boot:run"

# 3. Start Frontend
Write-Host "[3/3] Launching React Vite Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\PlanSanction\PlanSanction'; npm run dev"

Write-Host "`nAll 3 services have been launched in separate terminal windows." -ForegroundColor Green
Write-Host "Opening portal in browser at http://localhost:5173..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
