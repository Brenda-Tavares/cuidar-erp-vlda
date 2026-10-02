@echo off
title Cuidar ERP - Reset
echo ============================================
echo  Cuidar ERP - Ferramenta de Reset
echo ============================================
echo.
echo Este script vai fechar o Cuidar ERP e limpar
echo arquivos temporarios e de configuração.
echo.
set /p CONFIRM="Tem certeza que deseja continuar? (S/N): "
if /i not "%CONFIRM%"=="S" goto :cancel

echo.
echo Fechando o Cuidar ERP...
taskkill /f /im "cuidar-erp.exe" 2>nul
timeout /t 2 /nobreak >nul

echo Removendo arquivos de log...
del /f /q "%~dp0*.log" 2>nul

echo Removendo bancos de dados locais...
del /f /q "%~dp0*.db" 2>nul
del /f /q "%~dp0*.db-wal" 2>nul
del /f /q "%~dp0*.db-shm" 2>nul

echo.
echo ============================================
echo  Reset concluído com sucesso!
echo  Execute o Cuidar ERP novamente para
echo  recriar os arquivos necessários.
echo ============================================
pause
exit /b 0

:cancel
echo.
echo Operação cancelada.
pause
exit /b 1
