@echo off
chcp 65001 >nul
title 기출문제 검색기 - 복사데이터 갱신
echo.
echo  바꾼 이미지를 찾아 복사용 데이터를 다시 만듭니다...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh_b64.ps1"
echo.
pause
