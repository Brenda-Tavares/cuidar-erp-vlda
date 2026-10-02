use base64::Engine;
use chrono::NaiveDate;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use std::env;
use std::io::{self, Write};
use std::path::PathBuf;
use std::process::Command;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

static PUBLIC_KEY_BYTES: &[u8] = include_bytes!("../dev_public_key.bin");

const MSI_DATA: &[u8] = include_bytes!("../../dist/cuidarerp-latest.msi");
const APP_NAME: &str = "Cuidar ERP - Vila do Aprender";
const REGISTRY_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\CuidarERPVDA";
const INSTALADOR_DIR: &str = r"C:\ProgramData\Cuidar-ERP-VDA\Instalador";

fn validar_chave(chave: &str) -> Result<(), String> {
    let parts: Vec<&str> = chave.split(':').collect();
    if parts.len() < 3 {
        return Err("Formato invalido. Use: validade:nome:assinatura".into());
    }

    let validade_str = parts[0];
    let nome = parts[1];
    let assinatura_b64 = parts[2];

    let validade =
        NaiveDate::parse_from_str(validade_str, "%Y-%m-%d").map_err(|_| "Data de validade invalida".to_string())?;

    let dados = format!("validade={}|nome={}", validade.format("%Y-%m-%d"), nome);

    let pub_key_array: [u8; 32] = PUBLIC_KEY_BYTES
        .try_into()
        .map_err(|_| "Chave publica invalida (tamanho incorreto)".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&pub_key_array)
        .map_err(|e| format!("Erro ao carregar chave publica: {}", e))?;

    let assinatura_bytes = base64::engine::general_purpose::URL_SAFE
        .decode(assinatura_b64)
        .map_err(|_| "Assinatura em Base64 invalida".to_string())?;

    let sig = Signature::from_slice(&assinatura_bytes)
        .map_err(|e| format!("Erro ao interpretar assinatura: {}", e))?;

    verifying_key
        .verify(dados.as_bytes(), &sig)
        .map_err(|_| "Assinatura invalida".to_string())?;

    let hoje = chrono::Local::now().naive_local().date();
    if validade < hoje {
        return Err(format!("Licenca expirada em {}", validade.format("%d/%m/%Y")));
    }

    Ok(())
}

fn preparar_msi_estavel() -> PathBuf {
    let msi_dir = PathBuf::from(INSTALADOR_DIR);
    let msi_path = msi_dir.join("cuidarerp-latest.msi");
    if std::fs::create_dir_all(&msi_dir).is_ok() {
        let _ = std::fs::write(&msi_path, MSI_DATA);
        if msi_path.exists() {
            return msi_path;
        }
    }
    let temp_dir = env::temp_dir();
    let temp_msi = temp_dir.join("cuidarerp-vda-install.msi");
    std::fs::write(&temp_msi, MSI_DATA).expect("Erro ao extrair MSI temporario");
    temp_msi
}

fn registrar_programa() -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let (key, _) = hklm
        .create_subkey(REGISTRY_KEY)
        .map_err(|e| format!("Erro ao criar chave de registro: {}", e))?;

    let uninstall_str = format!(r"{}\desinstalador.exe", INSTALADOR_DIR);

    key.set_value("DisplayName", &APP_NAME)
        .map_err(|e| format!("Erro ao gravar DisplayName no registro: {}", e))?;
    key.set_value("UninstallString", &uninstall_str)
        .map_err(|e| format!("Erro ao gravar UninstallString no registro: {}", e))?;
    key.set_value("InstallLocation", &INSTALADOR_DIR)
        .map_err(|e| format!("Erro ao gravar InstallLocation no registro: {}", e))?;
    key.set_value("Publisher", &"ShipClaw")
        .map_err(|e| format!("Erro ao gravar Publisher no registro: {}", e))?;
    key.set_value("NoModify", &1u32)
        .map_err(|e| format!("Erro ao gravar NoModify no registro: {}", e))?;
    key.set_value("NoRepair", &1u32)
        .map_err(|e| format!("Erro ao gravar NoRepair no registro: {}", e))?;

    println!("  Instalador registrado no Windows.");
    Ok(())
}

fn main() {
    println!("========================================");
    println!("  {}", APP_NAME);
    println!("========================================");
    println!();

    print!("Digite a chave de licenca: ");
    io::stdout().flush().ok();

    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .expect("Erro ao ler entrada");

    let chave = input.trim();
    if chave.is_empty() {
        eprintln!("Chave nao informada. Instalacao cancelada.");
        esperar_e_sair(1);
    }

    if let Err(e) = validar_chave(chave) {
        eprintln!("Chave invalida. Instalacao cancelada.");
        eprintln!("  Motivo: {}", e);
        esperar_e_sair(1);
    }

    println!("Chave valida! Iniciando instalacao...");
    println!();

    if let Err(e) = registrar_programa() {
        eprintln!("Aviso: erro ao registrar instalador: {}", e);
    }

    println!();
    println!("Na proxima janela voce pode escolher a pasta de instalacao.");
    println!("  - E permitido instalar em outro HD/SSD (ex.: D:, E:).");
    println!("  - O banco de dados fica em ProgramData\\Cuidar-ERP-VDA\\Data");
    println!("    e os arquivos gerados (backups e relatorios) em Documentos\\Cuidar-ERP.");
    println!();
    println!("OBSERVACAO: se voce digitar uma pasta de instalacao diferente da padrao,");
    println!("voce pode indica-la na janela de instalacao do Windows (botao \"Alterar\").");
    println!();

    let msi_path = preparar_msi_estavel();
    let msi_str = msi_path.to_string_lossy().to_string();

    let log_path = r"C:\CuidarErp-Install.log";
    println!();
    println!("Um log detalhado da instalacao sera salvo em: {}", log_path);
    println!("Se algo der errado, envie esse arquivo para o suporte.");
    println!();

    let status = Command::new("msiexec")
        .args(["/i", &msi_str, "/l*v", log_path])
        .status()
        .expect("Erro ao executar msiexec");

    if !status.success() {
        eprintln!(
            "Instalacao pode nao ter sido concluida com sucesso (codigo: {:?})",
            status.code()
        );
        esperar_e_sair(1);
    }

    println!();
    println!("Instalacao concluida!");
    println!();
    println!("Pressione Enter para sair...");
    io::stdin().read_line(&mut String::new()).ok();
}

fn esperar_e_sair(code: i32) -> ! {
    println!();
    println!("Pressione Enter para sair...");
    io::stdin().read_line(&mut String::new()).ok();
    std::process::exit(code);
}
