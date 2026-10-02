@echo off
cd /d "C:\projetos\cuidar-erp-vila-do-aprender"

echo === Atualizando MSI no dist ===
copy /y "src-tauri\target\release\bundle\msi\Cuidar ERP - Vila do Aprender_1.0.8_x64_pt-BR.msi" "dist\cuidarerp-latest.msi"
if errorlevel 1 (
    echo ERRO ao copiar MSI!
    exit /b 1
)

del /q "dist\~new.msi" 2>nul
del /q "dist\temp.msi" 2>nul
del /q "dist\rem.txt" 2>nul

echo.
echo === Conteudo do dist apos atualizacao ===
dir "dist"

echo.
echo OK - MSI atualizado
