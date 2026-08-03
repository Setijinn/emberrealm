@echo off
REM ===================================================================================================
REM  Open the Sprite Lab. Double-click this file.
REM
REM  WHY IT EXISTS RATHER THAN "just run the python". Two reasons, and both of them have already
REM  cost time on this machine:
REM    1. `py` here is the Microsoft Store alias stub, and the launcher follows a script's env-python
REM       shebang straight into it -- so `py tools/spritelab.py` fails in a way that reads as a broken
REM       SCRIPT rather than a broken launcher. This tries real interpreters and checks each one can
REM       actually import what the tool needs before using it.
REM    2. The lab needs a server. spritelab.py starts one itself now, so there is nothing else to run.
REM
REM  Drag a shortcut to your desktop or taskbar and the whole thing is one click.
REM
REM    spritelab.cmd              open it here
REM    spritelab.cmd --mobile     ...and print the address to type into a phone
REM ===================================================================================================
setlocal
cd /d "%~dp0"

set "PYEXE="
for %%P in (
  "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
  "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
  "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
  "C:\Python312\python.exe"
  "python.exe"
) do (
  if not defined PYEXE (
    REM Not just "does it exist" -- the Store stub exists and runs. Ask it to import the two things
    REM the lab cannot work without; the stub cannot, and neither can a bare python with no Pillow.
    %%P -c "import PIL, numpy" >nul 2>&1 && set "PYEXE=%%~P"
  )
)

if not defined PYEXE (
  echo.
  echo   Could not find a Python with Pillow and numpy installed.
  echo.
  echo   Install them with:
  echo       "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -m pip install pillow numpy
  echo.
  echo   or edit the list at the top of this file if your Python lives somewhere else.
  echo.
  pause
  exit /b 1
)

"%PYEXE%" tools\spritelab.py %*
if errorlevel 1 pause
