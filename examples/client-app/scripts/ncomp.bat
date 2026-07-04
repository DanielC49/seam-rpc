@echo off
setlocal

if "%~1"=="" (
    echo Use: npm run ncomp -- ComponentName [subpath]
    echo Example: npm run ncomp -- Button forms/buttons
    exit /b 1
)

set "COMP_NAME=%~1"
set "SUB_DIR=%~2"
set "BASE_DIR=src\components"

if not "%SUB_DIR%"=="" (
    set "SUB_DIR=%SUB_DIR:/=\%"
)
 
if not "%SUB_DIR%"=="" (
    set "TARGET_DIR=%BASE_DIR%\%SUB_DIR%"
) else (
    set "TARGET_DIR=%BASE_DIR%"
)

set "TARGET_DIR=%TARGET_DIR%\%COMP_NAME%"

if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

set "TSX_FILE=%TARGET_DIR%\%COMP_NAME%.tsx"
set "CSS_FILE=%TARGET_DIR%\%COMP_NAME%.css"

if exist "%TSX_FILE%" (
    echo Error: Component "%COMP_NAME%" already exists in %TARGET_DIR%!
    exit /b 1
)
 
type nul > "%CSS_FILE%"
 
(
    type nul > "%CSS_FILE%"
 
    powershell -Command "(Get-Content 'scripts\comp-template.tsx.template') -replace '{COMP_NAME}', '%COMP_NAME%' | Set-Content '%TSX_FILE%'"
)
echo Success: Component "%COMP_NAME%" created in "%TARGET_DIR%"!

endlocal