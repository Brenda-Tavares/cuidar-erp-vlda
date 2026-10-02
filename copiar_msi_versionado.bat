@echo off
cd /d "C:\projetos\cuidar-erp-vila-do-aprender"
copy /y "src-tauri\target\release\bundle\msi\Cuidar ERP - Vila do Aprender_1.0.8_x64_pt-BR.msi" "dist\Cuidar ERP - Vila do Aprender_1.0.8_x64_pt-BR.msi"
dir "dist"
