#!/bin/bash

echo "=== Reset Completo do Cuidar ERP ==="

pkill -f "cuidar-erp" 2>/dev/null

echo "Removendo banco de dados..."
rm -f database.db
rm -f src-tauri/database.db

echo "Removendo licença..."
rm -f ~/.config/cuidar-erp/license.dat
rm -rf ~/.config/cuidar-erp/

echo "Removendo logs..."
rm -rf ~/.local/share/cuidar-erp/logs/

echo "Removendo backups..."
rm -rf ~/.local/share/cuidar-erp/backups/

echo "Reset completo!"
echo "Execute 'cargo tauri dev' para iniciar do zero"
