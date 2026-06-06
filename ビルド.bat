@echo off
title SOLID SUPER GATE ESCAPER ビルド
chcp 65001 > nul
cd /d "%~dp0"

echo ===================================================
echo   SOLID SUPER GATE ESCAPER - 本番用ビルド実行
echo ===================================================
echo.
echo アプリケーションをビルドしています...
echo.

cmd /c npm run build

pause
