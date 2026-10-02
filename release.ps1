# ============================================================
#  release.ps1 — Pipeline de release do Cuidar ERP
#  Uso:  .\release.ps1             (usa a versão do tauri.conf.json)
#        .\release.ps1 -Version 1.0.2
#  Resultado: dist\ contendo MSI versionado, cuidarerp-latest.msi
#             e instalador.exe (com o MSI embutido)
# ============================================================
param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$arquivoAntigos = Join-Path $dist "antigos"
$msiDir = Join-Path $root "src-tauri\target\release\bundle\msi"

function Fail([string]$msg) {
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}
function Info([string]$msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

# ---------- 1. Versao ----------
if (-not $Version) {
  $conf = Get-Content (Join-Path $root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
  $Version = [string]$conf.version
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fail "Versao invalida: '$Version'" }
Info "Release da versao $Version"

# ---------- 2. Consistencia de versao nos 4 arquivos ----------
$files = @(
  "src-tauri\tauri.conf.json",
  "package.json",
  "package-lock.json",
  "src-tauri\Cargo.toml",
  "instalador\Cargo.toml"
)
foreach ($rel in $files) {
  $content = Get-Content (Join-Path $root $rel) -Raw
  if ($content -notmatch [regex]::Escape($Version)) {
    Fail "Versao $Version nao encontrada em $rel"
  }
}
Info "Versao consistente nos 5 arquivos"

# ---------- 3. Frontend (checagem rapida antes do build completo) ----------
Push-Location $root
try {
  cmd /c "npm run build 2>&1"
  if ($LASTEXITCODE -ne 0) { Fail "npm run build falhou (codigo $LASTEXITCODE)" }
  Info "Frontend buildado com sucesso"
} finally { Pop-Location }

# ---------- 4. Tauri build (gera exe + MSI; roda npm run build antes) ----------
Push-Location $root
try {
  cmd /c "npx tauri build 2>&1"
  if ($LASTEXITCODE -ne 0) { Fail "npx tauri build falhou (codigo $LASTEXITCODE)" }
} finally { Pop-Location }
Info "Tauri build concluido"

# ---------- 5. Localizar MSI da versao ----------
$msi = Get-ChildItem -LiteralPath $msiDir -Filter "*.msi" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match [regex]::Escape($Version) } | Select-Object -First 1
if (-not $msi) { Fail "MSI da versao $Version nao encontrado em $msiDir" }
Info "MSI encontrado: $($msi.Name) ($($msi.Length) B)"

# ---------- 6. Arquivar entregaveis antigos do dist ----------
if (Test-Path $dist) {
  $antigos = Get-ChildItem -LiteralPath $dist -File -ErrorAction SilentlyContinue
  if ($antigos) {
    New-Item -ItemType Directory -Path $arquivoAntigos -Force | Out-Null
    foreach ($f in $antigos) {
      $dest = Join-Path $arquivoAntigos ($f.BaseName + "_" + $f.LastWriteTime.ToString("yyyyMMdd_HHmmss") + $f.Extension)
      Move-Item -LiteralPath $f.FullName -Destination $dest -Force
      Info "Arquivado: $($f.Name) -> dist\antigos"
    }
  }
} else {
  New-Item -ItemType Directory -Path $dist -Force | Out-Null
}

# ---------- 7. Copiar MSI para o dist ----------
Copy-Item -LiteralPath $msi.FullName -Destination (Join-Path $dist "cuidarerp-latest.msi") -Force
Copy-Item -LiteralPath $msi.FullName -Destination (Join-Path $dist $msi.Name) -Force
Info "MSI copiado para dist"

# ---------- 8. Build do instalador (embute dist\cuidarerp-latest.msi) ----------
Push-Location (Join-Path $root "instalador")
try {
  cmd /c "cargo build --release 2>&1"
  if ($LASTEXITCODE -ne 0) { Fail "build do instalador falhou (codigo $LASTEXITCODE)" }
} finally { Pop-Location }
Copy-Item -LiteralPath (Join-Path $root "instalador\target\release\instalador.exe") -Destination (Join-Path $dist "instalador.exe") -Force
Info "instalador.exe gerado"

# ---------- 9. Validacoes finais ----------
$msiBytes = (Get-Item -LiteralPath (Join-Path $dist "cuidarerp-latest.msi")).Length
$instBytes = (Get-Item -LiteralPath (Join-Path $dist "instalador.exe")).Length
if ($instBytes -le $msiBytes) {
  Fail "instalador.exe ($instBytes B) menor ou igual ao MSI ($msiBytes B) — embed falhou?"
}
$exeVer = (Get-Item -LiteralPath (Join-Path $root "src-tauri\target\release\cuidar-erp.exe")).VersionInfo.FileVersion
if ($exeVer -ne $Version) {
  Fail "cuidar-erp.exe reporta versao $exeVer (esperado $Version)"
}
Info "Validacoes OK (instalador $instBytes B > MSI $msiBytes B; exe $exeVer)"

Write-Host ""
Write-Host "========== RELEASE $Version CONCLUIDA ==========" -ForegroundColor Green
Get-ChildItem -LiteralPath $dist | ForEach-Object { "  {0} ({1} B)" -f $_.Name, $_.Length }
Write-Host "Distribua o arquivo: dist\instalador.exe" -ForegroundColor Yellow