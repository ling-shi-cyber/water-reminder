@echo off
chcp 65001 >nul
echo 启动每日抬水提醒...

echo 启动应用...
npm run dev

if %errorlevel% neq 0 (
    echo 启动失败，请检查错误信息
    pause
)