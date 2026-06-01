@echo off
title SOLID SUPER GATE ESCAPER 開発起動
chcp 65001 > nul
cd /d "%~dp0"

echo ===================================================
echo   SOLID SUPER GATE ESCAPER - 開発サーバー起動
echo ===================================================
echo.
echo ローカル開発環境を起動しています...
echo.

cmd /c npm run dev

pause
