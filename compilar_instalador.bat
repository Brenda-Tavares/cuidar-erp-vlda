@echo off
cd /d "C:\projetos\cuidar-erp-vila-do-aprender\instalador"

echo === Compilando instalador.exe (embutindo MSI atualizado) ===
cargo build --release 2>&1
if errorlevel 1 (
    echo ERRO na compilacao!
    exit /b 1
)

echo.
echo === Copiando instalador.exe para dist ===
copy /y "target\release\instalador.exe" "..\dist\instalador.exe"
if errorlevel 1 (
    echo ERRO ao copiar instalador.exe!
    exit /b 1
)

echo.
echo === Conteudo final do dist ===
dir "..\dist"

echo.
echo OK - instalador.exe criado e atualizado
