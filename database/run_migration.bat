@echo off
REM Database Migration Runner for Windows
REM This script runs the payment due date migration

echo Starting Payment Due Date Migration...

REM Set default database connection values
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_NAME=local_services_db

REM Load environment variables from backend .env file if it exists
if exist "..\backend\.env" (
    echo Loading environment variables from .env file...
    for /f "usebackq tokens=1,2 delims==" %%a in ("..\backend\.env") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set %%a=%%b
        )
    )
)

echo Connecting to database: %DB_NAME% on %DB_HOST%:%DB_PORT%
echo.

REM Check if mysql command is available
mysql --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: MySQL client not found in PATH
    echo Please install MySQL client or add it to your PATH
    pause
    exit /b 1
)

REM Run the migration
echo Running migration script...
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p %DB_NAME% < migrations\add_payment_due_date.sql

if errorlevel 1 (
    echo.
    echo ❌ Migration failed!
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Migration completed successfully!
    echo ✅ dueDate column added to Payment table
    echo ✅ Performance indexes created
    echo ✅ Existing payments updated with default due dates
)

echo.
echo Migration completed at %date% %time%
pause