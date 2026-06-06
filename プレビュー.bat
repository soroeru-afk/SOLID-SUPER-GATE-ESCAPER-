@echo off
title SOLID SUPER GATE ESCAPER プレビュー
chcp 65001 > nul
cd /d "%~dp0"

echo ===================================================
echo   SOLID SUPER GATE ESCAPER - ビルドプレビュー起動
echo ===================================================
echo.
echo ビルドされたアセットをプレビュー起動しています...
echo.

cmd /c npm run preview

pause
