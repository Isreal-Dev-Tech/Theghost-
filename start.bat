@echo off
echo ========================================
echo  TikTok Country Race Game
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed! Please install Python 3.8+
    pause
    exit /b 1
)

REM Install dependencies if needed
echo Checking dependencies...
pip install -r backend/requirements.txt

echo.
echo ========================================
echo  Choose Mode:
echo ========================================
echo 1. Test Mode (manual gifts)
echo 2. Live Mode (connect to TikTok)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo Starting in TEST MODE...
    python backend/server.py --test
) else if "%choice%"=="2" (
    set /p username="Enter your TikTok username (without @): "
    echo Starting LIVE MODE for @%username%...
    python backend/server.py --username %username%
) else (
    echo Invalid choice!
    pause
)
