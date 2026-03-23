@echo off
echo ========================================
echo   SkillForge AI - Setup and Start
echo ========================================
echo.

REM ---- BACKEND SETUP ----
echo [1/6] Setting up Django backend...
cd backend

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python packages...
pip install -r requirements.txt --quiet

echo Running database migrations...
python manage.py makemigrations --verbosity 0
python manage.py migrate --verbosity 0

echo.
echo [2/6] Starting Django server on port 8000...
start "Django Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python manage.py runserver"

REM ---- FRONTEND SETUP ----
echo.
echo [3/6] Setting up React frontend...
cd ..\frontend

echo Installing Node packages (first time may take a few minutes)...
call npm install --silent

echo.
echo [4/6] Starting React dev server on port 5173...
start "React Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Both servers starting...
echo   Open browser: http://localhost:5173
echo ========================================
echo.

REM ---- OLLAMA CHECK ----
echo [5/6] Checking Ollama...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] Ollama not found - AI will use fallback questions
    echo  To install Ollama: https://ollama.com/download
    echo  After install run: ollama pull llama3.2
    echo.
) else (
    echo Ollama found! Starting llama3.2 model...
    start "Ollama" cmd /k "ollama serve"
    timeout /t 3 /nobreak >nul
    ollama pull llama3.2
)

echo.
echo [6/6] Opening browser...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo  App is running! Press any key to exit this window.
echo  (Django and React windows will keep running)
pause >nul
