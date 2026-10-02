#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod migrations;
mod validation;
mod logger;
mod auth;
mod backup;
mod cache;
mod rpc;
mod servidor_rede;


use chrono::{Datelike, Local};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;
use bcrypt::{verify, hash, DEFAULT_COST};
use base64::Engine;
use validation::*;

fn senha_padrao() -> String {
    if let Ok(senha) = std::env::var("SENHA_PADRAO") {
        if !senha.trim().is_empty() {
            return senha;
        }
    }
    let gerada = SENHA_GERADA.get_or_init(|| {
        let s = uuid::Uuid::new_v4().to_string().replace('-', "");
        log::warn!(target: "auth", "[SECURITY] SENHA_PADRAO nao definida no ambiente. Credencial inicial do admin gerada automaticamente.");
        s
    });
    gerada.clone()
}

static SENHA_HASH_PADRAO: OnceLock<String> = OnceLock::new();
static SENHA_GERADA: OnceLock<String> = OnceLock::new();

fn senha_hash_padrao() -> &'static str {
    SENHA_HASH_PADRAO
        .get_or_init(|| hash(senha_padrao(), DEFAULT_COST).unwrap_or_default())
}

static MIGRACOES_APLICADAS: OnceLock<()> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize)]
struct Aluno {
    id: Option<i64>,
    nome: String,
    data_nascimento: String,
    nome_responsavel: String,
    telefone_responsavel: String,
    telefone_responsavel_2: Option<String>,
    status: String,
    turma_id: Option<i64>,
    numero_matricula: Option<String>,
    dia_vencimento: Option<i64>,
    valor_mensalidade_override: Option<f64>,
}
#[derive(Debug, Serialize, Deserialize)]
struct Turma {
    id: Option<i64>,
    nome: String,
    ano: Option<i64>,
    turno: Option<String>,
    vagas: Option<i64>,
    status: Option<String>,
    responsaveis: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
struct Responsavel { id: Option<i64>, nome: String, telefone: Option<String>, email: Option<String>, cpf: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct CriancaResponsavel { id: Option<i64>, aluno_id: i64, responsavel_id: i64, parentesco: Option<String>, principal: Option<i64> }
#[derive(Debug, Serialize, Deserialize)]
struct Matricula { id: Option<i64>, aluno_id: i64, turma_id: i64, data_matricula: Option<String>, status: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct Mensalidade { id: Option<i64>, aluno_id: i64, vencimento: String, valor: f64, pago: Option<i64>, data_pagamento: Option<String>, forma_pagamento: Option<String>, taxa_matricula: Option<f64> }
#[derive(Debug, Serialize, Deserialize)]
struct Frequencia { id: Option<i64>, aluno_id: i64, data: String, presente: i64, tipo_justificativa: Option<String>, justificativa: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct FrequenciaRegistro { id: Option<i64>, turma_id: i64, data: String, registros: String }
#[derive(Debug, Serialize, Deserialize)]
struct FrequenciaFuncionario { id: Option<i64>, funcionario_id: i64, data: String, status: String, justificativa: Option<String>, tipo_justificativa: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct Ocorrencia { id: Option<i64>, aluno_id: i64, data: String, descricao: String, tipo: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct Cargo { id: Option<i64>, nome: String, descricao: Option<String>, salario_base: Option<f64>, status: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct EscalaTrabalho { id: Option<i64>, nome: String, dias_semana: String, hora_entrada: String, hora_saida: String, descricao: Option<String>, status: Option<String> }
#[derive(Debug, Serialize, Deserialize)]
struct Funcionario { 
    id: Option<i64>, 
    nome_completo: String, 
    nome_social: Option<String>, 
    cpf: Option<String>, 
    telefone: String,
    telefone_secundario: Option<String>,
    email: String, 
    salario: f64, 
    cargo_id: i64, 
    escala_trabalho_id: Option<i64>,
    contato_emergencia: Option<String>,
    telefone_emergencia: Option<String>,
    status: Option<String> 
}
#[derive(Debug, Serialize, Deserialize)]
struct FuncionarioComCargo {
    id: Option<i64>,
    nome_completo: String,
    nome_social: Option<String>,
    cpf: Option<String>,
    telefone: String,
    email: String,
    salario: f64,
    cargo_id: i64,
    cargo_nome: String,
    escala_trabalho_id: Option<i64>,
    escala_nome: Option<String>,
    status: Option<String>
}
#[derive(Debug, Serialize, Deserialize)]
struct FuncionarioTurma { turma_id: i64, turma_nome: String }
#[derive(Debug, Serialize, Deserialize)]
struct User {
    id: i64,
    username: String,
    role: String
}
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct Config { chave: String, valor: String }

#[derive(Debug, Serialize, Deserialize)]
struct Creche {
    id: Option<i32>,
    nome: String,
    cnpj: Option<String>,
    endereco: String,
    numero: Option<String>,
    bairro: Option<String>,
    cidade: String,
    estado: String,
    telefone: Option<String>,
    email: Option<String>,
    senha_admin: Option<String>,
    onboarding_completo: bool,
    valor_padrao_mensalidade: Option<f64>,
    dia_vencimento: Option<i32>,
    taxa_matricula: Option<f64>,
}

#[derive(Debug, Serialize)]
struct CrecheResponse {
    id: Option<i32>,
    nome: String,
    cnpj: Option<String>,
    endereco: String,
    numero: Option<String>,
    bairro: Option<String>,
    cidade: String,
    estado: String,
    telefone: Option<String>,
    email: Option<String>,
    onboarding_completo: bool,
    valor_padrao_mensalidade: Option<f64>,
    dia_vencimento: Option<i32>,
    taxa_matricula: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GastoFixo {
    id: Option<i64>,
    nome: String,
    valor_padrao: f64,
    valor_atual: f64,
    mes: String,
    descricao: Option<String>,
    status: Option<String>,
    editavel: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Servico {
    id: Option<i64>,
    nome: String,
    descricao: Option<String>,
    valor_padrao: f64,
    tipo: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AlunoServico {
    id: Option<i64>,
    aluno_id: i64,
    servico_id: i64,
    servico_nome: Option<String>,
    valor_padrao: Option<f64>,
    valor_acordado: Option<f64>,
    data_inicio: String,
    data_fim: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginacaoRequest {
    pub pagina: i64,
    pub por_pagina: i64,
    pub ordenacao: Option<String>,
    pub direcao: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginacaoResponse<T: Serialize> {
    pub dados: Vec<T>,
    pub total: i64,
    pub pagina: i64,
    pub por_pagina: i64,
    pub total_paginas: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompanyExpense {
    id: Option<i64>,
    categoria: String,
    descricao: Option<String>,
    valor: f64,
    data_despesa: String,
    data_pagamento: Option<String>,
    forma_pagamento: Option<String>,
    funcionario_id: Option<i64>,
    status: Option<String>,
    comprovante_path: Option<String>,
    notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompanyRevenue {
    id: Option<i64>,
    categoria: String,
    descricao: Option<String>,
    valor: f64,
    data_receita: String,
    data_recebimento: Option<String>,
    forma_recebimento: Option<String>,
    status: Option<String>,
    comprovante_path: Option<String>,
    notas: Option<String>,
}

#[derive(Debug, Serialize)]
struct FinancialSummary {
    total_receitas_alunos: f64,
    total_pendente_alunos: f64,
    total_despesas: f64,
    total_gastos_fixos: f64,
    lucro_liquido: f64,
}

#[derive(Debug, Serialize)]
struct SalarioRegistro {
    id: i64,
    funcionario_id: i64,
    funcionario_nome: String,
    mes: String,
    valor: f64,
    pago: i64,
    data_pagamento: Option<String>,
}

#[derive(Debug, Serialize)]
struct FinancialOverview {
    total_alunos_ativos: i32,
    total_funcionarios_ativos: i32,
    mensalidades_pagas: f64,
    mensalidades_pendentes: f64,
    mensalidades_pagas_count: i32,
    mensalidades_pendentes_count: i32,
    receitas_manuais_recebidas: f64,
    receitas_manuais_pendentes: f64,
    salarios_pagos: f64,
    salarios_pendentes: f64,
    gastos_fixos_mes: f64,
    despesas_manuais_pagas: f64,
    despesas_manuais_pendentes: f64,
    receitas_total_previsto: f64,
    despesas_total_previsto: f64,
    receita_real: f64,
    despesas_pagas: f64,
    saldo_estimado: f64,
    resultado_real: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct DashboardStats {
    total_alunos: i32,
    total_turmas: i32,
    mensalidades_aberto: i32,
    aniversariantes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DashboardStatsCompleto {
    total_alunos: i32,
    total_turmas: i32,
    mensalidades_aberto: i32,
    aniversariantes: Vec<String>,
    total_receitas_alunos: f64,
    total_pendente_alunos: f64,
    total_despesas: f64,
    total_gastos_fixos: f64,
    lucro_liquido: f64,
    total_funcionarios: i32,
    funcionarios_ativos: i32,
    funcionarios_inativos: i32,
    total_salarios: f64,
    alertas: Vec<String>,
}

#[derive(Debug, Serialize)]
struct FuncionariosStats {
    total: i32,
    ativos: i32,
    inativos: i32,
    total_salarios: f64,
    por_cargo: Vec<(String, i32, f64)>,
}

#[derive(Debug, Serialize)]
struct RelatorioFuncionario {
    id: i64,
    nome: String,
    cargo: String,
    salario: f64,
    turmas_alocadas: String,
    total_alunos_atendidos: i64,
    receita_gerada: f64,
    custo: f64,
    saldo: f64,
    status: String,
}

#[derive(Debug, Serialize)]
struct ResumoRelatorioFuncionarios {
    total_folha: f64,
    total_receita_alunos: f64,
    total_receita_servicos: f64,
    total_despesas: f64,
    saldo_operacional: f64,
    percentual_folha: f64,
    total_funcionarios: i64,
    funcionarios_por_cargo: Vec<(String, i64, f64)>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PastaExportacao {
    categoria: String,
    caminho: String,
    descricao: String,
}

#[derive(Debug, Serialize)]
struct FrequenciaAlunoPeriodo {
    aluno_id: i64,
    aluno_nome: String,
    presentes: i64,
    ausencias: i64,
    total_registros: i64,
    percentual_presenca: f64,
}

#[derive(Debug, Serialize)]
struct FrequenciaPeriodoResponse {
    total_alunos: i64,
    total_presencas: i64,
    total_ausencias: i64,
    percentual_presenca_geral: f64,
    percentual_ausencia_geral: f64,
    alunos: Vec<FrequenciaAlunoPeriodo>,
    periodo_inicio: String,
    periodo_fim: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuditLog {
    id: i64,
    user_id: Option<i64>,
    username: Option<String>,
    action: String,
    table_name: Option<String>,
    record_id: Option<i64>,
    old_values: Option<String>,
    new_values: Option<String>,
    description: Option<String>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuditLogFilter {
    user_id: Option<i64>,
    action: Option<String>,
    table_name: Option<String>,
    record_id: Option<i64>,
    data_inicio: Option<String>,
    data_fim: Option<String>,
    search: Option<String>,
}

fn log_audit(
    app: &tauri::AppHandle,
    user_id: Option<i64>,
    username: Option<String>,
    action: &str,
    table_name: Option<&str>,
    record_id: Option<i64>,
    old_values: Option<String>,
    new_values: Option<String>,
    description: &str,
) {
    if let Ok(conn) = get_db_connection(app) {
        let _ = conn.execute(
            "INSERT INTO audit_log (user_id, username, action, table_name, record_id, old_values, new_values, description) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                user_id,
                username,
                action,
                table_name,
                record_id,
                old_values,
                new_values,
                description,
            ],
        );
    }
}

#[tauri::command]
fn registrar_audit_log(
    app: tauri::AppHandle,
    user_id: Option<i64>,
    username: Option<String>,
    action: String,
    table_name: Option<String>,
    record_id: Option<i64>,
    old_values: Option<String>,
    new_values: Option<String>,
    description: Option<String>,
) -> Result<i64, String> {
    log::info!(target: "audit", "[AUDIT] Registrando: action={}, table={:?}, record={:?}", action, table_name, record_id);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO audit_log (user_id, username, action, table_name, record_id, old_values, new_values, description) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            user_id,
            username,
            action,
            table_name,
            record_id,
            old_values,
            new_values,
            description,
        ],
    ).map_err(|e| {
        log::error!(target: "audit", "[AUDIT] Erro SQL: {}", e);
        e.to_string()
    })?;
    let id = conn.last_insert_rowid();
    log::info!(target: "audit", "[AUDIT] Registrado: id={}", id);
    Ok(id)
}

#[tauri::command]
fn listar_audit_logs(app: tauri::AppHandle, filter: AuditLogFilter) -> Result<Vec<AuditLog>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mut query = String::from(
        "SELECT id, user_id, username, action, table_name, record_id, old_values, new_values, description, ip_address, user_agent, created_at 
         FROM audit_log WHERE 1=1"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(user_id) = filter.user_id {
        query.push_str(" AND user_id = ?");
        params_vec.push(Box::new(user_id));
    }

    if let Some(ref action) = filter.action {
        query.push_str(" AND action = ?");
        params_vec.push(Box::new(action.clone()));
    }

    if let Some(ref table_name) = filter.table_name {
        query.push_str(" AND table_name = ?");
        params_vec.push(Box::new(table_name.clone()));
    }

    if let Some(record_id) = filter.record_id {
        query.push_str(" AND record_id = ?");
        params_vec.push(Box::new(record_id));
    }

    if let Some(ref data_inicio) = filter.data_inicio {
        query.push_str(" AND created_at >= ?");
        params_vec.push(Box::new(data_inicio.clone()));
    }

    if let Some(ref data_fim) = filter.data_fim {
        query.push_str(" AND created_at <= ?");
        params_vec.push(Box::new(data_fim.clone()));
    }

    if let Some(ref search) = filter.search {
        query.push_str(" AND (description LIKE ? OR username LIKE ?)");
        let search_pattern = format!("%{}%", search);
        params_vec.push(Box::new(search_pattern.clone()));
        params_vec.push(Box::new(search_pattern));
    }

    query.push_str(" ORDER BY created_at DESC LIMIT 1000");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(AuditLog {
            id: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            action: row.get(3)?,
            table_name: row.get(4)?,
            record_id: row.get(5)?,
            old_values: row.get(6)?,
            new_values: row.get(7)?,
            description: row.get(8)?,
            ip_address: row.get(9)?,
            user_agent: row.get(10)?,
            created_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for row in rows {
        logs.push(row.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

#[tauri::command]
fn get_audit_log_stats(app: tauri::AppHandle, dias: i32) -> Result<serde_json::Value, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let data_inicio = chrono::Local::now() - chrono::Duration::days(dias as i64);
    let data_inicio_str = data_inicio.format("%Y-%m-%d %H:%M:%S").to_string();

    let total_logs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM audit_log WHERE created_at >= ?1",
        params![data_inicio_str],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let logs_por_action: Vec<(String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT action, COUNT(*) as count FROM audit_log WHERE created_at >= ?1 GROUP BY action ORDER BY count DESC"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(params![data_inicio_str], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        result
    };

    let logs_por_tabela: Vec<(String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT table_name, COUNT(*) as count FROM audit_log WHERE created_at >= ?1 AND table_name IS NOT NULL GROUP BY table_name ORDER BY count DESC"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(params![data_inicio_str], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        }).map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        result
    };

    Ok(serde_json::json!({
        "total_logs": total_logs,
        "logs_por_action": logs_por_action,
        "logs_por_tabela": logs_por_tabela,
        "periodo_dias": dias
    }))
}

const NOME_PASTA_APP: &str = "Cuidar-ERP";
const NOME_PASTA_DADOS_SISTEMA: &str = "Cuidar-ERP-VDA";
const NOME_SUBPASTA_BACKUPS: &str = "Backups";

fn documentos_base() -> PathBuf {
    dirs::document_dir().unwrap_or_else(|| {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    })
}

fn install_data_dir() -> PathBuf {
    let base = std::env::var("PROGRAMDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\ProgramData"));
    let dir = base.join(NOME_PASTA_DADOS_SISTEMA).join("Data");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn migrar_dados_legados() {
    let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let legacy_dir = exe.parent().unwrap_or(&PathBuf::from(".")).join("Data");
    let legacy_db = legacy_dir.join("cuidar.db");
    let novo_db = install_data_dir().join("cuidar.db");
    if legacy_db.exists() && !novo_db.exists() {
        for ext in ["", "-wal", "-shm"] {
            let src = legacy_db.with_extension(format!("db{}", ext));
            if src.exists() {
                let dest = novo_db.with_extension(format!("db{}", ext));
                match std::fs::copy(&src, &dest) {
                    Ok(_) => log::info!(
                        target: "system",
                        "[MIGRACAO] Dados copiados de {} para {}",
                        src.display(),
                        dest.display()
                    ),
                    Err(e) => log::error!(target: "system", "[MIGRACAO] Falha ao copiar {}: {}", src.display(), e),
                }
            }
        }
    }
}

pub fn backup_base_dir() -> PathBuf {
    documentos_base()
        .join(NOME_PASTA_APP)
        .join(NOME_SUBPASTA_BACKUPS)
}

fn get_db_path(_app: &tauri::AppHandle) -> PathBuf {
    install_data_dir().join("cuidar.db")
}
fn get_db_connection(app: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
    let path = get_db_path(app);
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;

    MIGRACOES_APLICADAS.get_or_init(|| {
        match migrations::apply_migrations(&conn) {
            Ok(()) => log::info!(target: "migrations", "Migrações verificadas com sucesso"),
            Err(e) => log::error!(target: "migrations", "ERRO ao aplicar migrações: {}", e),
        }
    });

    let _ = conn.execute(
        "INSERT OR IGNORE INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![senha_hash_padrao()]
    );
    Ok(conn)
}

#[tauri::command]
fn listar_alunos_paginado(
    app: tauri::AppHandle,
    paginacao: PaginacaoRequest,
    filtros: Option<serde_json::Value>,
) -> Result<PaginacaoResponse<Aluno>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let pagina = paginacao.pagina.max(1);
    let por_pagina = paginacao.por_pagina.min(100).max(10);
    let offset = (pagina - 1) * por_pagina;

    let campos_validos = ["id", "nome", "data_nascimento", "status", "created_at"];
    let ordenacao = paginacao.ordenacao.unwrap_or_else(|| "nome".to_string());
    let ordenacao = if campos_validos.contains(&ordenacao.as_str()) { ordenacao } else { "nome".to_string() };
    let direcao = if paginacao.direcao.as_deref() == Some("desc") { "DESC" } else { "ASC" };

    let mut where_clause = "WHERE deleted_at IS NULL".to_string();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref f) = filtros {
        if let Some(status) = f.get("status").and_then(|v| v.as_str()) {
            if status != "todos" {
                where_clause.push_str(" AND status = ?");
                params.push(Box::new(status.to_string()));
            }
        }
        if let Some(turma_id) = f.get("turma_id").and_then(|v| v.as_i64()) {
            where_clause.push_str(" AND turma_id = ?");
            params.push(Box::new(turma_id));
        }
        if let Some(busca) = f.get("busca").and_then(|v| v.as_str()) {
            if !busca.is_empty() {
                where_clause.push_str(" AND (nome LIKE ? OR telefone_responsavel LIKE ?)");
                let pattern = format!("%{}%", busca);
                params.push(Box::new(pattern.clone()));
                params.push(Box::new(pattern));
            }
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM alunos {}", where_clause);
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let query = format!(
        "SELECT id, nome, data_nascimento, nome_responsavel, telefone_responsavel, telefone_responsavel_2, status, turma_id, numero_matricula, valor_mensalidade_override, dia_vencimento FROM alunos {} ORDER BY {} {} LIMIT ? OFFSET ?",
        where_clause, ordenacao, direcao
    );
    let mut params_final = params;
    params_final.push(Box::new(por_pagina));
    params_final.push(Box::new(offset));
    let params_refs_final: Vec<&dyn rusqlite::types::ToSql> = params_final.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let alunos: Vec<Aluno> = stmt.query_map(params_refs_final.as_slice(), |row| {
        Ok(Aluno {
            id: row.get(0)?,
            nome: row.get(1)?,
            data_nascimento: row.get(2)?,
            nome_responsavel: row.get(3)?,
            telefone_responsavel: row.get(4)?,
            telefone_responsavel_2: row.get(5)?,
            status: row.get(6)?,
            turma_id: row.get(7)?,
            numero_matricula: row.get(8)?,
            valor_mensalidade_override: row.get(9)?,
            dia_vencimento: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let total_paginas = (total as f64 / por_pagina as f64).ceil() as i64;

    Ok(PaginacaoResponse {
        dados: alunos,
        total,
        pagina,
        por_pagina,
        total_paginas,
    })
}

#[tauri::command]
fn login(app: tauri::AppHandle, username: String, password: String) -> Result<User, String> {
    log::info!(target: "auth", "[LOGIN] Tentativa de login: user={}", username);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let locked_until = match conn.query_row(
        "SELECT locked_until FROM users WHERE username = ?1",
        params![username],
        |row| row.get::<_, Option<String>>(0)
    ) {
        Ok(opt) => opt,
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.to_string()),
    };

    if let Some(locked) = locked_until {
        if let Ok(locked_time) = chrono::NaiveDateTime::parse_from_str(&locked, "%Y-%m-%d %H:%M:%S") {
            let now = chrono::Local::now().naive_local();
            if locked_time > now {
                log::warn!(target: "auth", "[LOGIN] Usuário bloqueado: user={}", username);
                return Err(format!("Usuário bloqueado. Tente novamente após as {}.", locked_time.format("%H:%M")));
            }
        }
    }

    let user: Option<(i64, String, String, String)> = conn.query_row(
        "SELECT id, username, password_hard, role FROM users WHERE username = ?1",
        params![username],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ).optional().map_err(|e| e.to_string())?;

    let (user_id, username_str, stored_hash, role) = user.ok_or_else(|| {
        log::warn!(target: "auth", "[LOGIN] Falha: usuario nao encontrado: user={}", username);
        registrar_tentativa_login(&conn, &username, false, "Usuário não encontrado").ok();
        "Credenciais inválidas".to_string()
    })?;

    let password_valid = verify(&password, &stored_hash).map_err(|e| e.to_string())?;

    if !password_valid {
        log::warn!(target: "auth", "[LOGIN] Falha: senha incorreta: user={}", username);
        incrementar_tentativas_login(&conn, user_id).ok();
        registrar_tentativa_login(&conn, &username, false, "Senha incorreta").ok();
        return Err("Credenciais inválidas".to_string());
    }

    resetar_tentativas_login(&conn, user_id).ok();
    registrar_tentativa_login(&conn, &username, true, "").ok();

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE users SET last_login = ?1 WHERE id = ?2",
        params![&now, user_id]
    ).map_err(|e| e.to_string())?;

    log::info!(target: "auth", "[LOGIN] Login bem-sucedido: user={}, role={}", username_str, role);
    Ok(User { id: user_id, username: username_str, role })
}

#[tauri::command]
fn refresh_token(app: tauri::AppHandle, refresh_token_str: String) -> Result<serde_json::Value, String> {
    let claims = auth::validate_token(&refresh_token_str)?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let token_hash = auth::token_hash(&refresh_token_str);
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM user_sessions WHERE refresh_token_hash = ?1 AND is_active = 1",
        params![token_hash],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    if !exists {
        return Err("Refresh token inválido ou expirado".to_string());
    }

    let new_tokens = auth::generate_tokens(claims.sub, &claims.username, &claims.role)?;
    let new_access_hash = auth::token_hash(&new_tokens.access_token);
    let new_refresh_hash = auth::token_hash(&new_tokens.refresh_token);

    conn.execute(
        "UPDATE user_sessions SET token_hash = ?1, refresh_token_hash = ?2, last_activity = CURRENT_TIMESTAMP WHERE refresh_token_hash = ?3",
        params![new_access_hash, new_refresh_hash, token_hash]
    ).map_err(|e| e.to_string())?;

    log::info!(target: "auth", "[REFRESH] Token renovado: user_id={}", claims.sub);

    Ok(serde_json::json!({
        "access_token": new_tokens.access_token,
        "refresh_token": new_tokens.refresh_token,
        "expires_in": new_tokens.expires_in
    }))
}

#[tauri::command]
fn logout(app: tauri::AppHandle, token: Option<String>) -> Result<(), String> {
    if let Some(ref t) = token {
        let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
        let token_hash = auth::token_hash(t);
        conn.execute(
            "UPDATE user_sessions SET is_active = 0 WHERE token_hash = ?1",
            params![token_hash]
        ).map_err(|e| e.to_string())?;
    }
    log::info!(target: "auth", "[LOGOUT] Usuario desconectado");
    Ok(())
}

#[tauri::command]
fn get_active_sessions(app: tauri::AppHandle, user_id: i64) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, ip_address, user_agent, device_info, created_at, last_activity 
         FROM user_sessions WHERE user_id = ?1 AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
         ORDER BY last_activity DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![user_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "ip_address": row.get::<_, Option<String>>(1)?,
            "user_agent": row.get::<_, Option<String>>(2)?,
            "device_info": row.get::<_, Option<String>>(3)?,
            "created_at": row.get::<_, String>(4)?,
            "last_activity": row.get::<_, String>(5)?
        }))
    }).map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(sessions)
}

#[tauri::command]
fn revoke_session(app: tauri::AppHandle, session_id: i64, user_id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE user_sessions SET is_active = 0 WHERE id = ?1 AND user_id = ?2",
        params![session_id, user_id]
    ).map_err(|e| e.to_string())?;
    log::warn!(target: "auth", "[SESSION] Sessão revogada: session_id={}, user_id={}", session_id, user_id);
    Ok(())
}

#[tauri::command]
fn get_login_history(app: tauri::AppHandle, username: String) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT created_at, success, failure_reason FROM login_attempts WHERE username = ?1 ORDER BY created_at DESC LIMIT 20"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![username], |row| {
        Ok(serde_json::json!({
            "created_at": row.get::<_, String>(0)?,
            "success": row.get::<_, bool>(1)?,
            "failure_reason": row.get::<_, Option<String>>(2)?
        }))
    }).map_err(|e| e.to_string())?;

    let mut history = Vec::new();
    for row in rows {
        history.push(row.map_err(|e| e.to_string())?);
    }
    Ok(history)
}

fn registrar_tentativa_login(conn: &Connection, username: &str, success: bool, reason: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO login_attempts (username, success, failure_reason) VALUES (?1, ?2, ?3)",
        params![username, success as i32, if reason.is_empty() { None::<String> } else { Some(reason.to_string()) }]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn incrementar_tentativas_login(conn: &Connection, user_id: i64) -> Result<(), String> {
    let count: i32 = conn.query_row(
        "SELECT COALESCE(login_attempts_count, 0) FROM users WHERE id = ?1",
        params![user_id],
        |row| row.get(0)
    ).unwrap_or(0);

    let new_count = count + 1;

    if new_count >= auth::MAX_LOGIN_ATTEMPTS {
        let locked_until = chrono::Local::now() + chrono::Duration::minutes(auth::LOCKOUT_MINUTES);
        let locked_str = locked_until.format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "UPDATE users SET login_attempts_count = ?1, locked_until = ?2 WHERE id = ?3",
            params![new_count, &locked_str, user_id]
        ).map_err(|e| e.to_string())?;
        log::warn!(target: "auth", "[LOCKOUT] Usuário bloqueado: user_id={}", user_id);
    } else {
        conn.execute(
            "UPDATE users SET login_attempts_count = ?1 WHERE id = ?2",
            params![new_count, user_id]
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn resetar_tentativas_login(conn: &Connection, user_id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE users SET login_attempts_count = 0, locked_until = NULL WHERE id = ?1",
        params![user_id]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_dashboard_stats(app: tauri::AppHandle) -> Result<DashboardStats, String> {
    let cache_key = "dashboard:stats";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(stats) = serde_json::from_str::<DashboardStats>(&cached) {
            return Ok(stats);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let total_alunos: i32 = conn
        .query_row("SELECT COUNT(*) FROM alunos", [], |r| r.get(0))
        .unwrap_or(0);

    let total_turmas: i32 = conn
        .query_row("SELECT COUNT(*) FROM turmas", [], |r| r.get(0))
        .unwrap_or(0);

    let mes_atual = Local::now().format("%Y-%m").to_string();
    let mensalidades_aberto: i32 = conn
        .query_row("SELECT COUNT(*) FROM mensalidades WHERE pago = 0 AND deleted_at IS NULL AND strftime('%Y-%m', vencimento)=?1", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0);

    let now = Local::now();
    let month = now.month();
    let aniversariantes: Vec<String> = conn
        .prepare("SELECT nome FROM alunos WHERE data_nascimento IS NOT NULL AND CAST(substr(data_nascimento, 6, 2) AS INTEGER) = ?1")
        .map_err(|e| e.to_string())?
        .query_map(params![month], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let stats = DashboardStats {
        total_alunos,
        total_turmas,
        mensalidades_aberto,
        aniversariantes,
    };
    if let Ok(json) = serde_json::to_string(&stats) {
        cache::GLOBAL_CACHE.set(cache_key.to_string(), json, None);
    }
    Ok(stats)
}

#[tauri::command]
fn get_funcionarios_stats(app: tauri::AppHandle) -> Result<FuncionariosStats, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let total: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let ativos: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let inativos: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE status='inativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let total_salarios: f64 = conn
        .query_row("SELECT COALESCE(SUM(salario), 0) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0.0);

    let mut stmt = conn.prepare(
        "SELECT c.nome, COUNT(f.id), COALESCE(SUM(f.salario), 0)
         FROM funcionarios f
         JOIN cargos c ON f.cargo_id = c.id
         WHERE f.deleted_at IS NULL AND c.deleted_at IS NULL
         GROUP BY c.nome ORDER BY c.nome"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?, r.get::<_, f64>(2)?))
    }).map_err(|e| e.to_string())?;
    let mut por_cargo = Vec::new();
    for r in rows {
        por_cargo.push(r.map_err(|e| e.to_string())?);
    }

    Ok(FuncionariosStats { total, ativos, inativos, total_salarios, por_cargo })
}

#[tauri::command]
fn get_dashboard_stats_completo(app: tauri::AppHandle) -> Result<DashboardStatsCompleto, String> {
    let cache_key = "dashboard:stats:completo";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(stats) = serde_json::from_str::<DashboardStatsCompleto>(&cached) {
            return Ok(stats);
        }
    }
    gerar_lancamentos_mes(&app);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mes_atual = Local::now().format("%Y-%m").to_string();
    let total_alunos: i32 = conn
        .query_row("SELECT COUNT(*) FROM alunos WHERE deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let total_turmas: i32 = conn
        .query_row("SELECT COUNT(*) FROM turmas WHERE deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let mensalidades_aberto: i32 = conn
        .query_row("SELECT COUNT(*) FROM mensalidades WHERE pago=0 AND deleted_at IS NULL AND strftime('%Y-%m', vencimento)=?1", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0);

    let month = Local::now().month();
    let aniversariantes: Vec<String> = conn
        .prepare("SELECT nome FROM alunos WHERE data_nascimento IS NOT NULL AND CAST(substr(data_nascimento,6,2) AS INTEGER)=?1 AND deleted_at IS NULL")
        .map_err(|e| e.to_string())?
        .query_map(params![month], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let total_receitas_alunos: f64 = conn
        .query_row("SELECT COALESCE(SUM(valor),0) FROM mensalidades WHERE pago=1 AND strftime('%Y-%m', vencimento)=?1", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0.0);
    let total_pendente_alunos: f64 = conn
        .query_row("SELECT COALESCE(SUM(valor),0) FROM mensalidades WHERE pago=0 AND strftime('%Y-%m', vencimento)=?1", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0.0);
    let total_despesas: f64 = conn
        .query_row("SELECT COALESCE(SUM(valor),0) FROM company_expenses WHERE strftime('%Y-%m', data_despesa)=?1 AND deleted_at IS NULL", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0.0);
    let total_gastos_fixos: f64 = conn
        .query_row("SELECT COALESCE(SUM(valor_atual),0) FROM gastos_fixos WHERE mes=?1 AND deleted_at IS NULL", params![&mes_atual], |r| r.get(0))
        .unwrap_or(0.0);

    let lucro_liquido = total_receitas_alunos - total_despesas - total_gastos_fixos;

    let total_funcionarios: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let funcionarios_ativos: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let funcionarios_inativos: i32 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE status='inativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);
    let total_salarios: f64 = conn
        .query_row("SELECT COALESCE(SUM(salario),0) FROM funcionarios WHERE deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0.0);

    let mut alertas = Vec::new();
    if total_pendente_alunos > 0.0 {
        let palavra = if mensalidades_aberto == 1 { "mensalidade pendente" } else { "mensalidades pendentes" };
        alertas.push(format!("{} {} neste mês", mensalidades_aberto, palavra));
    }
    if total_despesas > total_receitas_alunos {
        alertas.push("Despesas do mês superam as receitas".to_string());
    }
    if lucro_liquido < 0.0 {
        alertas.push("Lucro líquido negativo este mês".to_string());
    }
    if funcionarios_inativos > 0 {
        alertas.push(format!("{} funcionários inativos", funcionarios_inativos));
    }

    let stats = DashboardStatsCompleto {
        total_alunos, total_turmas, mensalidades_aberto, aniversariantes,
        total_receitas_alunos, total_pendente_alunos, total_despesas, total_gastos_fixos, lucro_liquido,
        total_funcionarios, funcionarios_ativos, funcionarios_inativos, total_salarios,
        alertas,
    };
    if let Ok(json) = serde_json::to_string(&stats) {
        cache::GLOBAL_CACHE.set("dashboard:stats:completo".to_string(), json, None);
    }
    Ok(stats)
}

#[tauri::command]
fn get_relatorio_funcionarios(app: tauri::AppHandle, mes: String) -> Result<Vec<RelatorioFuncionario>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT f.id, f.nome_completo, COALESCE(c.nome,''), f.salario, f.status
         FROM funcionarios f
         LEFT JOIN cargos c ON f.cargo_id = c.id
         WHERE f.deleted_at IS NULL
         ORDER BY f.nome_completo"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, f64>(3)?,
            r.get::<_, String>(4)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut relatorios = Vec::new();
    for row in rows {
        let (func_id, nome, cargo, salario, status) = row.map_err(|e| e.to_string())?;

        let turmas_alocadas: String = conn
            .query_row(
                "SELECT COALESCE(GROUP_CONCAT(t.nome, ', '), '') FROM funcionario_turmas ft
                 JOIN turmas t ON ft.turma_id = t.id
                 WHERE ft.funcionario_id=?1 AND t.deleted_at IS NULL",
                params![func_id],
                |r| r.get(0),
            ).unwrap_or_default();

        let total_alunos_atendidos: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT a.id) FROM funcionario_turmas ft
                 JOIN alunos a ON a.turma_id = ft.turma_id
                 WHERE ft.funcionario_id=?1 AND a.deleted_at IS NULL",
                params![func_id],
                |r| r.get(0),
            ).unwrap_or(0);

        let receita_mensalidades: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(m.valor),0) FROM mensalidades m
                 JOIN alunos a ON m.aluno_id = a.id
                 WHERE a.turma_id IN (SELECT turma_id FROM funcionario_turmas WHERE funcionario_id=?1)
                 AND m.pago=1 AND m.vencimento LIKE ?2 AND a.deleted_at IS NULL",
                params![func_id, format!("{}%", mes)],
                |r| r.get(0),
            ).unwrap_or(0.0);

        let receita_servicos: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(asv.valor_acordado),0) FROM aluno_servicos asv
                 JOIN alunos a ON asv.aluno_id = a.id
                 WHERE a.turma_id IN (SELECT turma_id FROM funcionario_turmas WHERE funcionario_id=?1)
                 AND asv.deleted_at IS NULL AND a.deleted_at IS NULL",
                params![func_id],
                |r| r.get(0),
            ).unwrap_or(0.0);

        let custo = salario;
        let receita_gerada = receita_mensalidades + receita_servicos;
        let saldo = receita_gerada - custo;

        relatorios.push(RelatorioFuncionario {
            id: func_id,
            nome,
            cargo,
            salario,
            turmas_alocadas,
            total_alunos_atendidos,
            receita_gerada,
            custo,
            saldo,
            status,
        });
    }

    relatorios.sort_by(|a, b| b.saldo.partial_cmp(&a.saldo).unwrap_or(std::cmp::Ordering::Equal));
    Ok(relatorios)
}

#[tauri::command]
fn get_resumo_relatorio_funcionarios(app: tauri::AppHandle, mes: String) -> Result<ResumoRelatorioFuncionarios, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let total_folha: f64 = conn
        .query_row("SELECT COALESCE(SUM(salario),0) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0.0);

    let total_receita_alunos: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(valor),0) FROM mensalidades WHERE pago=1 AND vencimento LIKE ?1",
            params![format!("{}%", mes)],
            |r| r.get(0),
        ).unwrap_or(0.0);

    let total_receita_servicos: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(asv.valor_acordado),0) FROM aluno_servicos asv
             JOIN alunos a ON asv.aluno_id = a.id
             WHERE asv.deleted_at IS NULL AND a.deleted_at IS NULL",
            [], |r| r.get(0),
        ).unwrap_or(0.0);

    let total_despesas: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(valor),0) FROM company_expenses WHERE data_despesa LIKE ?1 AND deleted_at IS NULL",
            params![format!("{}%", mes)],
            |r| r.get(0),
        ).unwrap_or(0.0);

    let total_receitas = total_receita_alunos + total_receita_servicos;
    let saldo_operacional = total_receitas - total_despesas - total_folha;
    let percentual_folha = if total_receitas > 0.0 { (total_folha / total_receitas) * 100.0 } else { 0.0 };

    let total_funcionarios: i64 = conn
        .query_row("SELECT COUNT(*) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL", [], |r| r.get(0))
        .unwrap_or(0);

    let mut stmt = conn.prepare(
        "SELECT COALESCE(c.nome,''), COUNT(f.id), COALESCE(SUM(f.salario),0)
         FROM funcionarios f
         LEFT JOIN cargos c ON f.cargo_id = c.id
         WHERE f.status='ativo' AND f.deleted_at IS NULL AND (c.deleted_at IS NULL OR c.id IS NULL)
         GROUP BY c.nome ORDER BY c.nome"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, f64>(2)?))
    }).map_err(|e| e.to_string())?;
    let mut funcionarios_por_cargo = Vec::new();
    for r in rows {
        funcionarios_por_cargo.push(r.map_err(|e| e.to_string())?);
    }

    Ok(ResumoRelatorioFuncionarios {
        total_folha,
        total_receita_alunos,
        total_receita_servicos,
        total_despesas,
        saldo_operacional,
        percentual_folha,
        total_funcionarios,
        funcionarios_por_cargo,
    })
}

fn validar_nome_arquivo(nome: &str) -> Result<(), String> {
    if nome.contains("..") || nome.contains("/") || nome.contains("\\") {
        return Err("Nome de arquivo inválido: contém caracteres proibidos".to_string());
    }
    if nome.trim().is_empty() {
        return Err("Nome de arquivo não pode estar vazio".to_string());
    }
    if nome.len() > 255 {
        return Err("Nome de arquivo muito longo (máx 255 caracteres)".to_string());
    }
    Ok(())
}

fn caminho_base(_app: &tauri::AppHandle) -> PathBuf {
    documentos_base().join(NOME_PASTA_APP)
}

fn mapear_categoria(categoria: &str, base: &PathBuf) -> Result<PathBuf, String> {
    let sub = match categoria {
        "relatorios_alunos" => "Relatorios/Relatorios de Alunos",
        "relatorios_frequencia" => "Relatorios/Relatorios de Frequencia",
        "relatorios_funcionarios" => "Relatorios/Relatorios de Funcionarios",
        "relatorios_financeiros" => "Relatorios/Relatorios Financeiros",
        "relatorios_financeiros_alunos" => "Relatorios/Relatorios Financeiros - Alunos",
        "relatorios_ocorrencias" => "Relatorios/Relatorios de Ocorrencias",
        "relatorios_audit_log" => "Relatorios/Audit Log",
        "comprovantes_despesas" => "Financeiro/Despesas",
        "comprovantes_receitas" => "Financeiro/Receitas",
        _ => return Err("Categoria inválida".to_string()),
    };
    Ok(base.join(sub))
}

#[tauri::command]
fn inicializar_estrutura_pastas(app: tauri::AppHandle) -> Result<Vec<PastaExportacao>, String> {
    let base = caminho_base(&app);
    let categorias = vec![
        ("relatorios_alunos", "Relatorios de Alunos"),
        ("relatorios_frequencia", "Relatorios de Frequencia"),
        ("relatorios_funcionarios", "Relatorios de Funcionarios"),
        ("relatorios_financeiros", "Relatorios Financeiros"),
        ("relatorios_financeiros_alunos", "Relatorios Financeiros - Alunos"),
        ("relatorios_ocorrencias", "Relatorios de Ocorrencias"),
        ("relatorios_audit_log", "Audit Log"),
        ("comprovantes_despesas", "Despesas"),
        ("comprovantes_receitas", "Receitas"),
    ];

    let mut pastas = Vec::new();
    for (cat, desc) in &categorias {
        let caminho = mapear_categoria(cat, &base)?;
        pastas.push(PastaExportacao {
            categoria: cat.to_string(),
            caminho: caminho.to_string_lossy().to_string(),
            descricao: desc.to_string(),
        });
    }
    Ok(pastas)
}

#[tauri::command]
fn salvar_arquivo_na_pasta(
    app: tauri::AppHandle,
    categoria: String,
    nome_arquivo: String,
    conteudo: Vec<u8>,
) -> Result<String, String> {
    log::info!(target: "exportacao", "[EXPORT] Salvando arquivo: categoria={}, nome={}, tamanho={} bytes", categoria, nome_arquivo, conteudo.len());
    validar_nome_arquivo(&nome_arquivo)?;
    let base = caminho_base(&app);
    let pasta = mapear_categoria(&categoria, &base)?;
    std::fs::create_dir_all(&pasta)
        .map_err(|e| format!("Erro ao criar pasta: {}", e))?;
    let caminho = pasta.join(&nome_arquivo);
    std::fs::write(&caminho, &conteudo)
        .map_err(|e| {
            log::error!(target: "exportacao", "[EXPORT] Erro ao salvar: {}", e);
            format!("Erro ao salvar arquivo: {}", e)
        })?;
    log::info!(target: "exportacao", "[EXPORT] Arquivo salvo: caminho={}", caminho.display());
    let new_values = serde_json::json!({
        "categoria": categoria,
        "nome_arquivo": nome_arquivo,
        "tamanho_bytes": conteudo.len()
    }).to_string();
    let description = format!("Arquivo exportado: {} ({})", nome_arquivo, categoria);
    log_audit(&app, None, None, "EXPORT", Some("arquivos"), None, None, Some(new_values), &description);
    Ok(caminho.to_string_lossy().to_string())
}

#[tauri::command]
fn abrir_pasta_no_explorador(_app: tauri::AppHandle, caminho: String) -> Result<(), String> {
    let path = std::path::Path::new(&caminho);
    if !path.exists() {
        return Err("Pasta não encontrada".to_string());
    }
    open::that(&caminho)
        .map_err(|e| format!("Erro ao abrir pasta: {}", e))
}

#[tauri::command]
fn salvar_arquivo_em(caminho: String, conteudo: Vec<u8>) -> Result<(), String> {
    let path = std::path::Path::new(&caminho);
    if let Some(pai) = path.parent() {
        std::fs::create_dir_all(pai)
            .map_err(|e| format!("Erro ao criar diretório: {}", e))?;
    }
    std::fs::write(path, &conteudo)
        .map_err(|e| format!("Erro ao salvar arquivo: {}", e))
}

#[tauri::command]
fn verificar_onboarding(app: tauri::AppHandle) -> Result<bool, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let completo: Option<bool> = conn
        .query_row("SELECT onboarding_completo FROM creche WHERE id = 1", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(completo.unwrap_or(false))
}

#[tauri::command]
fn salvar_creche(app: tauri::AppHandle, creche: Creche) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let senha_hash = if let Some(senha) = &creche.senha_admin {
        if !senha.is_empty() {
            Some(hash(senha, DEFAULT_COST).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    conn.execute(
        "INSERT OR REPLACE INTO creche (id, nome, cnpj, endereco, numero, bairro, cidade, estado, telefone, email, senha_admin, onboarding_completo, valor_padrao_mensalidade, dia_vencimento, taxa_matricula) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12, ?13)",
        params![
            creche.nome,
            creche.cnpj,
            creche.endereco,
            creche.numero,
            creche.bairro,
            creche.cidade,
            creche.estado,
            creche.telefone,
            creche.email,
            senha_hash,
            creche.valor_padrao_mensalidade.unwrap_or(0.0),
            creche.dia_vencimento.unwrap_or(5),
            creche.taxa_matricula.unwrap_or(0.0),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_creche(app: tauri::AppHandle) -> Result<CrecheResponse, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let creche = conn
        .query_row(
            "SELECT id, nome, cnpj, endereco, numero, bairro, cidade, estado, telefone, email, onboarding_completo, valor_padrao_mensalidade, dia_vencimento, taxa_matricula FROM creche WHERE id = 1",
            [],
            |r| {
                Ok(CrecheResponse {
                    id: r.get(0)?,
                    nome: r.get(1)?,
                    cnpj: r.get(2)?,
                    endereco: r.get(3)?,
                    numero: r.get(4)?,
                    bairro: r.get(5)?,
                    cidade: r.get(6)?,
                    estado: r.get(7)?,
                    telefone: r.get(8)?,
                    email: r.get(9)?,
                    onboarding_completo: r.get(10)?,
                    valor_padrao_mensalidade: r.get(11)?,
                    dia_vencimento: r.get(12)?,
                    taxa_matricula: r.get(13)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    Ok(creche)
}

#[tauri::command]
fn atualizar_senha_admin(app: tauri::AppHandle, senha_atual: String, nova_senha: String) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let stored_hash: String = conn.query_row(
        "SELECT password_hard FROM users WHERE username = 'admin'",
        [],
        |row| row.get(0),
    ).map_err(|_| "Erro ao verificar senha atual.".to_string())?;

    let valida = verify(&senha_atual, &stored_hash).map_err(|e| e.to_string())?;
    if !valida {
        return Err("Senha atual incorreta.".to_string());
    }

    let hash = hash(&nova_senha, DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE users SET password_hard = ?1 WHERE username = 'admin'",
        params![hash],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE creche SET senha_admin = ?1 WHERE id = 1",
        params![hash],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn listar_alunos(app: tauri::AppHandle) -> Result<Vec<Aluno>, String> {
    let cache_key = "alunos:list:all";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(alunos) = serde_json::from_str::<Vec<Aluno>>(&cached) {
            log::debug!(target: "cache", "[HIT] {}", cache_key);
            return Ok(alunos);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, nome, data_nascimento, nome_responsavel, telefone_responsavel, telefone_responsavel_2, status, turma_id, numero_matricula, valor_mensalidade_override, dia_vencimento FROM alunos WHERE deleted_at IS NULL ORDER BY nome")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Aluno {
                id: r.get(0)?,
                nome: r.get(1)?,
                data_nascimento: r.get(2)?,
                nome_responsavel: r.get(3)?,
                telefone_responsavel: r.get(4)?,
                telefone_responsavel_2: r.get(5)?,
                status: r.get(6)?,
                turma_id: r.get(7)?,
                numero_matricula: r.get(8)?,
                valor_mensalidade_override: r.get(9)?,
                dia_vencimento: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    if let Ok(json) = serde_json::to_string(&out) {
        cache::GLOBAL_CACHE.set(cache_key.to_string(), json, None);
        log::debug!(target: "cache", "[SET] {}", cache_key);
    }
    Ok(out)
}

#[tauri::command]
fn criar_aluno(app: tauri::AppHandle, aluno: Aluno) -> Result<i64, String> {
    log::info!(target: "alunos", "[CRIAR] Criando aluno: nome={}", aluno.nome);
    validar_nome_completo(&aluno.nome, "Nome do aluno")?;
    validar_nome_completo(&aluno.nome_responsavel, "Nome do responsável")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let proxima: i64 = conn.query_row(
        "SELECT COALESCE(MAX(CAST(numero_matricula AS INTEGER)), 0) + 1 FROM alunos WHERE deleted_at IS NULL",
        [],
        |row| row.get(0),
    ).unwrap_or(1);
    let numero_matricula = format!("{:02}", proxima);

    conn.execute(
        "INSERT INTO alunos (nome, data_nascimento, nome_responsavel, telefone_responsavel, telefone_responsavel_2, status, turma_id, numero_matricula, valor_mensalidade_override, dia_vencimento) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![aluno.nome, aluno.data_nascimento, aluno.nome_responsavel, aluno.telefone_responsavel, aluno.telefone_responsavel_2, aluno.status, aluno.turma_id, numero_matricula, aluno.valor_mensalidade_override, aluno.dia_vencimento],
    )
    .map_err(|e| {
        log::error!(target: "alunos", "[CRIAR] Erro SQL: {}", e);
        e.to_string()
    })?;
    let id = conn.last_insert_rowid();
    let new_values = serde_json::json!({
        "nome": aluno.nome,
        "data_nascimento": aluno.data_nascimento,
        "numero_matricula": numero_matricula
    }).to_string();
    let description = format!("Aluno criado: {} (Matrícula {}, ID {})", aluno.nome, numero_matricula, id);
    log_audit(&app, None, None, "CREATE", Some("alunos"), Some(id), None, Some(new_values), &description);
    log::info!(target: "alunos", "[CRIAR] Aluno criado: id={}, nome={}, matrícula={}", id, aluno.nome, numero_matricula);
    cache::GLOBAL_CACHE.invalidate_pattern("alunos:");
    log::debug!(target: "cache", "[INVALIDATE] alunos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(id)
}

#[tauri::command]
fn get_aluno_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Aluno>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, data_nascimento, nome_responsavel, telefone_responsavel, telefone_responsavel_2, status, turma_id, numero_matricula, valor_mensalidade_override, dia_vencimento FROM alunos WHERE id=?1",
        params![id],
        |r| Ok(Aluno {
            id: r.get(0)?,
            nome: r.get(1)?,
            data_nascimento: r.get(2)?,
            nome_responsavel: r.get(3)?,
            telefone_responsavel: r.get(4)?,
            telefone_responsavel_2: r.get(5)?,
            status: r.get(6)?,
            turma_id: r.get(7)?,
            numero_matricula: r.get(8)?,
            valor_mensalidade_override: r.get(9)?,
            dia_vencimento: r.get(10)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_aluno(app: tauri::AppHandle, aluno: Aluno) -> Result<(), String> {
    log::info!(target: "alunos", "[UPDATE] Atualizando aluno: id={:?}, nome={}", aluno.id, aluno.nome);
    let aluno_id = aluno.id.ok_or("ID do aluno é obrigatório")?;
    validar_nome_completo(&aluno.nome, "Nome do aluno")?;
    validar_nome_completo(&aluno.nome_responsavel, "Nome do responsável")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let old_data: Option<(String, String)> = conn.query_row(
        "SELECT nome, data_nascimento FROM alunos WHERE id=?1",
        params![aluno_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).optional().map_err(|e| e.to_string())?;
    let old_values = old_data.map(|(n, d)| serde_json::json!({"nome": n, "data_nascimento": d}).to_string());

    conn.execute(
        "UPDATE alunos SET nome=?1, data_nascimento=?2, nome_responsavel=?3, telefone_responsavel=?4, telefone_responsavel_2=?5, status=?6, turma_id=?7, valor_mensalidade_override=?8, dia_vencimento=?9 WHERE id=?10",
        params![aluno.nome, aluno.data_nascimento, aluno.nome_responsavel, aluno.telefone_responsavel, aluno.telefone_responsavel_2, aluno.status, aluno.turma_id, aluno.valor_mensalidade_override, aluno.dia_vencimento, aluno_id],
    ).map_err(|e| e.to_string())?;

    if let Err(e) = recalcular_vencimentos_pendentes(&conn, aluno_id) {
        log::warn!(target: "alunos", "Falha ao recalcular vencimentos pendentes do aluno {}: {}", aluno_id, e);
    }

    let new_values = serde_json::json!({
        "nome": aluno.nome,
        "data_nascimento": aluno.data_nascimento
    }).to_string();
    let description = format!("Aluno atualizado: ID {}", aluno_id);
    log_audit(&app, None, None, "UPDATE", Some("alunos"), Some(aluno_id), old_values, Some(new_values), &description);
    log::info!(target: "alunos", "[UPDATE] Aluno atualizado: id={:?}, nome={}", aluno.id, aluno.nome);
    cache::GLOBAL_CACHE.invalidate_pattern("alunos:");
    log::debug!(target: "cache", "[INVALIDATE] alunos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn get_alunos_by_turma(app: tauri::AppHandle, turma_id: i64) -> Result<Vec<Aluno>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, nome, data_nascimento, nome_responsavel, telefone_responsavel, telefone_responsavel_2, status, turma_id, numero_matricula, valor_mensalidade_override, dia_vencimento FROM alunos WHERE turma_id = ?1 AND deleted_at IS NULL ORDER BY nome")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![turma_id], |r| {
            Ok(Aluno {
                id: r.get(0)?,
                nome: r.get(1)?,
                data_nascimento: r.get(2)?,
                nome_responsavel: r.get(3)?,
                telefone_responsavel: r.get(4)?,
                telefone_responsavel_2: r.get(5)?,
                status: r.get(6)?,
                turma_id: r.get(7)?,
                numero_matricula: r.get(8)?,
                valor_mensalidade_override: r.get(9)?,
                dia_vencimento: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn get_turmas(app: tauri::AppHandle) -> Result<Vec<Turma>, String> {
    let cache_key = "turmas:list:all";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(turmas) = serde_json::from_str::<Vec<Turma>>(&cached) {
            log::debug!(target: "cache", "[HIT] {}", cache_key);
            return Ok(turmas);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, nome, ano, turno, vagas, status, responsaveis FROM turmas WHERE deleted_at IS NULL").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(Turma{ id: r.get(0)?, nome: r.get(1)?, ano: r.get(2)?, turno: r.get(3)?, vagas: r.get(4)?, status: r.get(5)?, responsaveis: r.get(6)? })).map_err(|e| e.to_string())?;
    let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); }
    if let Ok(json) = serde_json::to_string(&out) {
        cache::GLOBAL_CACHE.set(cache_key.to_string(), json, None);
        log::debug!(target: "cache", "[SET] {}", cache_key);
    }
    Ok(out)
}
#[tauri::command]
fn create_turma(app: tauri::AppHandle, turma: Turma) -> Result<i64, String> {
    validar_nome(&turma.nome, "Nome da turma")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO turmas (nome, ano, turno, vagas, status, responsaveis) VALUES (?1,?2,?3,?4,?5,?6)", params![turma.nome, turma.ano, turma.turno, turma.vagas, turma.status.as_deref().unwrap_or("ativa"), turma.responsaveis]).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    cache::GLOBAL_CACHE.invalidate_pattern("turmas:");
    log::debug!(target: "cache", "[INVALIDATE] turmas:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(id)
}
#[tauri::command]
fn get_turma_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Turma>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row("SELECT id, nome, ano, turno, vagas, status, responsaveis FROM turmas WHERE id=?1 AND deleted_at IS NULL", params![id], |r| Ok(Turma{ id: r.get(0)?, nome: r.get(1)?, ano: r.get(2)?, turno: r.get(3)?, vagas: r.get(4)?, status: r.get(5)?, responsaveis: r.get(6)? })).optional().map_err(|e| e.to_string())?)
}
#[tauri::command]
fn update_turma(app: tauri::AppHandle, turma: Turma) -> Result<(), String> {
    validar_nome(&turma.nome, "Nome da turma")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute("UPDATE turmas SET nome=?1, ano=?2, turno=?3, vagas=?4, status=?5, responsaveis=?6 WHERE id=?7 AND deleted_at IS NULL",
        params![turma.nome.trim(), turma.ano, turma.turno, turma.vagas, turma.status, turma.responsaveis, turma.id]
    ).map_err(|e| e.to_string())?;
    if conn.changes() == 0 {
        return Err("Turma não encontrada ou já foi excluída".to_string());
    }
    cache::GLOBAL_CACHE.invalidate_pattern("turmas:");
    log::debug!(target: "cache", "[INVALIDATE] turmas:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn get_responsaveis(app: tauri::AppHandle) -> Result<Vec<Responsavel>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, nome, telefone, email, cpf FROM responsaveis").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(Responsavel{ id: r.get(0)?, nome: r.get(1)?, telefone: r.get(2)?, email: r.get(3)?, cpf: r.get(4)? })).map_err(|e| e.to_string())?;
    let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_responsavel(app: tauri::AppHandle, r: Responsavel) -> Result<i64, String> {
    validar_nome_completo(&r.nome, "Nome do responsável")?;
    if let Some(ref email) = r.email { validar_email(email)?; }
    if let Some(ref telefone) = r.telefone { validar_telefone(telefone)?; }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("INSERT INTO responsaveis (nome, telefone, email, cpf) VALUES (?1,?2,?3,?4)", params![r.nome, r.telefone, r.email, r.cpf]).map_err(|e| e.to_string())?; Ok(conn.last_insert_rowid())
}
#[tauri::command]
fn update_responsavel(app: tauri::AppHandle, r: Responsavel) -> Result<(), String> {
    validar_nome_completo(&r.nome, "Nome do responsável")?;
    if let Some(ref email) = r.email { validar_email(email)?; }
    if let Some(ref telefone) = r.telefone { validar_telefone(telefone)?; }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("UPDATE responsaveis SET nome=?1, telefone=?2, email=?3, cpf=?4 WHERE id=?5", params![r.nome, r.telefone, r.email, r.cpf, r.id]).map_err(|e| e.to_string())?; Ok(())
}
#[tauri::command]
fn get_responsavel_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Responsavel>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; Ok(conn.query_row("SELECT id, nome, telefone, email, cpf FROM responsaveis WHERE id=?1", params![id], |r| Ok(Responsavel{ id: r.get(0)?, nome: r.get(1)?, telefone: r.get(2)?, email: r.get(3)?, cpf: r.get(4)? })).optional().map_err(|e| e.to_string())?)
}
#[tauri::command]
fn delete_responsavel(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("DELETE FROM responsaveis WHERE id=?1", params![id]).map_err(|e| e.to_string())?; Ok(())
}

#[tauri::command]
fn get_crianca_responsaveis(app: tauri::AppHandle) -> Result<Vec<CriancaResponsavel>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, aluno_id, responsavel_id, parentesco, principal FROM crianca_responsaveis").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok(CriancaResponsavel{ id: r.get(0)?, aluno_id: r.get(1)?, responsavel_id: r.get(2)?, parentesco: r.get(3)?, principal: r.get(4)? })).map_err(|e| e.to_string())?;
    let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_crianca_responsavel(app: tauri::AppHandle, cr: CriancaResponsavel) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("INSERT INTO crianca_responsaveis (aluno_id, responsavel_id, parentesco) VALUES (?1,?2,?3)", params![cr.aluno_id, cr.responsavel_id, cr.parentesco]).map_err(|e| e.to_string())?; Ok(conn.last_insert_rowid())
}
#[tauri::command]
fn delete_crianca_responsavel(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("DELETE FROM crianca_responsaveis WHERE id=?1", params![id]).map_err(|e| e.to_string())?; Ok(())
}

#[tauri::command]
fn get_matriculas(app: tauri::AppHandle) -> Result<Vec<Matricula>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; let mut stmt = conn.prepare("SELECT id, aluno_id, turma_id, data_matricula, status FROM matriculas").map_err(|e| e.to_string())?; let rows = stmt.query_map([], |r| Ok(Matricula{ id: r.get(0)?, aluno_id: r.get(1)?, turma_id: r.get(2)?, data_matricula: r.get(3)?, status: r.get(4)? })).map_err(|e| e.to_string())?; let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_matricula(app: tauri::AppHandle, m: Matricula) -> Result<i64, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("INSERT INTO matriculas (aluno_id, turma_id, data_matricula, status) VALUES (?1,?2,?3,?4)", params![m.aluno_id, m.turma_id, m.data_matricula, m.status]).map_err(|e| e.to_string())?; Ok(conn.last_insert_rowid()) }
#[tauri::command]
fn get_matricula_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Matricula>, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; Ok(conn.query_row("SELECT id, aluno_id, turma_id, data_matricula, status FROM matriculas WHERE id=?1", params![id], |r| Ok(Matricula{ id: r.get(0)?, aluno_id: r.get(1)?, turma_id: r.get(2)?, data_matricula: r.get(3)?, status: r.get(4)? })).optional().map_err(|e| e.to_string())?) }
#[tauri::command]
fn update_matricula(app: tauri::AppHandle, m: Matricula) -> Result<(), String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("UPDATE matriculas SET aluno_id=?1, turma_id=?2, data_matricula=?3, status=?4 WHERE id=?5", params![m.aluno_id, m.turma_id, m.data_matricula, m.status, m.id]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn delete_matricula(app: tauri::AppHandle, id: i64) -> Result<(), String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("DELETE FROM matriculas WHERE id=?1", params![id]).map_err(|e| e.to_string())?; Ok(()) }

#[tauri::command]
fn get_mensalidades(app: tauri::AppHandle) -> Result<Vec<Mensalidade>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; let mut stmt = conn.prepare("SELECT id, aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento, COALESCE(taxa_matricula, 0) FROM mensalidades WHERE deleted_at IS NULL").map_err(|e| e.to_string())?; let rows = stmt.query_map([], |r| Ok(Mensalidade{ id: r.get(0)?, aluno_id: r.get(1)?, vencimento: r.get(2)?, valor: r.get(3)?, pago: r.get(4)?, data_pagamento: r.get(5)?, forma_pagamento: r.get(6)?, taxa_matricula: r.get(7)? })).map_err(|e| e.to_string())?; let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_mensalidade(app: tauri::AppHandle, m: Mensalidade) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento, taxa_matricula) VALUES (?1,?2,?3,?4,?5,?6,?7)", params![m.aluno_id, m.vencimento, m.valor, m.pago.unwrap_or(0), m.data_pagamento, m.forma_pagamento, m.taxa_matricula.unwrap_or(0.0)]).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(conn.last_insert_rowid())
}
#[tauri::command]
fn get_mensalidade_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Mensalidade>, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; Ok(conn.query_row("SELECT id, aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento, COALESCE(taxa_matricula, 0) FROM mensalidades WHERE id=?1", params![id], |r| Ok(Mensalidade{ id: r.get(0)?, aluno_id: r.get(1)?, vencimento: r.get(2)?, valor: r.get(3)?, pago: r.get(4)?, data_pagamento: r.get(5)?, forma_pagamento: r.get(6)?, taxa_matricula: r.get(7)? })).optional().map_err(|e| e.to_string())?) }
#[tauri::command]
fn update_mensalidade(app: tauri::AppHandle, m: Mensalidade) -> Result<(), String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("UPDATE mensalidades SET aluno_id=?1, vencimento=?2, valor=?3, pago=?4, data_pagamento=?5, forma_pagamento=?6, taxa_matricula=COALESCE(?7, 0) WHERE id=?8", params![m.aluno_id, m.vencimento, m.valor, m.pago, m.data_pagamento, m.forma_pagamento, m.taxa_matricula, m.id]).map_err(|e| e.to_string())?; Ok(()) }
#[tauri::command]
fn pagar_mensalidade(app: tauri::AppHandle, id: i64, data_pagamento: String, forma_pagamento: String) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute("UPDATE mensalidades SET pago=1, data_pagamento=?1, forma_pagamento=?2 WHERE id=?3", params![data_pagamento, forma_pagamento, id]).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

fn calcular_valor_mensalidade(conn: &Connection, aluno_id: i64) -> Result<f64, String> {
    let mut stmt = conn.prepare("SELECT valor_mensalidade_override FROM alunos WHERE id = ?1 AND deleted_at IS NULL").map_err(|e| e.to_string())?;
    let override_valor: Option<Option<f64>> = stmt.query_row([aluno_id], |row| row.get(0)).ok();
    let base: f64 = if let Some(Some(valor)) = override_valor {
        if valor > 0.0 { valor } else { 0.0 }
    } else { 0.0 };
    let mut stmt = conn.prepare("SELECT COALESCE(SUM(asv.valor_acordado), 0) FROM aluno_servicos asv WHERE asv.aluno_id = ?1 AND asv.deleted_at IS NULL").map_err(|e| e.to_string())?;
    let soma_servicos: f64 = stmt.query_row([aluno_id], |row| row.get(0)).unwrap_or(0.0);
    let mut stmt = conn.prepare("SELECT COALESCE(valor_padrao_mensalidade, 0) FROM creche WHERE id = 1").map_err(|e| e.to_string())?;
    let valor_padrao: f64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0.0);
    let base_final = if base > 0.0 { base } else { valor_padrao };
    Ok(base_final + soma_servicos)
}

fn construir_vencimento(mes_referencia: &str, dia: i64) -> Result<String, String> {
    let partes: Vec<&str> = mes_referencia.split('-').collect();
    let ano: i32 = partes.get(0).and_then(|s| s.parse().ok()).unwrap_or(2026);
    let mes_num: u32 = partes.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);
    let ultimo_dia = dias_no_mes(ano, mes_num);
    let dia_seguro = dia.min(ultimo_dia as i64).max(1);
    Ok(format!("{}-{:02}", mes_referencia, dia_seguro))
}

fn dia_vencimento_creche(conn: &Connection) -> i64 {
    match conn.prepare("SELECT COALESCE(dia_vencimento, 5) FROM creche WHERE id = 1") {
        Ok(mut stmt) => stmt.query_row([], |row| row.get(0)).unwrap_or(5),
        Err(_) => 5,
    }
}

fn dia_vencimento_efetivo(conn: &Connection, aluno_id: i64) -> Result<i64, String> {
    let dia_aluno: Option<i64> = conn.query_row(
        "SELECT dia_vencimento FROM alunos WHERE id = ?1 AND deleted_at IS NULL",
        params![aluno_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    if let Some(dia) = dia_aluno {
        return Ok(dia);
    }
    Ok(dia_vencimento_creche(conn))
}

fn calcular_vencimento_para_aluno(conn: &Connection, aluno_id: i64, mes_referencia: &str) -> Result<String, String> {
    let dia = dia_vencimento_efetivo(conn, aluno_id)?;
    construir_vencimento(mes_referencia, dia)
}

fn dias_no_mes(ano: i32, mes: u32) -> u32 {
    match mes {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (ano % 4 == 0 && ano % 100 != 0) || ano % 400 == 0 { 29 } else { 28 }
        }
        _ => 30,
    }
}

fn recalcular_mensalidades_pendentes(conn: &Connection, aluno_id: i64) -> Result<(), String> {
    let valor = calcular_valor_mensalidade(conn, aluno_id)?;
    if valor > 0.0 {
        conn.execute(
            "UPDATE mensalidades SET valor = ?2 + COALESCE(taxa_matricula, 0) WHERE aluno_id = ?1 AND pago = 0 AND deleted_at IS NULL",
            params![aluno_id, valor],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn recalcular_vencimentos_pendentes(conn: &Connection, aluno_id: i64) -> Result<(), String> {
    let dia = dia_vencimento_efetivo(conn, aluno_id)?;
    let mut stmt = conn.prepare(
        "SELECT id, substr(vencimento, 1, 7) FROM mensalidades WHERE aluno_id = ?1 AND pago = 0 AND deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String)> = stmt.query_map(params![aluno_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    for (id, mes) in rows {
        let novo_vencimento = construir_vencimento(&mes, dia)?;
        conn.execute(
            "UPDATE mensalidades SET vencimento = ?2 WHERE id = ?1 AND pago = 0",
            params![id, novo_vencimento],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn taxa_matricula_para_mes(conn: &Connection, aluno_id: i64, mes_referencia: &str) -> f64 {
    let mut stmt = match conn.prepare(
        "SELECT CASE WHEN strftime('%Y-%m', a.created_at, 'localtime') = ?2
             THEN COALESCE((SELECT taxa_matricula FROM creche WHERE id = 1), 0) ELSE 0 END
         FROM alunos a WHERE a.id = ?1 AND a.deleted_at IS NULL"
    ) {
        Ok(s) => s,
        Err(_) => return 0.0,
    };
    stmt.query_row(params![aluno_id, mes_referencia], |row| row.get(0)).unwrap_or(0.0)
}

#[tauri::command]
fn gerar_mensalidade_para_aluno(app: tauri::AppHandle, aluno_id: i64, mes_referencia: String) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    if mes_referencia.len() != 7 || !mes_referencia.contains('-') {
        return Err("Formato de mês inválido. Use YYYY-MM".to_string());
    }
    let vencimento = calcular_vencimento_para_aluno(&conn, aluno_id, &mes_referencia)?;
    let valor = calcular_valor_mensalidade(&conn, aluno_id)?;
    if valor <= 0.0 {
        return Err("Não foi possível calcular o valor da mensalidade. Configure o valor padrão da creche ou vincule serviços ao aluno.".to_string());
    }
    let taxa = taxa_matricula_para_mes(&conn, aluno_id, &mes_referencia);
    let mut check_stmt = conn.prepare("SELECT id FROM mensalidades WHERE aluno_id = ?1 AND vencimento = ?2 AND deleted_at IS NULL").map_err(|e| e.to_string())?;
    let existe: Option<i64> = check_stmt.query_row(params![aluno_id, &vencimento], |row| row.get(0)).ok();
    if existe.is_some() {
        return Err(format!("Já existe mensalidade para este aluno no mês {}", mes_referencia));
    }
    conn.execute("INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, taxa_matricula) VALUES (?1, ?2, ?3, 0, ?4)", params![aluno_id, vencimento, valor + taxa, taxa]).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn gerar_mensalidades_do_mes(app: tauri::AppHandle, mes_referencia: String) -> Result<Vec<i64>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    if mes_referencia.len() != 7 || !mes_referencia.contains('-') {
        return Err("Formato de mês inválido. Use YYYY-MM".to_string());
    }
    let mut stmt_alunos = conn.prepare("SELECT id FROM alunos WHERE status = 'ativo' AND deleted_at IS NULL ORDER BY nome").map_err(|e| e.to_string())?;
    let alunos: Vec<i64> = stmt_alunos.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let mut check_stmt = conn.prepare("SELECT id FROM mensalidades WHERE aluno_id = ?1 AND vencimento = ?2 AND deleted_at IS NULL").map_err(|e| e.to_string())?;
    let mut insert_stmt = conn.prepare("INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, taxa_matricula) VALUES (?1, ?2, ?3, 0, ?4)").map_err(|e| e.to_string())?;
    let mut criadas: Vec<i64> = Vec::new();
    for aluno_id in alunos {
        let valor = match calcular_valor_mensalidade(&conn, aluno_id) {
            Ok(v) if v > 0.0 => v,
            _ => continue,
        };
        let vencimento = match calcular_vencimento_para_aluno(&conn, aluno_id, &mes_referencia) {
            Ok(v) => v,
            Err(e) => {
                log::warn!(target: "mensalidades", "Falha ao calcular vencimento do aluno {}: {}", aluno_id, e);
                continue;
            }
        };
        let existe: Option<i64> = check_stmt.query_row(params![aluno_id, &vencimento], |row| row.get(0)).ok();
        if existe.is_some() {
            continue;
        }
        let taxa = taxa_matricula_para_mes(&conn, aluno_id, &mes_referencia);
        insert_stmt.execute(params![aluno_id, &vencimento, valor + taxa, taxa]).map_err(|e| e.to_string())?;
        criadas.push(conn.last_insert_rowid());
    }
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(criadas)
}

#[tauri::command]
fn atualizar_taxa_matricula_mensalidade(app: tauri::AppHandle, id: i64, taxa: f64) -> Result<(), String> {
    if taxa < 0.0 {
        return Err("O valor da taxa não pode ser negativo".to_string());
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE mensalidades SET valor = valor - COALESCE(taxa_matricula, 0) + ?1, taxa_matricula = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![taxa, id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn gerar_salarios_mes(app: tauri::AppHandle, mes_referencia: String) -> Result<Vec<i64>, String> {
    if mes_referencia.len() != 7 || !mes_referencia.contains('-') {
        return Err("Formato de mês inválido. Use YYYY-MM".to_string());
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt_func = conn.prepare(
        "SELECT id, salario FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;
    let funcionarios: Vec<(i64, f64)> = stmt_func.query_map([], |r| {
        Ok((r.get(0)?, r.get(1)?))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();

    let mut check_stmt = conn.prepare(
        "SELECT COUNT(*) > 0 FROM pagamentos_salarios WHERE funcionario_id=?1 AND mes=?2 AND deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;
    let mut insert_stmt = conn.prepare(
        "INSERT INTO pagamentos_salarios (funcionario_id, mes, valor, pago) VALUES (?1, ?2, ?3, 0)"
    ).map_err(|e| e.to_string())?;

    let mut criados = Vec::new();
    for (func_id, salario) in funcionarios {
        let existe: bool = check_stmt.query_row(params![func_id, &mes_referencia], |r| r.get(0)).unwrap_or(false);
        if existe { continue; }
        insert_stmt.execute(params![func_id, &mes_referencia, salario]).map_err(|e| e.to_string())?;
        criados.push(conn.last_insert_rowid());
    }
    Ok(criados)
}

#[tauri::command]
fn gerar_gastos_fixos_mes(app: tauri::AppHandle, mes_referencia: String) -> Result<Vec<i64>, String> {
    if mes_referencia.len() != 7 || !mes_referencia.contains('-') {
        return Err("Formato de mês inválido. Use YYYY-MM".to_string());
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT g1.nome, g1.valor_padrao, g1.descricao, COALESCE(g1.status, 'ativo')
         FROM gastos_fixos g1
         WHERE g1.deleted_at IS NULL
         AND NOT EXISTS (
             SELECT 1 FROM gastos_fixos g2
             WHERE g2.nome = g1.nome AND g2.mes = ?1 AND g2.deleted_at IS NULL
         )"
    ).map_err(|e| e.to_string())?;
    let mut insert_stmt = conn.prepare(
        "INSERT INTO gastos_fixos (nome, valor_padrao, valor_atual, mes, descricao, status, editavel) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&mes_referencia], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, f64>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, String>(3)?,
        ))
    }).map_err(|e| e.to_string())?;
    let mut criados = Vec::new();
    for row in rows {
        let (nome, valor_padrao, descricao, status) = row.map_err(|e| e.to_string())?;
        insert_stmt.execute(params![nome, valor_padrao, valor_padrao, &mes_referencia, descricao, status]).map_err(|e| e.to_string())?;
        criados.push(conn.last_insert_rowid());
    }
    Ok(criados)
}

fn gerar_lancamentos_mes(app: &tauri::AppHandle) {
    let now = chrono::Local::now();
    let mes_atual = now.format("%Y-%m").to_string();
    if let Err(e) = gerar_mensalidades_do_mes(app.clone(), mes_atual.clone()) {
        log::error!("Auto-generacao mensalidades: {}", e);
    }
    if let Err(e) = gerar_salarios_mes(app.clone(), mes_atual.clone()) {
        log::error!("Auto-generacao salarios: {}", e);
    }
    if let Err(e) = gerar_gastos_fixos_mes(app.clone(), mes_atual) {
        log::error!("Auto-generacao gastos fixos: {}", e);
    }
}

#[tauri::command]
fn get_frequencias(app: tauri::AppHandle) -> Result<Vec<Frequencia>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; let mut stmt = conn.prepare("SELECT id, aluno_id, data, presente, tipo_justificativa, justificativa FROM frequencias WHERE deleted_at IS NULL").map_err(|e| e.to_string())?; let rows = stmt.query_map([], |r| Ok(Frequencia{ id: r.get(0)?, aluno_id: r.get(1)?, data: r.get(2)?, presente: r.get(3)?, tipo_justificativa: r.get(4)?, justificativa: r.get(5)? })).map_err(|e| e.to_string())?; let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_frequencia(app: tauri::AppHandle, f: Frequencia) -> Result<i64, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("INSERT INTO frequencias (aluno_id, data, presente, tipo_justificativa, justificativa) VALUES (?1,?2,?3,?4,?5)", params![f.aluno_id, f.data, f.presente, f.tipo_justificativa, f.justificativa]).map_err(|e| e.to_string())?; Ok(conn.last_insert_rowid()) }
#[tauri::command]
fn get_frequencia_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Frequencia>, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; Ok(conn.query_row("SELECT id, aluno_id, data, presente, tipo_justificativa, justificativa FROM frequencias WHERE id=?1", params![id], |r| Ok(Frequencia{ id: r.get(0)?, aluno_id: r.get(1)?, data: r.get(2)?, presente: r.get(3)?, tipo_justificativa: r.get(4)?, justificativa: r.get(5)? })).optional().map_err(|e| e.to_string())?) }
#[tauri::command]
fn update_frequencia(app: tauri::AppHandle, f: Frequencia) -> Result<(), String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("UPDATE frequencias SET aluno_id=?1, data=?2, presente=?3, tipo_justificativa=?4, justificativa=?5 WHERE id=?6", params![f.aluno_id, f.data, f.presente, f.tipo_justificativa, f.justificativa, f.id]).map_err(|e| e.to_string())?; Ok(()) }

#[tauri::command]
fn salvar_frequencia_turma(app: tauri::AppHandle, turma_id: i64, data: String, registros: String) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let existing = conn.query_row(
        "SELECT id FROM frequencia_registros WHERE turma_id=?1 AND data=?2 AND deleted_at IS NULL",
        params![turma_id, data],
        |r| r.get::<_, i64>(0),
    ).optional().map_err(|e| e.to_string())?;
    if let Some(id) = existing {
        conn.execute(
            "UPDATE frequencia_registros SET registros=?1 WHERE id=?2",
            params![registros, id],
        ).map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (?1, ?2, ?3)",
            params![turma_id, data, registros],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn get_frequencia_por_turma_data(app: tauri::AppHandle, turma_id: i64, data: String) -> Result<Option<FrequenciaRegistro>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, turma_id, data, registros FROM frequencia_registros WHERE turma_id=?1 AND data=?2 AND deleted_at IS NULL",
        params![turma_id, data],
        |r| Ok(FrequenciaRegistro { id: r.get(0)?, turma_id: r.get(1)?, data: r.get(2)?, registros: r.get(3)? }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn get_frequencia_historico(app: tauri::AppHandle, turma_id: i64) -> Result<Vec<FrequenciaRegistro>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, turma_id, data, registros FROM frequencia_registros WHERE turma_id=?1 AND deleted_at IS NULL ORDER BY data DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![turma_id], |r| Ok(FrequenciaRegistro { id: r.get(0)?, turma_id: r.get(1)?, data: r.get(2)?, registros: r.get(3)? })).map_err(|e| e.to_string())?;
    let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}

#[derive(Debug, Serialize, Deserialize)]
struct UltimaFrequencia {
    aluno_id: i64,
    data: String,
    presente: bool,
}

#[tauri::command]
fn get_ultima_frequencia_alunos(app: tauri::AppHandle) -> Result<Vec<UltimaFrequencia>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, turma_id, data, registros FROM frequencia_registros WHERE deleted_at IS NULL ORDER BY data DESC"
    ).map_err(|e| e.to_string())?;
    
    let mut ultimas_frequencias: std::collections::HashMap<i64, UltimaFrequencia> = std::collections::HashMap::new();
    
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(2)?,  // data
            r.get::<_, String>(3)?,  // registros JSON
        ))
    }).map_err(|e| e.to_string())?;
    
    for row in rows {
        let (data, registros_json) = row.map_err(|e| e.to_string())?;
        
        if let Ok(registros) = serde_json::from_str::<Vec<serde_json::Value>>(&registros_json) {
            for reg in registros {
                if let (Some(aluno_id), Some(presente)) = (
                    reg.get("alunoId").and_then(|v| v.as_i64()),
                    reg.get("presente").and_then(|v| v.as_bool()),
                ) {
                    ultimas_frequencias.entry(aluno_id).or_insert(UltimaFrequencia {
                        aluno_id,
                        data: data.clone(),
                        presente,
                    });
                }
            }
        }
    }
    
    let mut result: Vec<UltimaFrequencia> = ultimas_frequencias.into_values().collect();
    result.sort_by(|a, b| a.aluno_id.cmp(&b.aluno_id));
    Ok(result)
}

#[tauri::command]
fn get_ocorrencias(app: tauri::AppHandle) -> Result<Vec<Ocorrencia>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?; let mut stmt = conn.prepare("SELECT id, aluno_id, data, descricao, tipo FROM ocorrencias WHERE deleted_at IS NULL").map_err(|e| e.to_string())?; let rows = stmt.query_map([], |r| Ok(Ocorrencia{ id: r.get(0)?, aluno_id: r.get(1)?, data: r.get(2)?, descricao: r.get(3)?, tipo: r.get(4)? })).map_err(|e| e.to_string())?; let mut out = Vec::new(); for r in rows { out.push(r.map_err(|e| e.to_string())?); } Ok(out)
}
#[tauri::command]
fn create_ocorrencia(app: tauri::AppHandle, o: Ocorrencia) -> Result<i64, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; conn.execute("INSERT INTO ocorrencias (aluno_id, data, descricao, tipo) VALUES (?1,?2,?3,?4)", params![o.aluno_id, o.data, o.descricao, o.tipo]).map_err(|e| e.to_string())?; Ok(conn.last_insert_rowid()) }
#[tauri::command]
fn get_ocorrencia_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Ocorrencia>, String> { let conn = get_db_connection(&app).map_err(|e| e.to_string())?; Ok(conn.query_row("SELECT id, aluno_id, data, descricao, tipo FROM ocorrencias WHERE id=?1", params![id], |r| Ok(Ocorrencia{ id: r.get(0)?, aluno_id: r.get(1)?, data: r.get(2)?, descricao: r.get(3)?, tipo: r.get(4)? })).optional().map_err(|e| e.to_string())?) }

#[tauri::command]
fn get_ocorrencias_periodo(
    app: tauri::AppHandle,
    data_inicio: String,
    data_fim: String,
) -> Result<Vec<Ocorrencia>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, aluno_id, data, descricao, tipo 
         FROM ocorrencias 
         WHERE data >= ?1 AND data <= ?2 AND deleted_at IS NULL
         ORDER BY data DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&data_inicio, &data_fim], |r| {
        Ok(Ocorrencia {
            id: r.get(0)?,
            aluno_id: r.get(1)?,
            data: r.get(2)?,
            descricao: r.get(3)?,
            tipo: r.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
#[tauri::command]
fn update_ocorrencia(app: tauri::AppHandle, o: Ocorrencia) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute("UPDATE ocorrencias SET aluno_id=?1, data=?2, descricao=?3, tipo=?4 WHERE id=?5", params![o.aluno_id, o.data, o.descricao, o.tipo, o.id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_ip_local() -> Result<String, String> {
    servidor_rede::get_ip_local()
}

#[tauri::command]
fn listar_ips_locais() -> Result<Vec<String>, String> {
    Ok(servidor_rede::listar_ips_locais())
}

#[tauri::command]
fn rede_local_get(app: tauri::AppHandle) -> Result<servidor_rede::RedeLocalConfig, String> {
    Ok(servidor_rede::config(&app))
}

#[tauri::command]
fn rede_local_set(app: tauri::AppHandle, config: servidor_rede::RedeLocalConfig) -> Result<(), String> {
    servidor_rede::set_config(&app, &config)?;
    servidor_rede::reiniciar(&app)
}

#[tauri::command]
fn verificar_primeiro_acesso(app: tauri::AppHandle) -> Result<bool, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    Ok(count == 0)
}

#[tauri::command]
fn criar_usuario_inicial(
    app: tauri::AppHandle,
    username: String,
    password: String,
    nome_completo: String
) -> Result<i64, String> {
    let _ = nome_completo;
    if !verificar_primeiro_acesso(app.clone())? {
        return Err("Já existem usuários no sistema".to_string());
    }
    if password.len() < 8 {
        return Err("Senha deve ter pelo menos 8 caracteres".to_string());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err("Senha deve conter pelo menos uma letra maiúscula".to_string());
    }
    if !password.chars().any(|c| c.is_numeric()) {
        return Err("Senha deve conter pelo menos um número".to_string());
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (username, password_hard, role) VALUES (?1, ?2, 'admin')",
        rusqlite::params![username, password_hash]
    ).map_err(|e| format!("Erro ao criar usuário: {}", e))?;
    let user_id = conn.last_insert_rowid();
    log::info!(target: "auth", "[SETUP] Usuário inicial criado: {}", username);
    Ok(user_id)
}

#[cfg(test)]
mod password_tests {
    use bcrypt::{verify, hash, DEFAULT_COST};

fn known_password() -> String {
        std::env::var("SENHA_PADRAO").unwrap_or_else(|_| "TestPassword123!".to_string())
    }

    #[test]
    fn test_bcrypt_hash_password() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        assert!(!hashed.is_empty(), "Hashed password should not be empty");
        assert!(hashed.starts_with("$2"), "Bcrypt hash should start with $2");
    }

    #[test]
    fn test_bcrypt_verify_correct_password() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let result = verify(&pwd, &hashed).expect("Verify should not fail");
        assert!(result, "Correct password should verify successfully");
    }

    #[test]
    fn test_bcrypt_verify_incorrect_password() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let wrong_password = "wrong_password";
        let result = verify(wrong_password, &hashed).expect("Verify should not fail");
        assert!(!result, "Incorrect password should not verify");
    }

    #[test]
    fn test_bcrypt_different_passwords_different_hashes() {
        let pwd = known_password();
        let hash1 = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let hash2 = hash("different_password", DEFAULT_COST).expect("Failed to hash password");
        assert_ne!(hash1, hash2, "Different passwords should produce different hashes");
    }

    #[test]
    fn test_password_case_sensitive() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let uppercase = pwd.to_uppercase();
        let result = verify(&uppercase, &hashed).expect("Verify should not fail");
        assert!(!result, "Password verification should be case-sensitive");
    }

    #[test]
    fn test_password_special_characters() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let result = verify(&pwd, &hashed).expect("Verify should not fail");
        assert!(result, "Password should verify successfully");
    }

    #[test]
    fn test_password_whitespace_sensitive() {
        let pwd = known_password();
        let hashed = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let with_spaces = format!(" {} ", pwd);
        let result = verify(&with_spaces, &hashed).expect("Verify should not fail");
        assert!(!result, "Password with extra whitespace should not verify");
    }

    #[test]
    fn test_bcrypt_salt_randomness() {
        let pwd = known_password();
        let hash1 = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        let hash2 = hash(&pwd, DEFAULT_COST).expect("Failed to hash password");
        
        assert_ne!(hash1, hash2, "Two hashes of same password should differ due to salt");
        assert!(verify(&pwd, &hash1).expect("Verify should not fail"));
        assert!(verify(&pwd, &hash2).expect("Verify should not fail"));
    }
}

#[cfg(test)]
mod password_update_tests {
    use super::*;

fn known_password() -> String {
        std::env::var("SENHA_PADRAO").unwrap_or_else(|_| "TestPassword123!".to_string())
    }

    #[test]
    fn test_password_update_logic() {
        let nova_senha = "NewTestPassword123!";
        let hashed = bcrypt::hash(nova_senha, DEFAULT_COST).expect("Failed to hash password");
        
        assert!(!hashed.is_empty(), "Hashed password should not be empty");
        assert!(hashed.starts_with("$2"), "Should be valid bcrypt hash");
        assert!(bcrypt::verify(nova_senha, &hashed).unwrap(), "New password should verify");
    }

    #[test]
    fn test_password_update_from_default() {
        let pwd = known_password();
        let default_hash = bcrypt::hash(&pwd, DEFAULT_COST).expect("Failed to hash");
        let new_password = "NovaPassword2026!";
        let new_hash = bcrypt::hash(new_password, DEFAULT_COST).expect("Failed to hash");

        assert!(bcrypt::verify(&pwd, &default_hash).unwrap());
        assert!(bcrypt::verify(new_password, &new_hash).unwrap());
        assert!(!bcrypt::verify(&pwd, &new_hash).unwrap());
        assert!(!bcrypt::verify(new_password, &default_hash).unwrap());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrations::apply_migrations(&conn).unwrap();
        conn.execute(
            "UPDATE creche SET nome = 'Teste', endereco = 'Rua X', cidade = 'Cidade', estado = 'SC', valor_padrao_mensalidade = 500.0, dia_vencimento = 5, taxa_matricula = 50.0 WHERE id = 1",
            [],
        ).unwrap();
        conn
    }

    fn criar_aluno_teste(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO alunos (nome, data_nascimento, nome_responsavel, telefone_responsavel, status) VALUES ('Aluno Teste', '2020-01-01', 'Responsavel', '11999999999', 'ativo')",
            [],
        ).unwrap();
        conn.last_insert_rowid()
    }

    fn vincular_servico_teste(conn: &Connection, aluno_id: i64) {
        conn.execute(
            "INSERT INTO servicos (nome, valor_padrao) VALUES ('Ballet', 100.0)",
            [],
        ).unwrap();
        let servico_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO aluno_servicos (aluno_id, servico_id, valor_acordado, data_inicio) VALUES (?1, ?2, 100.0, '2026-01-01')",
            params![aluno_id, servico_id],
        ).unwrap();
    }

    #[test]
    fn test_calcular_valor_mensalidade_override_vence_padrao() {
        let conn = setup_db();
        let aluno_id = criar_aluno_teste(&conn);
        conn.execute(
            "UPDATE alunos SET valor_mensalidade_override = 700.0 WHERE id = ?1",
            params![aluno_id],
        ).unwrap();
        let valor = calcular_valor_mensalidade(&conn, aluno_id).unwrap();
        assert_eq!(valor, 700.0, "Override deve vencer o valor padrão");
    }

    #[test]
    fn test_calcular_valor_mensalidade_soma_servicos() {
        let conn = setup_db();
        let aluno_id = criar_aluno_teste(&conn);
        vincular_servico_teste(&conn, aluno_id);
        let valor = calcular_valor_mensalidade(&conn, aluno_id).unwrap();
        assert_eq!(valor, 600.0, "Padrão (500) + serviço (100)");
    }

    #[test]
    fn test_construir_vencimento_clamp_dia() {
        assert_eq!(construir_vencimento("2026-01", 15).unwrap(), "2026-01-15");
        assert_eq!(construir_vencimento("2026-02", 31).unwrap(), "2026-02-28");
        assert_eq!(construir_vencimento("2024-02", 30).unwrap(), "2024-02-29");
        assert_eq!(construir_vencimento("2026-04", 31).unwrap(), "2026-04-30");
        assert_eq!(construir_vencimento("2026-03", 1).unwrap(), "2026-03-01");
    }

    #[test]
    fn test_recalcular_mensalidades_pendentes_atualiza_so_nao_pagas() {
        let conn = setup_db();
        let aluno_id = criar_aluno_teste(&conn);
        vincular_servico_teste(&conn, aluno_id);
        conn.execute(
            "INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, taxa_matricula) VALUES (?1, '2026-08-05', 600.0, 0, 50.0)",
            params![aluno_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, taxa_matricula) VALUES (?1, '2026-07-05', 600.0, 1, 50.0)",
            params![aluno_id],
        ).unwrap();
        recalcular_mensalidades_pendentes(&conn, aluno_id).unwrap();
        let pendente: f64 = conn.query_row(
            "SELECT valor FROM mensalidades WHERE aluno_id = ?1 AND pago = 0",
            params![aluno_id],
            |r| r.get(0),
        ).unwrap();
        let paga: f64 = conn.query_row(
            "SELECT valor FROM mensalidades WHERE aluno_id = ?1 AND pago = 1",
            params![aluno_id],
            |r| r.get(0),
        ).unwrap();
assert_eq!(pendente, 500.0 + 100.0 + 50.0, "Não paga recalculada (padrão + serviço + taxa)");
        assert_eq!(paga, 600.0, "Paga permanece intacta");
    }
}

#[tauri::command]
fn save_file_dialog(folder_path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    
    #[cfg(not(windows))]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn resetar_banco(app: tauri::AppHandle) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "DELETE FROM alunos; DELETE FROM turmas; DELETE FROM responsaveis; DELETE FROM crianca_responsaveis; DELETE FROM matriculas; DELETE FROM mensalidades; DELETE FROM frequencias; DELETE FROM frequencia_registros; DELETE FROM ocorrencias; DELETE FROM configuracoes; DELETE FROM creche; DELETE FROM users;"
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resetar_dados_teste(app: tauri::AppHandle, chave_seguranca: String) -> Result<String, String> {
    if chave_seguranca != "RESETAR_DADOS" {
        return Err("Chave de segurança inválida. Use 'RESETAR_DADOS'.".to_string());
    }

    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let tabelas_para_limpar = vec![
        "alunos", "turmas", "responsaveis", "crianca_responsaveis", "matriculas",
        "mensalidades", "frequencias", "frequencia_registros", "ocorrencias",
        "aluno_servicos", "company_expenses", "company_revenues", "gastos_fixos",
        "servicos", "cargos", "funcionarios", "funcionario_turmas", "escala_trabalho",
        "login_attempts", "user_sessions", "users"
    ];

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    for tabela in tabelas_para_limpar {
        let _ = tx.execute(&format!("DELETE FROM {}", tabela), params![]);
    }

    let _ = tx.execute("DELETE FROM sqlite_sequence", params![]);

    let senha_padrao_valor = senha_padrao();
    let password_hash = bcrypt::hash(&senha_padrao_valor, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Erro ao gerar hash: {}", e))?;
    
    tx.execute(
        "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![password_hash],
    ).map_err(|e| format!("Erro ao recriar admin: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;

    log::info!(target: "auth", "[RESET_TEST] Dados de teste resetados, admin recriado");
    Ok("Banco de dados resetado para testes com sucesso. Admin recriado: username=admin, use a senha padrão.".to_string())
}

#[tauri::command]
fn reset_admin_password(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM users WHERE username = 'admin'", [])
        .map_err(|e| e.to_string())?;
    
    let hashed = bcrypt::hash(senha_padrao(), 12).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![hashed],
    )
    .map_err(|e| e.to_string())?;
    
    log::warn!(target: "auth", "[SECURITY] Reset de senha do admin executado");
    Ok("Admin user reset successfully. Use a nova senha definida em SENHA_PADRAO.".to_string())
}

#[tauri::command]
fn reset_all_data_and_init(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    conn.execute_batch(
        "DELETE FROM alunos; DELETE FROM turmas; DELETE FROM responsaveis; DELETE FROM crianca_responsaveis; DELETE FROM matriculas; DELETE FROM mensalidades; DELETE FROM frequencias; DELETE FROM frequencia_registros; DELETE FROM ocorrencias; DELETE FROM configuracoes; DELETE FROM creche; DELETE FROM users;"
    ).map_err(|e| e.to_string())?;
    
    let hashed = bcrypt::hash(senha_padrao(), 12).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![hashed],
    )
    .map_err(|e| e.to_string())?;
    
    log::warn!(target: "auth", "[SECURITY] Reset completo do sistema executado");
    Ok("Sistema limpo com sucesso! A conta admin foi recriada — use a senha padrão para entrar.".to_string())
}

#[tauri::command]
fn criar_admin_emergencia(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    let exists_admin: bool = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'",
        [],
        |row| row.get::<_, i64>(0)
    ).map(|count| count > 0).unwrap_or(false);
    
    if exists_admin {
        return Ok("Já existe um usuário admin no sistema.".to_string());
    }
    
    let password_hash = bcrypt::hash(&senha_padrao(), bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Erro ao gerar hash de senha: {}", e))?;
    
    conn.execute(
        "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![password_hash],
    )
    .map_err(|e| format!("Erro ao criar usuário admin: {}", e))?;
    
    log::warn!(target: "auth", "[EMERGENCY] Admin user criado em modo de emergência");
    Ok("Usuário admin criado com sucesso! Use a senha padrão do sistema para entrar.".to_string())
}

#[tauri::command]
fn diagnosticar_e_corrigir_login(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    let admin_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE username = 'admin' AND role = 'admin'",
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    if admin_count > 0 {
        return Ok(serde_json::json!({
            "status": "admin_exists",
            "message": "Usuário admin já existe no sistema.",
            "action": "none"
        }));
    }
    
    let senha_padrao_valor = senha_padrao();
    let password_hash = bcrypt::hash(&senha_padrao_valor, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Erro ao gerar hash de senha: {}", e))?;
    
    conn.execute(
        "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
        params![password_hash],
    )
    .map_err(|e| format!("Erro ao criar usuário admin: {}", e))?;
    
    log::warn!(target: "auth", "[EMERGENCY] Admin user criado pela função diagnosticar_e_corrigir_login");
    
    Ok(serde_json::json!({
        "status": "admin_created",
        "message": "Usuário admin criado com sucesso! Use a senha padrão do sistema para entrar.",
        "action": "created",
        "username": "admin"
    }))
}

#[tauri::command]
fn resetar_senha_admin(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    let senha_padrao_valor = senha_padrao();
    
    let password_hash = bcrypt::hash(&senha_padrao_valor, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("Erro ao gerar hash de senha: {}", e))?;
    
    let rows_affected = conn.execute(
        "UPDATE users SET password_hard = ?1 WHERE username = 'admin' AND role = 'admin'",
        params![password_hash],
    ).map_err(|e| format!("Erro ao atualizar senha do admin: {}", e))?;
    
    if rows_affected == 0 {
        return Err("Usuário admin não encontrado no banco de dados.".to_string());
    }
    
    log::warn!(target: "auth", "[SECURITY] Senha do admin resetada para valor padrão");
    Ok("✓ Senha do admin resetada com sucesso! Use a senha padrão do sistema para entrar.".to_string())
}

#[tauri::command]
fn garantir_admin_login(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let senha = senha_padrao();
    let hash = bcrypt::hash(senha, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

    let admin_existe: bool = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE username = 'admin' AND role = 'admin'",
        [],
        |row| row.get::<_, i64>(0)
    ).map(|count| count > 0).unwrap_or(false);

    if admin_existe {
        conn.execute(
            "UPDATE users SET password_hard = ?1 WHERE username = 'admin' AND role = 'admin'",
            params![hash]
        ).map_err(|e| e.to_string())?;
        Ok("Senha do admin restaurada para a padrão do sistema.".to_string())
    } else {
        conn.execute(
            "INSERT INTO users (username, password_hard, role) VALUES ('admin', ?1, 'admin')",
            params![hash]
        ).map_err(|e| e.to_string())?;
        Ok("Conta admin recriada com a senha padrão do sistema.".to_string())
    }
}

#[tauri::command]
fn criar_dados_teste(app: tauri::AppHandle) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO turmas (nome, ano, turno, vagas, status) VALUES ('Turma Teste', 2026, 'Manhã', 20, 'ativo')",
        [],
    ).map_err(|e| e.to_string())?;
    let turma_id = conn.last_insert_rowid();
    
    conn.execute(
        "INSERT INTO alunos (nome, data_nascimento, nome_responsavel, telefone_responsavel, status, turma_id) VALUES ('João Silva Teste', '2020-05-15', 'Maria Silva', '11999999999', 'ativo', ?1)",
        params![turma_id],
    ).map_err(|e| e.to_string())?;
    let aluno_id = conn.last_insert_rowid();
    
    let hoje = Local::now().format("%Y-%m-%d").to_string();
    let registros_json = format!(r#"[{{"alunoId": {}, "presente": true}}]"#, aluno_id);
    conn.execute(
        "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (?1, ?2, ?3)",
        params![turma_id, &hoje, &registros_json],
    ).map_err(|e| e.to_string())?;
    
    let ontem = (Local::now() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let registros_json = format!(r#"[{{"alunoId": {}, "presente": false}}]"#, aluno_id);
    conn.execute(
        "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (?1, ?2, ?3)",
        params![turma_id, &ontem, &registros_json],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento) VALUES (?1, ?2, ?3, ?4, NULL, NULL)",
        params![aluno_id, hoje, 500.00, 0],
    ).map_err(|e| e.to_string())?;
    
    let mes_passado = (Local::now() - chrono::Duration::days(30)).format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO mensalidades (aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento) VALUES (?1, ?2, ?3, ?4, ?5, 'pix')",
        params![aluno_id, mes_passado, 500.00, 1, &mes_passado],
    ).map_err(|e| e.to_string())?;
    
    Ok(format!(
        "✅ Dados de teste criados com sucesso!\n\
         - Turma ID: {}\n\
         - Aluno ID: {} (João Silva Teste)\n\
         - Frequências: Hoje (Presente) e Ontem (Ausente)\n\
         - Mensalidades: 1 Paga + 1 Pendente",
        turma_id, aluno_id
    ))
}

#[tauri::command]
fn get_ultima_frequencia_alunos_periodo(
    app: tauri::AppHandle,
    data_inicio: String,
    data_fim: String,
) -> Result<Vec<UltimaFrequencia>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, turma_id, data, registros FROM frequencia_registros 
         WHERE data >= ?1 AND data <= ?2 AND deleted_at IS NULL
         ORDER BY data DESC"
    ).map_err(|e| e.to_string())?;

    let mut ultimas_frequencias: std::collections::HashMap<i64, UltimaFrequencia> = std::collections::HashMap::new();

    let rows = stmt.query_map([&data_inicio, &data_fim], |r| {
        Ok((
            r.get::<_, String>(2)?,  // data
            r.get::<_, String>(3)?,  // registros JSON
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let (data, registros_json) = row.map_err(|e| e.to_string())?;

        if let Ok(registros) = serde_json::from_str::<Vec<serde_json::Value>>(&registros_json) {
            for reg in registros {
                if let (Some(aluno_id), Some(presente)) = (
                    reg.get("alunoId").and_then(|v| v.as_i64()),
                    reg.get("presente").and_then(|v| v.as_bool()),
                ) {
                    ultimas_frequencias.entry(aluno_id).or_insert(UltimaFrequencia {
                        aluno_id,
                        data: data.clone(),
                        presente,
                    });
                }
            }
        }
    }

    let mut result: Vec<UltimaFrequencia> = ultimas_frequencias.into_values().collect();
    result.sort_by(|a, b| a.aluno_id.cmp(&b.aluno_id));
    Ok(result)
}

#[tauri::command]
fn get_mensalidades_periodo(
    app: tauri::AppHandle,
    data_inicio: String,
    data_fim: String,
) -> Result<Vec<Mensalidade>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, aluno_id, vencimento, valor, pago, data_pagamento, forma_pagamento, COALESCE(taxa_matricula, 0)
         FROM mensalidades 
         WHERE vencimento >= ?1 AND vencimento <= ?2 AND deleted_at IS NULL
         ORDER BY vencimento DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&data_inicio, &data_fim], |r| {
        Ok(Mensalidade {
            id: r.get(0)?,
            aluno_id: r.get(1)?,
            vencimento: r.get(2)?,
            valor: r.get(3)?,
            pago: r.get(4)?,
            data_pagamento: r.get(5)?,
            forma_pagamento: r.get(6)?,
            taxa_matricula: r.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn get_frequencia_registros_periodo(
    app: tauri::AppHandle,
    data_inicio: String,
    data_fim: String,
) -> Result<Vec<FrequenciaRegistro>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, turma_id, data, registros 
         FROM frequencia_registros 
         WHERE data >= ?1 AND data <= ?2 AND deleted_at IS NULL
         ORDER BY data DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&data_inicio, &data_fim], |r| {
        Ok(FrequenciaRegistro {
            id: r.get(0)?,
            turma_id: r.get(1)?,
            data: r.get(2)?,
            registros: r.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn delete_aluno(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    log::warn!(target: "alunos", "[DELETE] Soft delete de aluno: id={}", id);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let old_data: Option<(String, String)> = conn.query_row(
        "SELECT nome, status FROM alunos WHERE id=?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).optional().map_err(|e| e.to_string())?;
    let old_values = old_data.map(|(n, s)| serde_json::json!({"nome": n, "status": s}).to_string());
    
    conn.execute(
        "UPDATE alunos SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE frequencias SET deleted_at=?1 WHERE aluno_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE mensalidades SET deleted_at=?1 WHERE aluno_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE ocorrencias SET deleted_at=?1 WHERE aluno_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    let description = format!("Aluno deletado (soft delete): ID {}", id);
    log_audit(&app, None, None, "DELETE", Some("alunos"), Some(id), old_values, None, &description);

    cache::GLOBAL_CACHE.invalidate_pattern("alunos:");
    log::debug!(target: "cache", "[INVALIDATE] alunos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_turma(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE turmas SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE alunos SET deleted_at=?1 WHERE turma_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE frequencia_registros SET deleted_at=?1 WHERE turma_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;

    cache::GLOBAL_CACHE.invalidate_pattern("turmas:");
    cache::GLOBAL_CACHE.invalidate_pattern("alunos:");
    log::debug!(target: "cache", "[INVALIDATE] turmas:*, alunos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_mensalidade(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE mensalidades SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_frequencia(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE frequencias SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_ocorrencia(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE ocorrencias SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn listar_cargos(app: tauri::AppHandle) -> Result<Vec<Cargo>, String> {
    let cache_key = "cargos:list:all";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(cargos) = serde_json::from_str::<Vec<Cargo>>(&cached) {
            log::debug!(target: "cache", "[HIT] {}", cache_key);
            return Ok(cargos);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nome, descricao, salario_base, status FROM cargos WHERE deleted_at IS NULL ORDER BY nome"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(Cargo {
            id: r.get(0)?,
            nome: r.get(1)?,
            descricao: r.get(2)?,
            salario_base: r.get(3)?,
            status: r.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    if let Ok(json) = serde_json::to_string(&out) {
        cache::GLOBAL_CACHE.set(cache_key.to_string(), json, None);
        log::debug!(target: "cache", "[SET] {}", cache_key);
    }
    Ok(out)
}

#[tauri::command]
fn criar_cargo(app: tauri::AppHandle, cargo: Cargo) -> Result<i64, String> {
    validar_nome(&cargo.nome, "Nome do cargo")?;
    if let Some(ref salario_base) = cargo.salario_base {
        validar_valor_positivo(*salario_base, "Salário base")?;
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO cargos (nome, descricao, salario_base, status) VALUES (?1, ?2, ?3, ?4)",
        params![cargo.nome, cargo.descricao, cargo.salario_base, cargo.status.as_deref().unwrap_or("ativo")],
    ).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    cache::GLOBAL_CACHE.invalidate_pattern("cargos:");
    log::debug!(target: "cache", "[INVALIDATE] cargos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(id)
}

#[tauri::command]
fn get_cargo_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Cargo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, descricao, salario_base, status FROM cargos WHERE id=?1",
        params![id],
        |r| Ok(Cargo {
            id: r.get(0)?,
            nome: r.get(1)?,
            descricao: r.get(2)?,
            salario_base: r.get(3)?,
            status: r.get(4)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_cargo(app: tauri::AppHandle, cargo: Cargo) -> Result<(), String> {
    validar_nome(&cargo.nome, "Nome do cargo")?;
    if let Some(ref salario_base) = cargo.salario_base {
        validar_valor_positivo(*salario_base, "Salário base")?;
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE cargos SET nome=?1, descricao=?2, salario_base=?3, status=?4 WHERE id=?5",
        params![cargo.nome, cargo.descricao, cargo.salario_base, cargo.status, cargo.id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("cargos:");
    log::debug!(target: "cache", "[INVALIDATE] cargos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_cargo(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE cargos SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("cargos:");
    log::debug!(target: "cache", "[INVALIDATE] cargos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn listar_funcionarios(app: tauri::AppHandle) -> Result<Vec<FuncionarioComCargo>, String> {
    let cache_key = "funcionarios:list:all";
    if let Some(cached) = cache::GLOBAL_CACHE.get(cache_key) {
        if let Ok(funcs) = serde_json::from_str::<Vec<FuncionarioComCargo>>(&cached) {
            log::debug!(target: "cache", "[HIT] {}", cache_key);
            return Ok(funcs);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT f.id, f.nome_completo, f.nome_social, f.cpf, f.telefone, f.email, f.salario, f.cargo_id, c.nome, f.escala_trabalho_id, e.nome, f.status 
         FROM funcionarios f 
         JOIN cargos c ON f.cargo_id = c.id 
         LEFT JOIN escala_trabalho e ON e.id = f.escala_trabalho_id
         WHERE f.deleted_at IS NULL AND c.deleted_at IS NULL 
         ORDER BY f.nome_completo"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(FuncionarioComCargo {
            id: r.get(0)?,
            nome_completo: r.get(1)?,
            nome_social: r.get(2)?,
            cpf: r.get(3)?,
            telefone: r.get(4)?,
            email: r.get(5)?,
            salario: r.get(6)?,
            cargo_id: r.get(7)?,
            cargo_nome: r.get(8)?,
            escala_trabalho_id: r.get(9)?,
            escala_nome: r.get(10)?,
            status: r.get(11)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    if let Ok(json) = serde_json::to_string(&out) {
        cache::GLOBAL_CACHE.set(cache_key.to_string(), json, None);
        log::debug!(target: "cache", "[SET] {}", cache_key);
    }
    Ok(out)
}

#[tauri::command]
fn criar_funcionario(app: tauri::AppHandle, mut func: Funcionario) -> Result<i64, String> {
    log::info!(target: "funcionarios", "[CRIAR] Criando funcionario: nome={}", func.nome_completo);
    validar_nome_completo(&func.nome_completo, "Nome do funcionário")?;
    validar_email(&func.email)?;
    validar_telefone(&func.telefone)?;
    validar_valor_positivo(func.salario, "Salário")?;
    if let Some(ref cpf) = func.cpf { validar_cpf(cpf)?; }
    func.cpf = func.cpf.map(|c| c.chars().filter(|c| c.is_ascii_digit()).collect());
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO funcionarios (nome_completo, nome_social, cpf, telefone, telefone_secundario, email, salario, cargo_id, escala_trabalho_id, contato_emergencia, telefone_emergencia, status) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![func.nome_completo, func.nome_social, func.cpf, func.telefone, func.telefone_secundario, func.email, func.salario, func.cargo_id, func.escala_trabalho_id, func.contato_emergencia, func.telefone_emergencia, func.status.as_deref().unwrap_or("ativo")],
    ).map_err(|e| {
        log::error!(target: "funcionarios", "[CRIAR] Erro SQL: {}", e);
        e.to_string()
    })?;
    let id = conn.last_insert_rowid();
    log::info!(target: "funcionarios", "[CRIAR] Funcionario criado: id={}, nome={}", id, func.nome_completo);
    cache::GLOBAL_CACHE.invalidate_pattern("funcionarios:");
    log::debug!(target: "cache", "[INVALIDATE] funcionarios:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(id)
}

#[tauri::command]
fn get_funcionario_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Funcionario>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome_completo, nome_social, cpf, telefone, telefone_secundario, email, salario, cargo_id, escala_trabalho_id, contato_emergencia, telefone_emergencia, status 
         FROM funcionarios WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(Funcionario {
            id: r.get(0)?,
            nome_completo: r.get(1)?,
            nome_social: r.get(2)?,
            cpf: r.get(3)?,
            telefone: r.get(4)?,
            telefone_secundario: r.get(5)?,
            email: r.get(6)?,
            salario: r.get(7)?,
            cargo_id: r.get(8)?,
            escala_trabalho_id: r.get(9)?,
            contato_emergencia: r.get(10)?,
            telefone_emergencia: r.get(11)?,
            status: r.get(12)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_funcionario(app: tauri::AppHandle, mut func: Funcionario) -> Result<(), String> {
    log::info!(target: "funcionarios", "[UPDATE] Atualizando funcionario: id={:?}, nome={}", func.id, func.nome_completo);
    validar_nome_completo(&func.nome_completo, "Nome do funcionário")?;
    validar_email(&func.email)?;
    validar_telefone(&func.telefone)?;
    validar_valor_positivo(func.salario, "Salário")?;
    if let Some(ref cpf) = func.cpf { validar_cpf(cpf)?; }
    func.cpf = func.cpf.map(|c| c.chars().filter(|c| c.is_ascii_digit()).collect());
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE funcionarios SET nome_completo=?1, nome_social=?2, cpf=?3, telefone=?4, telefone_secundario=?5, email=?6, salario=?7, cargo_id=?8, escala_trabalho_id=?9, contato_emergencia=?10, telefone_emergencia=?11, status=?12, data_atualizacao=?13 WHERE id=?14",
        params![func.nome_completo, func.nome_social, func.cpf, func.telefone, func.telefone_secundario, func.email, func.salario, func.cargo_id, func.escala_trabalho_id, func.contato_emergencia, func.telefone_emergencia, func.status, &now, func.id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("funcionarios:");
    log::debug!(target: "cache", "[INVALIDATE] funcionarios:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_funcionario(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    log::warn!(target: "funcionarios", "[DELETE] Soft delete funcionario: id={}", id);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "UPDATE funcionarios SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "DELETE FROM funcionario_turmas WHERE funcionario_id=?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE frequencia_funcionarios SET deleted_at=?1 WHERE funcionario_id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;

    cache::GLOBAL_CACHE.invalidate_pattern("funcionarios:");
    log::debug!(target: "cache", "[INVALIDATE] funcionarios:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn get_funcionarios_by_turma(app: tauri::AppHandle, turma_id: i64) -> Result<Vec<FuncionarioComCargo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT f.id, f.nome_completo, f.nome_social, f.cpf, f.telefone, f.email, f.salario, f.cargo_id, c.nome, f.escala_trabalho_id, e.nome, f.status 
         FROM funcionarios f 
         JOIN cargos c ON f.cargo_id = c.id 
         JOIN funcionario_turmas ft ON f.id = ft.funcionario_id 
         LEFT JOIN escala_trabalho e ON e.id = f.escala_trabalho_id
         WHERE ft.turma_id = ?1 AND f.deleted_at IS NULL AND c.deleted_at IS NULL 
         ORDER BY f.nome_completo"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![turma_id], |r| {
        Ok(FuncionarioComCargo {
            id: r.get(0)?,
            nome_completo: r.get(1)?,
            nome_social: r.get(2)?,
            cpf: r.get(3)?,
            telefone: r.get(4)?,
            email: r.get(5)?,
            salario: r.get(6)?,
            cargo_id: r.get(7)?,
            cargo_nome: r.get(8)?,
            escala_trabalho_id: r.get(9)?,
            escala_nome: r.get(10)?,
            status: r.get(11)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn adicionar_funcionario_turma(app: tauri::AppHandle, funcionario_id: i64, turma_id: i64, data_inicio: Option<String>) -> Result<i64, String> {
    let data_inicio = data_inicio.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO funcionario_turmas (funcionario_id, turma_id, data_inicio) VALUES (?1, ?2, ?3)",
        params![funcionario_id, turma_id, data_inicio],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn remover_funcionario_turma(app: tauri::AppHandle, funcionario_id: i64, turma_id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM funcionario_turmas WHERE funcionario_id=?1 AND turma_id=?2",
        params![funcionario_id, turma_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_funcionario_turmas(app: tauri::AppHandle, funcionario_id: i64) -> Result<Vec<FuncionarioTurma>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT ft.turma_id, t.nome FROM funcionario_turmas ft JOIN turmas t ON ft.turma_id = t.id WHERE ft.funcionario_id = ?1 AND t.deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![funcionario_id], |r| {
        Ok(FuncionarioTurma {
            turma_id: r.get(0)?,
            turma_nome: r.get(1)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}


#[tauri::command]
fn listar_frequencia_funcionarios(app: tauri::AppHandle) -> Result<Vec<FrequenciaFuncionario>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, funcionario_id, data, status, justificativa, tipo_justificativa FROM frequencia_funcionarios WHERE deleted_at IS NULL ORDER BY data DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(FrequenciaFuncionario {
            id: r.get(0)?,
            funcionario_id: r.get(1)?,
            data: r.get(2)?,
            status: r.get(3)?,
            justificativa: r.get(4)?,
            tipo_justificativa: r.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn criar_frequencia_funcionario(app: tauri::AppHandle, f: FrequenciaFuncionario) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO frequencia_funcionarios (funcionario_id, data, status, justificativa, tipo_justificativa) VALUES (?1,?2,?3,?4,?5)",
        params![f.funcionario_id, f.data, f.status, f.justificativa, f.tipo_justificativa],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_frequencia_funcionario_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<FrequenciaFuncionario>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, funcionario_id, data, status, justificativa, tipo_justificativa FROM frequencia_funcionarios WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(FrequenciaFuncionario {
            id: r.get(0)?,
            funcionario_id: r.get(1)?,
            data: r.get(2)?,
            status: r.get(3)?,
            justificativa: r.get(4)?,
            tipo_justificativa: r.get(5)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_frequencia_funcionario(app: tauri::AppHandle, f: FrequenciaFuncionario) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE frequencia_funcionarios SET funcionario_id=?1, data=?2, status=?3, justificativa=?4, tipo_justificativa=?5 WHERE id=?6",
        params![f.funcionario_id, f.data, f.status, f.justificativa, f.tipo_justificativa, f.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_frequencia_funcionario(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE frequencia_funcionarios SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn listar_frequencia_funcionarios_por_data(app: tauri::AppHandle, data: String) -> Result<Vec<FrequenciaFuncionario>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, funcionario_id, data, status, justificativa, tipo_justificativa FROM frequencia_funcionarios WHERE data=?1 AND deleted_at IS NULL ORDER BY funcionario_id"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&data], |r| {
        Ok(FrequenciaFuncionario {
            id: r.get(0)?,
            funcionario_id: r.get(1)?,
            data: r.get(2)?,
            status: r.get(3)?,
            justificativa: r.get(4)?,
            tipo_justificativa: r.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn salvar_frequencia_funcionario(app: tauri::AppHandle, f: FrequenciaFuncionario) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let existing: Option<i64> = conn.query_row(
        "SELECT id FROM frequencia_funcionarios WHERE funcionario_id=?1 AND data=?2 AND deleted_at IS NULL",
        params![f.funcionario_id, f.data],
        |r| r.get(0),
    ).optional().map_err(|e| e.to_string())?;

    if let Some(id) = existing {
        conn.execute(
            "UPDATE frequencia_funcionarios SET status=?1, justificativa=?2, tipo_justificativa=?3 WHERE id=?4",
            params![f.status, f.justificativa, f.tipo_justificativa, id],
        ).map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO frequencia_funcionarios (funcionario_id, data, status, justificativa, tipo_justificativa) VALUES (?1,?2,?3,?4,?5)",
            params![f.funcionario_id, f.data, f.status, f.justificativa, f.tipo_justificativa],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}


#[tauri::command]
fn listar_gastos_fixos(app: tauri::AppHandle) -> Result<Vec<GastoFixo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nome, valor_padrao, valor_atual, mes, descricao, status, editavel 
         FROM gastos_fixos WHERE deleted_at IS NULL ORDER BY mes DESC, nome ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(GastoFixo {
            id: r.get(0)?,
            nome: r.get(1)?,
            valor_padrao: r.get(2)?,
            valor_atual: r.get(3)?,
            mes: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
            editavel: r.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn criar_gasto_fixo(app: tauri::AppHandle, gasto: GastoFixo) -> Result<i64, String> {
    validar_nome(&gasto.nome, "Nome do gasto")?;
    validar_valor_positivo(gasto.valor_padrao, "Valor padrão")?;
    validar_valor_positivo(gasto.valor_atual, "Valor atual")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mes = &gasto.mes;
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM gastos_fixos WHERE nome=?1 AND mes=?2 AND deleted_at IS NULL)",
        params![&gasto.nome, mes],
        |r| r.get(0),
    ).unwrap_or(false);
    if exists {
        return Err("Já existe gasto fixo com este nome no mês informado".to_string());
    }
    if gasto.valor_padrao <= 0.0 || gasto.valor_atual <= 0.0 {
        return Err("Valores devem ser positivos".to_string());
    }
    conn.execute(
        "INSERT INTO gastos_fixos (nome, valor_padrao, valor_atual, mes, descricao, status, editavel) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![gasto.nome, gasto.valor_padrao, gasto.valor_atual, gasto.mes, gasto.descricao, 
                gasto.status.as_deref().unwrap_or("ativo"), gasto.editavel.unwrap_or(true)],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_gasto_fixo_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<GastoFixo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, valor_padrao, valor_atual, mes, descricao, status, editavel 
         FROM gastos_fixos WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(GastoFixo {
            id: r.get(0)?,
            nome: r.get(1)?,
            valor_padrao: r.get(2)?,
            valor_atual: r.get(3)?,
            mes: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
            editavel: r.get(7)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn get_gasto_fixo_by_nome_mes(app: tauri::AppHandle, nome: String, mes: String) -> Result<Option<GastoFixo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, valor_padrao, valor_atual, mes, descricao, status, editavel
         FROM gastos_fixos WHERE nome=?1 AND mes=?2 AND deleted_at IS NULL",
        params![nome, mes],
        |r| Ok(GastoFixo {
            id: r.get(0)?,
            nome: r.get(1)?,
            valor_padrao: r.get(2)?,
            valor_atual: r.get(3)?,
            mes: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
            editavel: r.get(7)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_gasto_fixo(app: tauri::AppHandle, gasto: GastoFixo) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let editavel: bool = conn.query_row(
        "SELECT editavel FROM gastos_fixos WHERE id=?1",
        params![gasto.id],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;
    if !editavel {
        return Err("Este gasto fixo não é editável".to_string());
    }
    if gasto.valor_atual <= 0.0 {
        return Err("Valor deve ser positivo".to_string());
    }
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE gastos_fixos SET nome=?1, valor_padrao=?2, valor_atual=?3, mes=?4, descricao=?5, status=?6, updated_at=?7 WHERE id=?8",
        params![gasto.nome, gasto.valor_padrao, gasto.valor_atual, gasto.mes, gasto.descricao, gasto.status, &now, gasto.id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_gasto_fixo(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE gastos_fixos SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn get_gastos_fixos_mes(app: tauri::AppHandle, mes: String) -> Result<Vec<GastoFixo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nome, valor_padrao, valor_atual, mes, descricao, status, editavel 
         FROM gastos_fixos WHERE mes=?1 AND deleted_at IS NULL ORDER BY nome ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&mes], |r| {
        Ok(GastoFixo {
            id: r.get(0)?,
            nome: r.get(1)?,
            valor_padrao: r.get(2)?,
            valor_atual: r.get(3)?,
            mes: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
            editavel: r.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn recalcular_gastos_fixos(app: tauri::AppHandle, mes: String) -> Result<f64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor_atual), 0.0) FROM gastos_fixos WHERE mes=?1 AND deleted_at IS NULL",
        params![&mes],
        |r| r.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(total)
}


#[tauri::command]
fn listar_company_expenses(app: tauri::AppHandle) -> Result<Vec<CompanyExpense>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_despesa, data_pagamento, forma_pagamento, funcionario_id, status, comprovante_path, notas 
         FROM company_expenses WHERE deleted_at IS NULL ORDER BY data_despesa DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(CompanyExpense {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_despesa: r.get(4)?,
            data_pagamento: r.get(5)?,
            forma_pagamento: r.get(6)?,
            funcionario_id: r.get(7)?,
            status: r.get(8)?,
            comprovante_path: r.get(9)?,
            notas: r.get(10)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn listar_company_expenses_periodo(app: tauri::AppHandle, data_inicio: String, data_fim: String) -> Result<Vec<CompanyExpense>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_despesa, data_pagamento, forma_pagamento, funcionario_id, status, comprovante_path, notas 
         FROM company_expenses WHERE data_despesa BETWEEN ?1 AND ?2 AND deleted_at IS NULL ORDER BY data_despesa DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&data_inicio, &data_fim], |r| {
        Ok(CompanyExpense {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_despesa: r.get(4)?,
            data_pagamento: r.get(5)?,
            forma_pagamento: r.get(6)?,
            funcionario_id: r.get(7)?,
            status: r.get(8)?,
            comprovante_path: r.get(9)?,
            notas: r.get(10)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn criar_company_expense(app: tauri::AppHandle, expense: CompanyExpense) -> Result<i64, String> {
    log::info!(target: "financeiro", "[DESPESA] Registrando despesa: categoria={}, valor=R${:.2}", expense.categoria, expense.valor);
    validar_texto(&expense.categoria, "Categoria", 2, 50)?;
    validar_valor_positivo(expense.valor, "Valor")?;
    validar_data(&expense.data_despesa, "Data da despesa", true)?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO company_expenses (categoria, descricao, valor, data_despesa, data_pagamento, forma_pagamento, funcionario_id, status, comprovante_path, notas) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![expense.categoria, expense.descricao, expense.valor, expense.data_despesa, expense.data_pagamento, expense.forma_pagamento, 
                expense.funcionario_id, expense.status.as_deref().unwrap_or("pendente"), expense.comprovante_path, expense.notas],
    ).map_err(|e| { log::error!(target: "financeiro", "[DESPESA] Erro SQL: {}", e); e.to_string() })?;
    let id = conn.last_insert_rowid();
    log::info!(target: "financeiro", "[DESPESA] Despesa registrada: id={}, valor=R${:.2}", id, expense.valor);
    Ok(id)
}

#[tauri::command]
fn get_company_expense_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<CompanyExpense>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, categoria, descricao, valor, data_despesa, data_pagamento, forma_pagamento, funcionario_id, status, comprovante_path, notas 
         FROM company_expenses WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(CompanyExpense {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_despesa: r.get(4)?,
            data_pagamento: r.get(5)?,
            forma_pagamento: r.get(6)?,
            funcionario_id: r.get(7)?,
            status: r.get(8)?,
            comprovante_path: r.get(9)?,
            notas: r.get(10)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_company_expense(app: tauri::AppHandle, expense: CompanyExpense) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    if expense.valor <= 0.0 {
        return Err("Valor deve ser positivo".to_string());
    }
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_expenses SET categoria=?1, descricao=?2, valor=?3, data_despesa=?4, data_pagamento=?5, forma_pagamento=?6, funcionario_id=?7, status=?8, comprovante_path=?9, notas=?10, updated_at=?11 WHERE id=?12",
        params![expense.categoria, expense.descricao, expense.valor, expense.data_despesa, expense.data_pagamento, expense.forma_pagamento, 
                expense.funcionario_id, expense.status, expense.comprovante_path, expense.notas, &now, expense.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_company_expense(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_expenses SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pagar_company_expense(app: tauri::AppHandle, id: i64, data_pagamento: String, forma_pagamento: String) -> Result<(), String> {
    log::info!(target: "financeiro", "[PAGAMENTO] Pagando despesa: id={}, forma={}", id, forma_pagamento);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_expenses SET status=?1, data_pagamento=?2, forma_pagamento=?3, updated_at=?4 WHERE id=?5",
        params!["pago", &data_pagamento, &forma_pagamento, &now, id],
    ).map_err(|e| { log::error!(target: "financeiro", "[PAGAMENTO] Erro SQL: {}", e); e.to_string() })?;
    let new_values = serde_json::json!({
        "data_pagamento": data_pagamento,
        "forma_pagamento": forma_pagamento
    }).to_string();
    let description = format!("Despesa paga: ID {}, Forma: {}", id, forma_pagamento);
    log_audit(&app, None, None, "UPDATE", Some("company_expenses"), Some(id), None, Some(new_values), &description);
    log::info!(target: "financeiro", "[PAGAMENTO] Despesa paga: id={}, data={}", id, data_pagamento);
    Ok(())
}

#[tauri::command]
fn get_company_expenses_by_categoria(app: tauri::AppHandle, categoria: String) -> Result<Vec<CompanyExpense>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_despesa, data_pagamento, forma_pagamento, funcionario_id, status, comprovante_path, notas 
         FROM company_expenses WHERE categoria=?1 AND deleted_at IS NULL ORDER BY data_despesa DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&categoria], |r| {
        Ok(CompanyExpense {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_despesa: r.get(4)?,
            data_pagamento: r.get(5)?,
            forma_pagamento: r.get(6)?,
            funcionario_id: r.get(7)?,
            status: r.get(8)?,
            comprovante_path: r.get(9)?,
            notas: r.get(10)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}


#[tauri::command]
fn listar_company_revenues(app: tauri::AppHandle) -> Result<Vec<CompanyRevenue>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_receita, data_recebimento, forma_recebimento, status, comprovante_path, notas 
         FROM company_revenues WHERE deleted_at IS NULL ORDER BY data_receita DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(CompanyRevenue {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_receita: r.get(4)?,
            data_recebimento: r.get(5)?,
            forma_recebimento: r.get(6)?,
            status: r.get(7)?,
            comprovante_path: r.get(8)?,
            notas: r.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn listar_company_revenues_periodo(app: tauri::AppHandle, data_inicio: String, data_fim: String) -> Result<Vec<CompanyRevenue>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_receita, data_recebimento, forma_recebimento, status, comprovante_path, notas 
         FROM company_revenues WHERE data_receita BETWEEN ?1 AND ?2 AND deleted_at IS NULL ORDER BY data_receita DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&data_inicio, &data_fim], |r| {
        Ok(CompanyRevenue {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_receita: r.get(4)?,
            data_recebimento: r.get(5)?,
            forma_recebimento: r.get(6)?,
            status: r.get(7)?,
            comprovante_path: r.get(8)?,
            notas: r.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn criar_company_revenue(app: tauri::AppHandle, revenue: CompanyRevenue) -> Result<i64, String> {
    log::info!(target: "financeiro", "[RECEITA] Registrando receita: categoria={}, valor=R${:.2}", revenue.categoria, revenue.valor);
    validar_texto(&revenue.categoria, "Categoria", 2, 50)?;
    validar_valor_positivo(revenue.valor, "Valor")?;
    validar_data(&revenue.data_receita, "Data da receita", true)?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO company_revenues (categoria, descricao, valor, data_receita, data_recebimento, forma_recebimento, status, comprovante_path, notas) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![revenue.categoria, revenue.descricao, revenue.valor, revenue.data_receita, revenue.data_recebimento, revenue.forma_recebimento, 
                revenue.status.as_deref().unwrap_or("pendente"), revenue.comprovante_path, revenue.notas],
    ).map_err(|e| { log::error!(target: "financeiro", "[RECEITA] Erro SQL: {}", e); e.to_string() })?;
    let id = conn.last_insert_rowid();
    log::info!(target: "financeiro", "[RECEITA] Receita registrada: id={}, valor=R${:.2}", id, revenue.valor);
    Ok(id)
}

#[tauri::command]
fn get_company_revenue_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<CompanyRevenue>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, categoria, descricao, valor, data_receita, data_recebimento, forma_recebimento, status, comprovante_path, notas 
         FROM company_revenues WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(CompanyRevenue {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_receita: r.get(4)?,
            data_recebimento: r.get(5)?,
            forma_recebimento: r.get(6)?,
            status: r.get(7)?,
            comprovante_path: r.get(8)?,
            notas: r.get(9)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_company_revenue(app: tauri::AppHandle, revenue: CompanyRevenue) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    if revenue.valor <= 0.0 {
        return Err("Valor deve ser positivo".to_string());
    }
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_revenues SET categoria=?1, descricao=?2, valor=?3, data_receita=?4, data_recebimento=?5, forma_recebimento=?6, status=?7, comprovante_path=?8, notas=?9, updated_at=?10 WHERE id=?11",
        params![revenue.categoria, revenue.descricao, revenue.valor, revenue.data_receita, revenue.data_recebimento, revenue.forma_recebimento, revenue.status, revenue.comprovante_path, revenue.notas, &now, revenue.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_company_revenue(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_revenues SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn receber_company_revenue(app: tauri::AppHandle, id: i64, data_recebimento: String, forma_recebimento: String) -> Result<(), String> {
    log::info!(target: "financeiro", "[RECEBIMENTO] Recebendo receita: id={}, forma={}", id, forma_recebimento);
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE company_revenues SET status=?1, data_recebimento=?2, forma_recebimento=?3, updated_at=?4 WHERE id=?5",
        params!["recebido", &data_recebimento, &forma_recebimento, &now, id],
    ).map_err(|e| { log::error!(target: "financeiro", "[RECEBIMENTO] Erro SQL: {}", e); e.to_string() })?;
    log::info!(target: "financeiro", "[RECEBIMENTO] Receita recebida: id={}, data={}", id, data_recebimento);
    Ok(())
}

#[tauri::command]
fn get_company_revenues_by_categoria(app: tauri::AppHandle, categoria: String) -> Result<Vec<CompanyRevenue>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, categoria, descricao, valor, data_receita, data_recebimento, forma_recebimento, status, comprovante_path, notas 
         FROM company_revenues WHERE categoria=?1 AND deleted_at IS NULL ORDER BY data_receita DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![&categoria], |r| {
        Ok(CompanyRevenue {
            id: r.get(0)?,
            categoria: r.get(1)?,
            descricao: r.get(2)?,
            valor: r.get(3)?,
            data_receita: r.get(4)?,
            data_recebimento: r.get(5)?,
            forma_recebimento: r.get(6)?,
            status: r.get(7)?,
            comprovante_path: r.get(8)?,
            notas: r.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}


#[tauri::command]
fn get_financial_summary(app: tauri::AppHandle, mes: String) -> Result<FinancialSummary, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    
    let year_month = mes.clone();
    let start_date = format!("{}-01", year_month);
    let end_date = format!("{}-31", year_month);
    
    let total_receitas_alunos: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM mensalidades WHERE pago=1 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![format!("{}%", year_month)],
        |r| r.get(0),
    ).unwrap_or(0.0);
    
    let total_pendente_alunos: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM mensalidades WHERE pago=0 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![format!("{}%", year_month)],
        |r| r.get(0),
    ).unwrap_or(0.0);
    
    let total_despesas: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM company_expenses WHERE data_despesa BETWEEN ?1 AND ?2 AND deleted_at IS NULL",
        params![&start_date, &end_date],
        |r| r.get(0),
    ).unwrap_or(0.0);
    
    let total_gastos_fixos: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor_atual), 0.0) FROM gastos_fixos WHERE mes=?1 AND deleted_at IS NULL",
        params![&year_month],
        |r| r.get(0),
    ).unwrap_or(0.0);
    
    let lucro_liquido = total_receitas_alunos - total_despesas - total_gastos_fixos;
    
    Ok(FinancialSummary {
        total_receitas_alunos,
        total_pendente_alunos,
        total_despesas,
        total_gastos_fixos,
        lucro_liquido,
    })
}


#[tauri::command]
fn listar_servicos(app: tauri::AppHandle, tipo: Option<String>) -> Result<Vec<Servico>, String> {
    let cache_key = match &tipo {
        Some(t) => format!("servicos:list:tipo_{}", t),
        None => "servicos:list:all".to_string(),
    };
    if let Some(cached) = cache::GLOBAL_CACHE.get(&cache_key) {
        if let Ok(servicos) = serde_json::from_str::<Vec<Servico>>(&cached) {
            log::debug!(target: "cache", "[HIT] {}", cache_key);
            return Ok(servicos);
        }
    }
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let out = if let Some(ref t) = tipo {
        let mut stmt = conn.prepare(
            "SELECT id, nome, descricao, valor_padrao, tipo, status FROM servicos WHERE deleted_at IS NULL AND tipo = ?1 ORDER BY nome"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([t], |r| Ok(Servico {
            id: r.get(0)?, nome: r.get(1)?, descricao: r.get(2)?,
            valor_padrao: r.get(3)?, tipo: r.get(4)?, status: r.get(5)?,
        })).map_err(|e| e.to_string())?;
        let mut v = Vec::new();
        for r in rows { v.push(r.map_err(|e| e.to_string())?); }
        v
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, nome, descricao, valor_padrao, tipo, status FROM servicos WHERE deleted_at IS NULL ORDER BY nome"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok(Servico {
            id: r.get(0)?, nome: r.get(1)?, descricao: r.get(2)?,
            valor_padrao: r.get(3)?, tipo: r.get(4)?, status: r.get(5)?,
        })).map_err(|e| e.to_string())?;
        let mut v = Vec::new();
        for r in rows { v.push(r.map_err(|e| e.to_string())?); }
        v
    };

    if let Ok(json) = serde_json::to_string(&out) {
        cache::GLOBAL_CACHE.set(cache_key.clone(), json, None);
        log::debug!(target: "cache", "[SET] {}", cache_key);
    }
    Ok(out)
}

#[tauri::command]
fn criar_servico(app: tauri::AppHandle, servico: Servico) -> Result<i64, String> {
    validar_nome(&servico.nome, "Nome do serviço")?;
    validar_valor_positivo(servico.valor_padrao, "Valor padrão")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO servicos (nome, descricao, valor_padrao, tipo, status) VALUES (?1,?2,?3,?4,?5)",
        params![servico.nome, servico.descricao, servico.valor_padrao, servico.tipo.as_deref().unwrap_or("creche"), servico.status.as_deref().unwrap_or("ativo")],
    ).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    cache::GLOBAL_CACHE.invalidate_pattern("servicos:");
    log::debug!(target: "cache", "[INVALIDATE] servicos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(id)
}

#[tauri::command]
fn get_servico_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<Servico>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, descricao, valor_padrao, tipo, status FROM servicos WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(Servico { id: r.get(0)?, nome: r.get(1)?, descricao: r.get(2)?, valor_padrao: r.get(3)?, tipo: r.get(4)?, status: r.get(5)? }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_servico(app: tauri::AppHandle, servico: Servico) -> Result<(), String> {
    validar_nome(&servico.nome, "Nome do serviço")?;
    validar_valor_positivo(servico.valor_padrao, "Valor padrão")?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE servicos SET nome=?1, descricao=?2, valor_padrao=?3, tipo=?4, status=?5 WHERE id=?6",
        params![servico.nome, servico.descricao, servico.valor_padrao, servico.tipo.as_deref().unwrap_or("creche"), servico.status, servico.id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("servicos:");
    log::debug!(target: "cache", "[INVALIDATE] servicos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn delete_servico(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute("UPDATE servicos SET deleted_at=?1 WHERE id=?2", params![&now, id]).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("servicos:");
    log::debug!(target: "cache", "[INVALIDATE] servicos:*");
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn vincular_servico_aluno(app: tauri::AppHandle, aluno_id: i64, servico_id: i64, valor_acordado: Option<f64>, data_inicio: String) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO aluno_servicos (aluno_id, servico_id, valor_acordado, data_inicio) VALUES (?1,?2,?3,?4)",
        params![aluno_id, servico_id, valor_acordado, &data_inicio],
    ).map_err(|e| e.to_string())?;
    recalcular_mensalidades_pendentes(&conn, aluno_id)?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn desvincular_servico_aluno(app: tauri::AppHandle, aluno_id: i64, servico_id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE aluno_servicos SET deleted_at=?1 WHERE aluno_id=?2 AND servico_id=?3 AND deleted_at IS NULL",
        params![&now, aluno_id, servico_id],
    ).map_err(|e| e.to_string())?;
    recalcular_mensalidades_pendentes(&conn, aluno_id)?;
    Ok(())
}

#[tauri::command]
fn update_valor_acordado_servico(app: tauri::AppHandle, aluno_id: i64, servico_id: i64, valor_acordado: f64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE aluno_servicos SET valor_acordado=?1 WHERE aluno_id=?2 AND servico_id=?3 AND deleted_at IS NULL",
        params![valor_acordado, aluno_id, servico_id],
    ).map_err(|e| e.to_string())?;
    recalcular_mensalidades_pendentes(&conn, aluno_id)?;
    Ok(())
}

#[tauri::command]
fn get_servicos_do_aluno(app: tauri::AppHandle, aluno_id: i64) -> Result<Vec<AlunoServico>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT asv.id, asv.aluno_id, asv.servico_id, s.nome, s.valor_padrao, asv.valor_acordado, asv.data_inicio, asv.data_fim
         FROM aluno_servicos asv
         JOIN servicos s ON asv.servico_id = s.id
         WHERE asv.aluno_id=?1 AND asv.deleted_at IS NULL AND s.deleted_at IS NULL
         ORDER BY s.nome"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![aluno_id], |r| Ok(AlunoServico {
        id: r.get(0)?, aluno_id: r.get(1)?, servico_id: r.get(2)?,
        servico_nome: r.get(3)?, valor_padrao: r.get(4)?,
        valor_acordado: r.get(5)?, data_inicio: r.get(6)?, data_fim: r.get(7)?,
    })).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows { out.push(r.map_err(|e| e.to_string())?); }
    Ok(out)
}


fn calcular_frequencia_periodo(app: &tauri::AppHandle, turma_id: i64, data_inicio: &str, data_fim: &str) -> Result<FrequenciaPeriodoResponse, String> {
    let conn = get_db_connection(app).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, turma_id, data, registros FROM frequencia_registros WHERE turma_id=?1 AND data>=?2 AND data<=?3 AND deleted_at IS NULL ORDER BY data"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![turma_id, data_inicio, data_fim], |r| {
        Ok((
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut aluno_stats: std::collections::HashMap<i64, (i64, i64)> = std::collections::HashMap::new(); // (presentes, ausencias)
    let mut total_presencas: i64 = 0;
    let mut total_ausencias: i64 = 0;

    for row in rows {
        let (_data, registros_json) = row.map_err(|e| e.to_string())?;
        if let Ok(registros) = serde_json::from_str::<Vec<serde_json::Value>>(&registros_json) {
            for reg in registros {
                if let Some(aluno_id) = reg.get("alunoId").and_then(|v| v.as_i64()) {
                    let presente = reg.get("presente").and_then(|v| v.as_bool()).unwrap_or(true);
                    let entry = aluno_stats.entry(aluno_id).or_insert((0, 0));
                    if presente {
                        entry.0 += 1;
                        total_presencas += 1;
                    } else {
                        entry.1 += 1;
                        total_ausencias += 1;
                    }
                }
            }
        }
    }

    let mut nome_stmt = conn.prepare("SELECT id, nome FROM alunos WHERE id=?1").map_err(|e| e.to_string())?;

    let mut alunos: Vec<FrequenciaAlunoPeriodo> = Vec::new();
    let total_alunos = aluno_stats.len() as i64;

    for (aluno_id, (pres, aus)) in aluno_stats.iter() {
        let total_reg = pres + aus;
        let pct = if total_reg > 0 { (*pres as f64 / total_reg as f64) * 100.0 } else { 0.0 };
        let nome = nome_stmt.query_row(params![aluno_id], |r| r.get::<_, String>(1)).unwrap_or_else(|_| "Desconhecido".to_string());
        alunos.push(FrequenciaAlunoPeriodo {
            aluno_id: *aluno_id,
            aluno_nome: nome,
            presentes: *pres,
            ausencias: *aus,
            total_registros: total_reg,
            percentual_presenca: (pct * 100.0).round() / 100.0,
        });
    }

    alunos.sort_by(|a, b| a.aluno_nome.cmp(&b.aluno_nome));

    let total_registros_geral = total_presencas + total_ausencias;
    let pct_geral_pres = if total_registros_geral > 0 { (total_presencas as f64 / total_registros_geral as f64) * 100.0 } else { 0.0 };
    let pct_geral_aus = if total_registros_geral > 0 { (total_ausencias as f64 / total_registros_geral as f64) * 100.0 } else { 0.0 };

    Ok(FrequenciaPeriodoResponse {
        total_alunos,
        total_presencas,
        total_ausencias,
        percentual_presenca_geral: (pct_geral_pres * 100.0).round() / 100.0,
        percentual_ausencia_geral: (pct_geral_aus * 100.0).round() / 100.0,
        alunos,
        periodo_inicio: data_inicio.to_string(),
        periodo_fim: data_fim.to_string(),
    })
}

#[tauri::command]
fn get_frequencia_diaria(app: tauri::AppHandle, turma_id: i64, data: String) -> Result<FrequenciaPeriodoResponse, String> {
    calcular_frequencia_periodo(&app, turma_id, &data, &data)
}

#[tauri::command]
fn get_frequencia_semanal(app: tauri::AppHandle, turma_id: i64, data: String) -> Result<FrequenciaPeriodoResponse, String> {
    let dt = chrono::NaiveDate::parse_from_str(&data, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let weekday = dt.weekday().num_days_from_monday() as i64;
    let segunda = dt - chrono::Duration::days(weekday);
    let domingo = segunda + chrono::Duration::days(6);
    let inicio = segunda.format("%Y-%m-%d").to_string();
    let fim = domingo.format("%Y-%m-%d").to_string();
    calcular_frequencia_periodo(&app, turma_id, &inicio, &fim)
}

#[tauri::command]
fn get_frequencia_mensal(app: tauri::AppHandle, turma_id: i64, mes: i64, ano: i64) -> Result<FrequenciaPeriodoResponse, String> {
    let inicio = format!("{:04}-{:02}-01", ano, mes);
    let ano_i32 = ano as i32;
    let last_day = if mes == 12 {
        chrono::NaiveDate::from_ymd_opt(ano_i32 + 1, 1, 1)
    } else {
        chrono::NaiveDate::from_ymd_opt(ano_i32, mes as u32 + 1, 1)
    }.map(|d| d - chrono::Duration::days(1))
     .unwrap_or(chrono::NaiveDate::from_ymd_opt(ano_i32, mes as u32, 28).unwrap());
    let fim = last_day.format("%Y-%m-%d").to_string();
    calcular_frequencia_periodo(&app, turma_id, &inicio, &fim)
}

#[tauri::command]
fn get_frequencia_semestral(app: tauri::AppHandle, turma_id: i64, semestre: i64, ano: i64) -> Result<FrequenciaPeriodoResponse, String> {
    let (inicio, fim) = if semestre == 1 {
        (format!("{:04}-01-01", ano), format!("{:04}-06-30", ano))
    } else {
        (format!("{:04}-07-01", ano), format!("{:04}-12-31", ano))
    };
    calcular_frequencia_periodo(&app, turma_id, &inicio, &fim)
}

#[tauri::command]
fn get_frequencia_anual(app: tauri::AppHandle, turma_id: i64, ano: i64) -> Result<FrequenciaPeriodoResponse, String> {
    let inicio = format!("{:04}-01-01", ano);
    let fim = format!("{:04}-12-31", ano);
    calcular_frequencia_periodo(&app, turma_id, &inicio, &fim)
}


#[tauri::command]
fn limpar_cache() -> Result<(), String> {
    cache::GLOBAL_CACHE.clear();
    log::info!(target: "cache", "[CLEAR] Cache limpo manualmente");
    Ok(())
}


#[tauri::command]
fn criar_backup_manual(app: tauri::AppHandle, user_id: i64) -> Result<backup::BackupInfo, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::create_backup(&conn, "manual", Some(user_id))
}

#[tauri::command]
fn criar_backup_personalizado(
    app: tauri::AppHandle,
    caminho: String,
    parte: Option<String>,
    user_id: i64,
) -> Result<backup::BackupInfo, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let info = backup::criar_backup_personalizado(&conn, &caminho, parte.as_deref(), Some(user_id))?;
    log_audit(&app, Some(user_id), None, "BACKUP", Some("database_backups"), Some(info.id), None,
        Some(serde_json::json!({"caminho": info.file_path, "parte": parte}).to_string()),
        &format!("Backup manual salvo pelo usuário em {}", info.file_path));
    Ok(info)
}

#[tauri::command]
fn obter_pasta_backup_padrao(_app: tauri::AppHandle, parte: Option<String>) -> Result<String, String> {
    let dir = backup::get_backup_dir_for_part(parte.as_deref().filter(|p| !p.is_empty()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn obter_pasta_exportacao(app: tauri::AppHandle, categoria: String) -> Result<String, String> {
    let base = caminho_base(&app);
    let pasta = mapear_categoria(&categoria, &base)?;
    std::fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    Ok(pasta.to_string_lossy().to_string())
}

#[tauri::command]
fn listar_backups(app: tauri::AppHandle) -> Result<Vec<backup::BackupInfo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, filename, file_path, file_size, checksum, backup_type, created_at, created_by, is_valid, notes
         FROM database_backups ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(backup::BackupInfo {
            id: row.get(0)?,
            filename: row.get(1)?,
            file_path: row.get(2)?,
            file_size: row.get(3)?,
            checksum: row.get(4)?,
            backup_type: row.get(5)?,
            created_at: row.get(6)?,
            created_by: row.get(7)?,
            is_valid: row.get::<_, bool>(8)?,
            notes: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut backups = Vec::new();
    for row in rows {
        backups.push(row.map_err(|e| e.to_string())?);
    }
    Ok(backups)
}

#[tauri::command]
fn restaurar_backup(app: tauri::AppHandle, backup_id: i64, user_id: i64, mode: String) -> Result<String, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::restore_backup(&conn, backup_id, user_id, &mode)
}

#[tauri::command]
fn validar_backup(app: tauri::AppHandle, backup_id: i64) -> Result<bool, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::validate_backup(&conn, backup_id)
}

#[tauri::command]
fn deletar_backup(app: tauri::AppHandle, backup_id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    let file_path: String = conn.query_row(
        "SELECT file_path FROM database_backups WHERE id = ?1",
        params![backup_id],
        |row| row.get(0),
    ).map_err(|_| format!("Backup #{} não encontrado", backup_id))?;

    let path = std::path::Path::new(&file_path);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("Erro ao deletar arquivo: {}", e))?;
    }

    conn.execute("DELETE FROM database_backups WHERE id = ?1", params![backup_id])
        .map_err(|e| e.to_string())?;

    log::info!(target: "backup", "[BACKUP] Backup deletado: #{}", backup_id);
    Ok(())
}

#[tauri::command]
fn get_backup_settings(app: tauri::AppHandle) -> Result<backup::BackupSettings, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, auto_backup_enabled, backup_interval_hours, retention_days, backup_path, last_backup_at, next_backup_at
         FROM backup_settings WHERE id = 1",
        [],
        |row| {
            Ok(backup::BackupSettings {
                id: row.get(0)?,
                auto_backup_enabled: row.get::<_, bool>(1)?,
                backup_interval_hours: row.get(2)?,
                retention_days: row.get(3)?,
                backup_path: row.get(4)?,
                last_backup_at: row.get(5)?,
                next_backup_at: row.get(6)?,
            })
        },
    ).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_backup_settings(app: tauri::AppHandle, settings: backup::BackupSettings) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE backup_settings SET auto_backup_enabled = ?1, backup_interval_hours = ?2, retention_days = ?3, backup_path = ?4
         WHERE id = 1",
        params![settings.auto_backup_enabled as i32, settings.backup_interval_hours, settings.retention_days, settings.backup_path],
    ).map_err(|e| e.to_string())?;

    log::info!(target: "backup", "[BACKUP] Configurações atualizadas");
    Ok(())
}

#[tauri::command]
fn executar_backup_automatico(app: tauri::AppHandle) -> Result<Option<backup::BackupInfo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::execute_auto_backup(&conn)
}

#[tauri::command]
fn salvar_logo(app: tauri::AppHandle, logo_base64: String) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('logo', ?1)",
        params![logo_base64],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_logo(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT valor FROM configuracoes WHERE chave = 'logo'",
        [],
        |r| r.get::<_, String>(0),
    );
    match result {
        Ok(valor) => Ok(Some(valor)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}


#[tauri::command]
fn criar_backup_partes(app: tauri::AppHandle, user_id: i64) -> Result<Vec<backup::BackupInfo>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::create_all_part_backups(&conn, Some(user_id))
}

#[tauri::command]
fn importar_backup(app: tauri::AppHandle, user_id: i64, caminho: String) -> Result<backup::BackupInfo, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    backup::importar_backup(&conn, &caminho, Some(user_id))
}

#[tauri::command]
fn log_frontend_error(message: String, stack: Option<String>) -> Result<(), String> {
    match &stack {
        Some(s) => log::error!(target: "frontend", "{} | stack: {}", message, s),
        None => log::error!(target: "frontend", "{}", message),
    }
    Ok(())
}

#[tauri::command]
fn importar_backup_base64(app: tauri::AppHandle, user_id: i64, nome_arquivo: String, dados_base64: String) -> Result<backup::BackupInfo, String> {
    let dados = base64::engine::general_purpose::STANDARD
        .decode(dados_base64.trim())
        .map_err(|e| format!("Erro ao decodificar base64: {}", e))?;
    let nome_limpo = nome_arquivo.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-', "_");
    let caminho_tmp = std::env::temp_dir().join(format!("backup_import_{}_{}", std::process::id(), nome_limpo));
    std::fs::write(&caminho_tmp, &dados).map_err(|e| format!("Erro ao salvar arquivo temporário: {}", e))?;
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let resultado = backup::importar_backup(&conn, &caminho_tmp.to_string_lossy(), Some(user_id));
let _ = std::fs::remove_file(&caminho_tmp);
    resultado
}


#[tauri::command]
fn listar_escalas_trabalho(app: tauri::AppHandle) -> Result<Vec<EscalaTrabalho>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nome, dias_semana, hora_entrada, hora_saida, descricao, status
         FROM escala_trabalho WHERE deleted_at IS NULL ORDER BY nome"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(EscalaTrabalho {
            id: Some(r.get(0)?),
            nome: r.get(1)?,
            dias_semana: r.get(2)?,
            hora_entrada: r.get(3)?,
            hora_saida: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn criar_escala_trabalho(app: tauri::AppHandle, escala: EscalaTrabalho) -> Result<i64, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO escala_trabalho (nome, dias_semana, hora_entrada, hora_saida, descricao, status)
         VALUES (?1, ?2, ?3, ?4, ?5, COALESCE(?6, 'ativo'))",
        params![escala.nome, escala.dias_semana, escala.hora_entrada, escala.hora_saida, escala.descricao, escala.status],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_escala_trabalho_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<EscalaTrabalho>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    Ok(conn.query_row(
        "SELECT id, nome, dias_semana, hora_entrada, hora_saida, descricao, status
         FROM escala_trabalho WHERE id=?1 AND deleted_at IS NULL",
        params![id],
        |r| Ok(EscalaTrabalho {
            id: Some(r.get(0)?),
            nome: r.get(1)?,
            dias_semana: r.get(2)?,
            hora_entrada: r.get(3)?,
            hora_saida: r.get(4)?,
            descricao: r.get(5)?,
            status: r.get(6)?,
        }),
    ).optional().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn update_escala_trabalho(app: tauri::AppHandle, escala: EscalaTrabalho) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE escala_trabalho SET nome=?1, dias_semana=?2, hora_entrada=?3, hora_saida=?4, descricao=?5, status=?6
         WHERE id=?7 AND deleted_at IS NULL",
        params![escala.nome, escala.dias_semana, escala.hora_entrada, escala.hora_saida, escala.descricao, escala.status, escala.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_escala_trabalho(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE escala_trabalho SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE funcionarios SET escala_trabalho_id=NULL WHERE escala_trabalho_id=?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}


#[tauri::command]
fn delete_frequencia_registro(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE frequencia_registros SET deleted_at=?1 WHERE id=?2",
        params![&now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn listar_pagamentos_salarios(app: tauri::AppHandle, mes: String) -> Result<Vec<SalarioRegistro>, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT p.id, p.funcionario_id, COALESCE(f.nome_completo, ''), p.mes, p.valor, p.pago, p.data_pagamento
         FROM pagamentos_salarios p
         LEFT JOIN funcionarios f ON f.id = p.funcionario_id
         WHERE p.mes=?1 AND p.deleted_at IS NULL
         ORDER BY f.nome_completo"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![mes], |r| {
        Ok(SalarioRegistro {
            id: r.get(0)?,
            funcionario_id: r.get(1)?,
            funcionario_nome: r.get(2)?,
            mes: r.get(3)?,
            valor: r.get(4)?,
            pago: r.get(5)?,
            data_pagamento: r.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn pagar_salario(app: tauri::AppHandle, id: i64, data_pagamento: String) -> Result<(), String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE pagamentos_salarios SET pago=1, data_pagamento=?1 WHERE id=?2 AND deleted_at IS NULL",
        params![data_pagamento, id],
    ).map_err(|e| e.to_string())?;
    cache::GLOBAL_CACHE.invalidate_pattern("dashboard:");
    Ok(())
}

#[tauri::command]
fn get_financial_overview(app: tauri::AppHandle, mes: String) -> Result<FinancialOverview, String> {
    let conn = get_db_connection(&app).map_err(|e| e.to_string())?;
    let mes_like = format!("{}%", mes);

    let total_alunos_ativos: i32 = conn.query_row(
        "SELECT COUNT(*) FROM alunos WHERE deleted_at IS NULL",
        [], |r| r.get(0),
    ).unwrap_or(0);
    let total_funcionarios_ativos: i32 = conn.query_row(
        "SELECT COUNT(*) FROM funcionarios WHERE status='ativo' AND deleted_at IS NULL",
        [], |r| r.get(0),
    ).unwrap_or(0);

    let mensalidades_pagas: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM mensalidades WHERE pago=1 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);
    let mensalidades_pendentes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM mensalidades WHERE pago=0 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);
    let mensalidades_pagas_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM mensalidades WHERE pago=1 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0);
    let mensalidades_pendentes_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM mensalidades WHERE pago=0 AND vencimento LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0);

    let receitas_manuais_recebidas: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM company_revenues WHERE status='recebido' AND data_receita LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);
    let receitas_manuais_pendentes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM company_revenues WHERE status='pendente' AND data_receita LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);

    let salarios_pagos: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM pagamentos_salarios WHERE mes=?1 AND pago=1 AND deleted_at IS NULL",
        params![&mes], |r| r.get(0),
    ).unwrap_or(0.0);
    let salarios_pendentes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM pagamentos_salarios WHERE mes=?1 AND pago=0 AND deleted_at IS NULL",
        params![&mes], |r| r.get(0),
    ).unwrap_or(0.0);

    let gastos_fixos_mes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor_atual), 0.0) FROM gastos_fixos WHERE mes=?1 AND deleted_at IS NULL",
        params![&mes], |r| r.get(0),
    ).unwrap_or(0.0);

    let despesas_manuais_pagas: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM company_expenses WHERE status='pago' AND data_despesa LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);
    let despesas_manuais_pendentes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(valor), 0.0) FROM company_expenses WHERE status='pendente' AND data_despesa LIKE ?1 AND deleted_at IS NULL",
        params![&mes_like], |r| r.get(0),
    ).unwrap_or(0.0);

    let receitas_total_previsto = mensalidades_pagas + mensalidades_pendentes + receitas_manuais_recebidas + receitas_manuais_pendentes;
    let despesas_total_previsto = gastos_fixos_mes + despesas_manuais_pagas + despesas_manuais_pendentes + salarios_pagos + salarios_pendentes;
    let receita_real = mensalidades_pagas + receitas_manuais_recebidas;
    let despesas_pagas = despesas_manuais_pagas + salarios_pagos;
    let saldo_estimado = receitas_total_previsto - despesas_total_previsto;
    let resultado_real = receita_real - despesas_pagas;

    Ok(FinancialOverview {
        total_alunos_ativos,
        total_funcionarios_ativos,
        mensalidades_pagas,
        mensalidades_pendentes,
        mensalidades_pagas_count,
        mensalidades_pendentes_count,
        receitas_manuais_recebidas,
        receitas_manuais_pendentes,
        salarios_pagos,
        salarios_pendentes,
        gastos_fixos_mes,
        despesas_manuais_pagas,
        despesas_manuais_pendentes,
        receitas_total_previsto,
        despesas_total_previsto,
        receita_real,
        despesas_pagas,
        saldo_estimado,
        resultado_real,
    })
}

fn main() {
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.cuidarerp.erp");
    logger::init_logger(app_data_dir.clone());
    logger::limpar_logs_antigos(app_data_dir);
    log::info!(target: "system", "Cuidar ERP iniciando...");
    migrar_dados_legados();
    let _ = std::fs::create_dir_all(backup_base_dir());
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(15));
                let conn = get_db_connection(&handle);
                match conn {
                    Ok(conn) => match backup::execute_auto_backup(&conn) {
                        Ok(Some(info)) => log::info!(
                            target: "backup",
                            "[INICIALIZACAO] Backup automático mensal criado: {}",
                            info.filename
                        ),
                        Ok(None) => log::debug!(
                            target: "backup",
                            "[INICIALIZACAO] Backup automático não necessário"
                        ),
                        Err(e) => log::error!(
                            target: "backup",
                            "[INICIALIZACAO] Erro no backup automático: {}",
                            e
                        ),
                    },
                    Err(e) => log::error!(
                        target: "backup",
                        "[INICIALIZACAO] Erro ao abrir banco: {}",
                        e
                    ),
                }
            });
            servidor_rede::iniciar(&app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
                registrar_audit_log, listar_audit_logs, get_audit_log_stats, listar_alunos_paginado, login, refresh_token, logout, get_active_sessions, revoke_session, get_login_history,
                get_dashboard_stats, get_funcionarios_stats, get_dashboard_stats_completo, get_relatorio_funcionarios, get_resumo_relatorio_funcionarios, inicializar_estrutura_pastas, salvar_arquivo_na_pasta, abrir_pasta_no_explorador, salvar_arquivo_em, verificar_onboarding,
                salvar_creche, get_creche, atualizar_senha_admin, listar_alunos, criar_aluno, get_aluno_by_id, update_aluno, get_alunos_by_turma, get_turmas, create_turma,
                get_turma_by_id, update_turma, get_responsaveis, create_responsavel, update_responsavel, get_responsavel_by_id, delete_responsavel, get_crianca_responsaveis, create_crianca_responsavel, delete_crianca_responsavel,
                get_matriculas, create_matricula, get_matricula_by_id, update_matricula, delete_matricula, get_mensalidades, create_mensalidade, get_mensalidade_by_id, update_mensalidade, pagar_mensalidade,
                gerar_mensalidade_para_aluno, gerar_mensalidades_do_mes, atualizar_taxa_matricula_mensalidade, gerar_salarios_mes, gerar_gastos_fixos_mes, get_frequencias, create_frequencia, get_frequencia_by_id, update_frequencia, salvar_frequencia_turma,
                get_frequencia_por_turma_data, get_frequencia_historico, get_ultima_frequencia_alunos, get_ocorrencias, create_ocorrencia, get_ocorrencia_by_id, get_ocorrencias_periodo, update_ocorrencia, get_ip_local, listar_ips_locais,
                rede_local_get, rede_local_set, verificar_primeiro_acesso, criar_usuario_inicial, save_file_dialog, resetar_banco, resetar_dados_teste, reset_admin_password, reset_all_data_and_init, criar_admin_emergencia,
                diagnosticar_e_corrigir_login, resetar_senha_admin, garantir_admin_login, criar_dados_teste, get_ultima_frequencia_alunos_periodo, get_mensalidades_periodo, get_frequencia_registros_periodo, delete_aluno, delete_turma, delete_mensalidade,
                delete_frequencia, delete_ocorrencia, listar_cargos, criar_cargo, get_cargo_by_id, update_cargo, delete_cargo, listar_funcionarios, criar_funcionario, get_funcionario_by_id,
                update_funcionario, delete_funcionario, get_funcionarios_by_turma, adicionar_funcionario_turma, remover_funcionario_turma, get_funcionario_turmas, listar_frequencia_funcionarios, criar_frequencia_funcionario, get_frequencia_funcionario_by_id, update_frequencia_funcionario,
                delete_frequencia_funcionario, listar_frequencia_funcionarios_por_data, salvar_frequencia_funcionario, listar_gastos_fixos, criar_gasto_fixo, get_gasto_fixo_by_id, get_gasto_fixo_by_nome_mes, update_gasto_fixo, delete_gasto_fixo, get_gastos_fixos_mes,
                recalcular_gastos_fixos, listar_company_expenses, listar_company_expenses_periodo, criar_company_expense, get_company_expense_by_id, update_company_expense, delete_company_expense, pagar_company_expense, get_company_expenses_by_categoria, listar_company_revenues,
                listar_company_revenues_periodo, criar_company_revenue, get_company_revenue_by_id, update_company_revenue, delete_company_revenue, receber_company_revenue, get_company_revenues_by_categoria, get_financial_summary, listar_servicos, criar_servico,
                get_servico_by_id, update_servico, delete_servico, vincular_servico_aluno, desvincular_servico_aluno, update_valor_acordado_servico, get_servicos_do_aluno, get_frequencia_diaria, get_frequencia_semanal, get_frequencia_mensal,
                get_frequencia_semestral, get_frequencia_anual, limpar_cache, criar_backup_manual, listar_backups, restaurar_backup, validar_backup, deletar_backup, get_backup_settings, update_backup_settings,
executar_backup_automatico, salvar_logo, get_logo, criar_backup_partes, importar_backup, log_frontend_error, importar_backup_base64, delete_frequencia_registro, listar_escalas_trabalho, criar_escala_trabalho, get_escala_trabalho_by_id,
criar_backup_personalizado, obter_pasta_backup_padrao, obter_pasta_exportacao,
                update_escala_trabalho, delete_escala_trabalho, listar_pagamentos_salarios, pagar_salario, get_financial_overview,
         ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
