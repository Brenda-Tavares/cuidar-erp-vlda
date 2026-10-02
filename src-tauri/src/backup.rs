use rusqlite::{params, Connection};
use sha2::{Sha256, Digest};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{Local, NaiveDateTime};

fn get_db_path() -> PathBuf {
    super::install_data_dir().join("cuidar.db")
}

const PASTA_GERAL: &str = "Geral";

const BACKUP_PARTS: &[(&str, &[&str])] = &[
    ("alunos", &["alunos", "responsaveis", "crianca_responsaveis", "matriculas"]),
    ("turmas", &["turmas"]),
    ("frequencias", &["frequencias", "frequencia_registros", "frequencia_funcionarios"]),
    ("ocorrencias", &["ocorrencias"]),
    ("funcionarios", &["funcionarios", "cargos", "escala_trabalho", "funcionario_turmas", "pagamentos_salarios"]),
    ("financeiro", &["mensalidades", "servicos", "aluno_servicos", "company_expenses", "company_revenues", "gastos_fixos"]),
    ("configuracoes", &["configuracoes", "creche", "users", "backup_settings", "audit_log", "user_sessions", "two_factor_auth", "login_attempts"]),
];

fn pasta_da_parte(part: &str) -> &str {
    match part {
        "alunos" => "Alunos",
        "turmas" => "Turmas",
        "frequencias" => "Frequencias",
        "ocorrencias" => "Ocorrencias",
        "funcionarios" => "Funcionarios",
        "financeiro" => "Financeiro",
        "configuracoes" => "Configuracoes",
        outra => outra,
    }
}

fn remover_legado_vazio(base: &Path, identificador: &str, novo_nome: &str) {
    if identificador == novo_nome {
        return;
    }
    let legado = base.join(identificador);
    if legado == base.join(novo_nome) {
        return;
    }
    if let Ok(mut entradas) = fs::read_dir(&legado) {
        if entradas.next().is_none() {
            let _ = fs::remove_dir(&legado);
        }
    }
}

pub fn get_backup_dir_for_part(part: Option<&str>) -> PathBuf {
    match part {
        None | Some("geral") => {
            let dir = super::backup_base_dir()
                .join(PASTA_GERAL)
                .join(Local::now().format("%Y-%m").to_string());
            fs::create_dir_all(&dir).ok();
            dir
        }
        Some(parte) => {
            let nome = pasta_da_parte(parte).to_string();
            let base = super::backup_base_dir();
            remover_legado_vazio(&base, parte, &nome);
            let dir = base.join(&nome);
            fs::create_dir_all(&dir).ok();
            dir
        }
    }
}

fn timestamp_now() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn filename_timestamp() -> String {
    Local::now().format("%Y-%m-%d_%H-%M-%S").to_string()
}

fn compute_checksum(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| format!("Erro ao ler arquivo: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_backup_checksum(backup_path: &Path, expected_checksum: &str) -> Result<bool, String> {
    if !backup_path.exists() {
        return Ok(false);
    }
    let actual = compute_checksum(backup_path)?;
    Ok(actual == expected_checksum)
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub id: i64,
    pub filename: String,
    pub file_path: String,
    pub file_size: i64,
    pub checksum: String,
    pub backup_type: String,
    pub created_at: String,
    pub created_by: Option<i64>,
    pub is_valid: bool,
    pub notes: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct BackupSettings {
    pub id: i64,
    pub auto_backup_enabled: bool,
    pub backup_interval_hours: i32,
    pub retention_days: i32,
    pub backup_path: Option<String>,
    pub last_backup_at: Option<String>,
    pub next_backup_at: Option<String>,
}

pub fn create_backup(conn: &Connection, backup_type: &str, created_by: Option<i64>) -> Result<BackupInfo, String> {
    let backup_dir = get_backup_dir_for_part(None);
    let filename = format!("backup_{}.db", filename_timestamp());
    create_backup_at(conn, &backup_dir.join(&filename), backup_type, created_by)
}

pub fn create_backup_at(conn: &Connection, dest_path: &Path, backup_type: &str, created_by: Option<i64>) -> Result<BackupInfo, String> {
    let db_path = get_db_path();
    if let Some(pai) = dest_path.parent() {
        fs::create_dir_all(pai).ok();
    }
    fs::copy(&db_path, dest_path).map_err(|e| format!("Erro ao copiar banco: {}", e))?;
    registrar_backup(
        conn,
        &dest_path.file_name().unwrap_or_default().to_string_lossy(),
        dest_path,
        backup_type,
        created_by,
        None,
    )
}

fn registrar_backup(
    conn: &Connection,
    filename: &str,
    dest_path: &Path,
    backup_type: &str,
    created_by: Option<i64>,
    notes: Option<&str>,
) -> Result<BackupInfo, String> {
    let file_size = fs::metadata(dest_path).map_err(|e| e.to_string())?.len() as i64;
    let checksum = compute_checksum(dest_path)?;

    conn.execute(
        "INSERT INTO database_backups (filename, file_path, file_size, checksum, backup_type, created_by, is_valid, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)",
        params![filename, dest_path.to_string_lossy().to_string(), file_size, checksum, backup_type, created_by, notes],
    ).map_err(|e| format!("Erro ao registrar backup: {}", e))?;

    let id = conn.last_insert_rowid();

    let now = timestamp_now();
    conn.execute(
        "UPDATE backup_settings SET last_backup_at = ?1 WHERE id = 1",
        params![now],
    ).ok();

    log::info!(target: "backup", "[BACKUP] Backup criado: {} ({})", filename, backup_type);

    Ok(BackupInfo {
        id,
        filename: filename.to_string(),
        file_path: dest_path.to_string_lossy().to_string(),
        file_size,
        checksum,
        backup_type: backup_type.to_string(),
        created_at: now,
        created_by,
        is_valid: true,
        notes: notes.map(|s| s.to_string()),
    })
}

pub fn create_part_backup(conn: &Connection, part: &str, created_by: Option<i64>) -> Result<BackupInfo, String> {
    validar_parte(part)?;
    let backup_dir = get_backup_dir_for_part(Some(part));
    let filename = format!("backup_{}_{}.db", part, filename_timestamp());
    create_part_backup_at(conn, part, &backup_dir.join(&filename), created_by)
}

fn validar_parte(part: &str) -> Result<(), String> {
    if BACKUP_PARTS.iter().any(|(name, _)| *name == part) {
        Ok(())
    } else {
        Err(format!("Parte de backup desconhecida: {}", part))
    }
}

pub fn create_part_backup_at(conn: &Connection, part: &str, dest_path: &Path, created_by: Option<i64>) -> Result<BackupInfo, String> {
    let tables = BACKUP_PARTS
        .iter()
        .find(|(name, _)| *name == part)
        .ok_or_else(|| format!("Parte de backup desconhecida: {}", part))?
        .1;

    let db_path = get_db_path();
    if let Some(pai) = dest_path.parent() {
        fs::create_dir_all(pai).ok();
    }

    let dest_conn = Connection::open(dest_path)
        .map_err(|e| format!("Erro ao criar arquivo da parte: {}", e))?;

    let escaped = db_path.display().to_string().replace('\'', "''");
    dest_conn
        .execute_batch(&format!("ATTACH DATABASE '{}' AS src;", escaped))
        .map_err(|e| format!("Erro ao anexar banco de origem: {}", e))?;

    for table in tables {
        dest_conn
            .execute_batch(&format!(
                "CREATE TABLE \"{}\" AS SELECT * FROM src.\"{}\";",
                table, table
            ))
            .map_err(|e| format!("Erro ao copiar tabela {}: {}", table, e))?;
    }

    dest_conn.execute_batch("DETACH DATABASE src;").ok();
    drop(dest_conn);

    registrar_backup(
        conn,
        &dest_path.file_name().unwrap_or_default().to_string_lossy(),
        dest_path,
        "manual",
        created_by,
        Some(&format!("parte: {}", part)),
    )
}

pub fn criar_backup_personalizado(conn: &Connection, caminho: &str, parte: Option<&str>, created_by: Option<i64>) -> Result<BackupInfo, String> {
    let dest_path = Path::new(caminho);
    match parte.filter(|p| !p.is_empty() && *p != "geral") {
        Some(part) => create_part_backup_at(conn, part, dest_path, created_by),
        None => create_backup_at(conn, dest_path, "manual", created_by),
    }
}

pub fn create_all_part_backups(conn: &Connection, created_by: Option<i64>) -> Result<Vec<BackupInfo>, String> {
    let mut out = Vec::new();
    for (name, _) in BACKUP_PARTS {
        out.push(create_part_backup(conn, name, created_by)?);
    }
    Ok(out)
}

pub fn importar_backup(conn: &Connection, caminho: &str, created_by: Option<i64>) -> Result<BackupInfo, String> {
    let origem = Path::new(caminho);
    if !origem.exists() {
        return Err("Arquivo não encontrado".to_string());
    }
    if origem.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) != Some("db".to_string()) {
        return Err("O arquivo deve ter extensão .db".to_string());
    }

    let valido = Connection::open_with_flags(origem, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).is_ok();
    if !valido {
        return Err("O arquivo não é um banco de dados válido".to_string());
    }

    let backup_dir = get_backup_dir_for_part(None);
    let filename = format!("importado_{}.db", filename_timestamp());
    let dest_path = backup_dir.join(&filename);

    fs::copy(origem, &dest_path).map_err(|e| format!("Erro ao copiar arquivo: {}", e))?;

    let origem_str = origem.display().to_string();
    registrar_backup(conn, &filename, &dest_path, "importado", created_by, Some(&origem_str))
}

fn is_general_backup(backup_path: &Path) -> Result<bool, String> {
    let src = Connection::open_with_flags(backup_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Erro ao abrir backup: {}", e))?;
    let exists: bool = src
        .query_row(
            "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Erro ao inspecionar backup: {}", e))?;
    Ok(exists)
}

fn backup_tables(backup_path: &Path) -> Result<Vec<String>, String> {
    let src = Connection::open_with_flags(backup_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Erro ao abrir backup: {}", e))?;
    let mut stmt = src
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name",
        )
        .map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(names)
}

fn backup_columns(conn: &Connection, table: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA bkp.table_info(\"{}\")", table))
        .map_err(|e| e.to_string())?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(cols)
}

pub fn restore_backup(conn: &Connection, backup_id: i64, user_id: i64, mode: &str) -> Result<String, String> {
    let merge_mode = mode == "merge";

    let (filename, file_path_str, checksum): (String, String, String) = conn.query_row(
        "SELECT filename, file_path, checksum FROM database_backups WHERE id = ?1",
        params![backup_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).map_err(|_| format!("Backup #{} não encontrado", backup_id))?;

    let backup_path = Path::new(&file_path_str);

    if !backup_path.exists() {
        return Err(format!("Arquivo de backup não encontrado: {}", file_path_str));
    }

    if !verify_backup_checksum(backup_path, &checksum)? {
        return Err("Checksum do backup não confere — arquivo corrompido".to_string());
    }

    let db_path = get_db_path();

    let pre_restore_path = db_path.with_extension(format!("pre_restore_{}.db", filename_timestamp()));
    fs::copy(&db_path, &pre_restore_path)
        .map_err(|e| format!("Erro ao criar backup de segurança pré-restore: {}", e))?;

    let is_general = is_general_backup(backup_path)?;

    if is_general && !merge_mode {
        fs::copy(backup_path, &db_path)
            .map_err(|e| format!("Erro ao restaurar backup: {}", e))?;

        conn.execute(
            "UPDATE backup_settings SET last_backup_at = CURRENT_TIMESTAMP WHERE id = 1",
            [],
        ).ok();

        log::warn!(target: "backup", "[BACKUP] Banco restaurado (substituição) do backup #{} ({}) por user_id={}", backup_id, filename, user_id);
        return Ok(format!(
            "Backup '{}' restaurado (substituição completa). Backup de segurança salvo como '{}'",
            filename,
            pre_restore_path.file_name().unwrap_or_default().to_string_lossy()
        ));
    }

    let tables = backup_tables(backup_path)?;
    if tables.is_empty() {
        return Err("O backup não contém tabelas para restaurar".to_string());
    }

    let escaped = backup_path.display().to_string().replace('\'', "''");
    conn.execute_batch(&format!("ATTACH DATABASE '{}' AS bkp;", escaped))
        .map_err(|e| format!("Erro ao anexar arquivo de backup: {}", e))?;

    let mut restored = 0usize;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Erro ao iniciar transação: {}", e))?;

    for table in &tables {
        let cols = backup_columns(conn, table)?;
        if cols.is_empty() {
            continue;
        }
        let col_list = cols.join(", ");

        if merge_mode {
            conn.execute(
                &format!(
                    "INSERT INTO \"{}\" ({}) SELECT {} FROM bkp.\"{}\" WHERE NOT EXISTS (SELECT 1 FROM \"{}\" WHERE \"{}\".id = bkp.\"{}\".id)",
                    table, col_list, col_list, table, table, table, table
                ),
                [],
            ).map_err(|e| format!("Erro ao acrescentar dados da tabela {}: {}", table, e))?;
        } else {
            conn.execute(&format!("DELETE FROM \"{}\"", table), [])
                .map_err(|e| format!("Erro ao limpar tabela {}: {}", table, e))?;
            conn.execute(
                &format!("INSERT INTO \"{}\" ({}) SELECT {} FROM bkp.\"{}\"", table, col_list, col_list, table),
                [],
            ).map_err(|e| format!("Erro ao inserir dados da tabela {}: {}", table, e))?;
        }
        restored += 1;
    }

    tx.commit().map_err(|e| format!("Erro ao finalizar restauração: {}", e))?;
    conn.execute_batch("DETACH DATABASE bkp;").ok();

    conn.execute(
        "UPDATE backup_settings SET last_backup_at = CURRENT_TIMESTAMP WHERE id = 1",
        [],
    ).ok();

    let modo = if merge_mode { "acréscimo (só o que faltava)" } else { "substituição" };
    log::warn!(target: "backup", "[BACKUP] Banco restaurado ({}) do backup #{} ({}) por user_id={} — {} tabelas", modo, backup_id, filename, user_id, restored);

    Ok(format!(
        "Backup '{}' restaurado em modo {} — {} tabela(s) atualizadas. Backup de segurança salvo como '{}'",
        filename,
        modo,
        restored,
        pre_restore_path.file_name().unwrap_or_default().to_string_lossy()
    ))
}

pub fn cleanup_old_backups(conn: &Connection) -> Result<i32, String> {
    let retention_days: i32 = conn.query_row(
        "SELECT retention_days FROM backup_settings WHERE id = 1",
        [],
        |row| row.get(0),
    ).unwrap_or(30);

    let cutoff = (Local::now() - chrono::Duration::days(retention_days as i64))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    let mut stmt = conn.prepare(
        "SELECT id, file_path FROM database_backups WHERE created_at < ?1"
    ).map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String)> = stmt.query_map(params![cutoff], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let count = rows.len() as i32;

    for (id, file_path) in &rows {
        let path = Path::new(file_path);
        if path.exists() {
            fs::remove_file(path).ok();
        }
        conn.execute("DELETE FROM database_backups WHERE id = ?1", params![id])
            .ok();
    }

    if count > 0 {
        log::info!(target: "backup", "[BACKUP] Cleanup: {} backups antigos removidos (retenção: {} dias)", count, retention_days);
    }

    Ok(count)
}

pub fn validate_backup(conn: &Connection, backup_id: i64) -> Result<bool, String> {
    let (file_path, checksum): (String, String) = conn.query_row(
        "SELECT file_path, checksum FROM database_backups WHERE id = ?1",
        params![backup_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|_| format!("Backup #{} não encontrado", backup_id))?;

    let path = Path::new(&file_path);
    if !path.exists() {
        conn.execute(
            "UPDATE database_backups SET is_valid = 0 WHERE id = ?1",
            params![backup_id],
        ).ok();
        return Ok(false);
    }

    let valid = verify_backup_checksum(path, &checksum)?;

    conn.execute(
        "UPDATE database_backups SET is_valid = ?1 WHERE id = ?2",
        params![valid as i32, backup_id],
    ).map_err(|e| e.to_string())?;

    Ok(valid)
}

pub fn execute_auto_backup(conn: &Connection) -> Result<Option<BackupInfo>, String> {
    let settings: (bool, i32, Option<String>) = conn.query_row(
        "SELECT auto_backup_enabled, backup_interval_hours, next_backup_at FROM backup_settings WHERE id = 1",
        [],
        |row| Ok((
            row.get::<_, bool>(0)?,
            row.get::<_, i32>(1)?,
            row.get::<_, Option<String>>(2)?,
        )),
    ).map_err(|e| format!("Erro ao ler configurações: {}", e))?;

    let (auto_enabled, interval_hours, next_backup_str) = settings;

    if !auto_enabled {
        return Ok(None);
    }

    if let Some(next_str) = &next_backup_str {
        if let Ok(next_time) = NaiveDateTime::parse_from_str(next_str, "%Y-%m-%d %H:%M:%S") {
            let now = Local::now().naive_local();
            if now < next_time {
                return Ok(None);
            }
        }
    }

    let now = Local::now();
    let next_backup = (now + chrono::Duration::hours(interval_hours as i64))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    conn.execute(
        "UPDATE backup_settings SET next_backup_at = ?1 WHERE id = 1",
        params![next_backup],
    ).ok();

    let result = create_backup(conn, "auto", None)?;

    cleanup_old_backups(conn).ok();

    Ok(Some(result))
}
