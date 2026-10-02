use std::env;
use std::io::{self, Write};
use std::path::PathBuf;
use std::process::Command;

const APP_NAME: &str = "Cuidar ERP - Vila do Aprender";
const BACKUPS_DIR: &str = r"C:\Users\Public\Documents\Cuidar-ERP";
const SYSTEM_DATA_DIR: &str = r"C:\ProgramData\Cuidar-ERP-VDA";

fn preparar_msi() -> PathBuf {
    let msi_dir = PathBuf::from(r"C:\ProgramData\Cuidar-ERP-VDA\Instalador");
    let msi_path = msi_dir.join("cuidarerp-latest.msi");
    if msi_path.exists() {
        return msi_path;
    }
    let temp_dir = env::temp_dir();
    let temp_msi = temp_dir.join("cuidarerp-vda-uninstall.msi");
    let source = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("cuidarerp-latest.msi")))
        .unwrap_or(temp_msi.clone());
    if source.exists() {
        std::fs::copy(&source, &temp_msi).ok();
    }
    temp_msi
}

fn remover_pasta_caso_exista(caminho: &str) {
    let path = PathBuf::from(caminho);
    if path.exists() {
        match std::fs::remove_dir_all(&path) {
            Ok(_) => println!("  Removido: {}", caminho),
            Err(e) => eprintln!("  Erro ao remover {}: {}", caminho, e),
        }
    } else {
        println!("  Pasta ja nao existe: {}", caminho);
    }
}

fn mostrar_menu(remove_program: bool, remove_backups: bool, remove_system: bool) {
    println!();
    println!("========================================");
    println!("  {} - Desinstalacao", APP_NAME);
    println!("========================================");
    println!();
    println!("Escolha o que deseja fazer:");
    println!();
    println!("  [x] 1 - Desinstalar o programa (sempre ativo)");
    println!();
    println!("  [{}] 2 - Apagar dados de backup (Documents\\Cuidar-ERP)", if remove_backups { "x" } else { " " });
    println!("  [{}] 3 - Apagar dados do sistema (banco e perfil)", if remove_system { "x" } else { " " });
    println!();
    println!("  Tecle 2 ou 3 para marcar/desmarcar");
    println!("  Tecle Enter para confirmar a desinstalacao");
    println!("  Tecle X + Enter para cancelar");
    println!();
    print!("Opcao: ");
    io::stdout().flush().ok();
}

fn main() {
    let mut remove_backups = false;
    let mut remove_system = false;
    let mut confirmado = false;

    loop {
        mostrar_menu(true, remove_backups, remove_system);
        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_err() {
            break;
        }
        let input = input.trim().to_uppercase();

        if input.is_empty() {
            confirmado = true;
            break;
        }

        match input.as_str() {
            "2" => {
                remove_backups = !remove_backups;
            }
            "3" => {
                remove_system = !remove_system;
            }
            "X" => {
                println!("Desinstalacao cancelada.");
                return;
            }
            _ => {
                println!("Opcao invalida.");
            }
        }
    }

    if !confirmado {
        println!("Desinstalacao cancelada.");
        return;
    }

    println!();
    println!("Iniciando desinstalacao...");

    let msi_path = preparar_msi();
    let msi_str = msi_path.to_string_lossy().to_string();
    let log_path = r"C:\CuidarErp-Uninstall.log";

    println!();
    println!("Executando desinstalacao do MSI...");
    println!("Log: {}", log_path);

    let status = Command::new("msiexec")
        .args(["/x", &msi_str, "/l*v", log_path, "/qn"])
        .status();

    match &status {
        Ok(s) if s.success() => {
            println!();
            println!("MSI desinstalado com sucesso.");
        }
        Ok(s) => {
            eprintln!();
            eprintln!("MSI pode nao ter sido desinstalado completamente (codigo: {:?})", s.code());
        }
        Err(e) => {
            eprintln!();
            eprintln!("Erro ao executar msiexec: {}", e);
        }
    }

    if remove_backups {
        println!();
        println!("Removendo dados de backup...");
        remover_pasta_caso_exista(BACKUPS_DIR);
    }

    if remove_system {
        println!();
        println!("Removendo dados do sistema...");
        remover_pasta_caso_exista(SYSTEM_DATA_DIR);
    }

    println!();
    println!("Desinstalacao concluida!");
    println!();
    println!("Pressione Enter para sair...");
    let _ = io::stdin().read_line(&mut String::new());
}
