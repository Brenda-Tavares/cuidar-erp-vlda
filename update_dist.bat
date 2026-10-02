@echo off
cd C:\projetos\cuidar-erp-vila-do-aprender

:: Copiar o MSI atualizado usando nome curto
copy src-tauri\target\release\bundle\msi\CU54AC~1.MSI dist\cuidarerp-latest.msi /y

:: Tentar copiar o instalador.exe
if exist src-tauri\target\release\bundle\installer\instalador.exe (
    copy src-tauri\target\release\bundle\installer\instalador.exe dist\instalador.exe /y
) else (
    echo "Instalador na pasta bundle diferente, verificando..."
)

echo Atualização do dist concluída
pause