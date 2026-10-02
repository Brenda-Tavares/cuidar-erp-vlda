use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use lazy_static::lazy_static;
use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

const TEMPO_EXPIRACAO_TOKEN: Duration = Duration::from_secs(12 * 60 * 60);

lazy_static! {
    static ref TOKENS: Mutex<HashMap<String, (i64, Instant)>> = Mutex::new(HashMap::new());
}

pub fn gerar_token(user_id: i64) -> String {
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let mut map = TOKENS.lock().unwrap();
    map.retain(|_, (_, t)| t.elapsed() < TEMPO_EXPIRACAO_TOKEN);
    map.insert(token.clone(), (user_id, Instant::now()));
    token
}

pub fn validar_token(token: &str) -> Option<i64> {
    let map = TOKENS.lock().unwrap();
    map.get(token)
        .filter(|(_, t)| t.elapsed() < TEMPO_EXPIRACAO_TOKEN)
        .map(|(id, _)| *id)
}

pub fn remover_token(token: &str) {
    TOKENS.lock().unwrap().remove(token);
}

fn camel_to_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        if c.is_uppercase() {
            out.push('_');
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

fn camel_to_snake_keys(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(k, v)| (camel_to_snake(&k), v))
                .collect(),
        ),
        Value::Array(arr) => Value::Array(arr.into_iter().map(camel_to_snake_keys).collect()),
        other => other,
    }
}

#[derive(Deserialize)]
struct ArgsLogin {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct ArgsSalvarArquivoEm {
    caminho: String,
    conteudo: Vec<u8>,
}

#[derive(Deserialize)]
struct ArgsLogFrontendError {
    message: String,
    stack: Option<String>,
}

macro_rules! dispatch {
    ($app:ident, $comando:ident, $args:expr, $($func:ident(app $(, $arg:ident : $ty:ty)*)),* $(,)?) => {{
        let args = camel_to_snake_keys($args);
        match $comando {
            $(
                stringify!($func) => {
                    #[derive(Deserialize)]
                    struct Args {
                        $($arg: $ty),*
                    }
                    let a: Args = serde_json::from_value(args.clone())
                        .map_err(|e| format!("Argumentos inválidos para {}: {}", stringify!($func), e))?;
                    let _ = &a;
                    match crate::$func($app.clone(), $(a.$arg),*) {
                        Ok(valor) => serde_json::to_value(valor).map_err(|e| e.to_string()),
                        Err(erro) => Err(erro),
                    }
                }
            )*
            _ => Err(format!("Comando desconhecido: {}", $comando)),
        }
    }};
}

pub fn handle_rpc(
    app: &AppHandle,
    comando: &str,
    args: Value,
    token_web: Option<&str>,
) -> Result<Value, String> {
    let permitido_sem_token = matches!(
        comando,
        "login"
            | "verificar_primeiro_acesso"
            | "criar_usuario_inicial"
            | "log_frontend_error"
            | "get_ip_local"
            | "listar_ips_locais"
    );
    if !permitido_sem_token {
        let _uid = token_web
            .and_then(validar_token)
            .ok_or_else(|| "Não autenticado. Faça login novamente.".to_string())?;
    }

    if matches!(
        comando,
        "salvar_arquivo_em" | "log_frontend_error" | "get_ip_local" | "listar_ips_locais"
    ) {
        return handle_rpc_sem_app(comando, args);
    }

    if comando == "login" {
        let a: ArgsLogin = serde_json::from_value(camel_to_snake_keys(args))
            .map_err(|e| format!("Argumentos inválidos para login: {}", e))?;
        let user = crate::login(app.clone(), a.username, a.password)?;
        let mut v = serde_json::to_value(user).map_err(|e| e.to_string())?;
        let user_id = v["id"].as_i64().unwrap_or(0);
        let token = gerar_token(user_id);
        v["web_token"] = Value::String(token);
        return Ok(v);
    }

    let resultado = dispatch!(
        app, comando, args,
        listar_audit_logs(app, filter: crate::AuditLogFilter),
        get_audit_log_stats(app, dias: i32),
        listar_alunos_paginado(app, paginacao: crate::PaginacaoRequest, filtros: Option<Value>),
        logout(app, token: Option<String>),
        get_active_sessions(app, user_id: i64),
        revoke_session(app, session_id: i64, user_id: i64),
        get_login_history(app, username: String),
        get_dashboard_stats_completo(app),
        get_relatorio_funcionarios(app, mes: String),
        get_resumo_relatorio_funcionarios(app, mes: String),
        inicializar_estrutura_pastas(app),
        salvar_arquivo_na_pasta(app, categoria: String, nome_arquivo: String, conteudo: Vec<u8>),
        abrir_pasta_no_explorador(app, caminho: String),
        verificar_onboarding(app),
        salvar_creche(app, creche: crate::Creche),
        get_creche(app),
        atualizar_senha_admin(app, senha_atual: String, nova_senha: String),
        listar_alunos(app),
        criar_aluno(app, aluno: crate::Aluno),
        update_aluno(app, aluno: crate::Aluno),
        get_alunos_by_turma(app, turma_id: i64),
        get_turmas(app),
        create_turma(app, turma: crate::Turma),
        get_turma_by_id(app, id: i64),
        update_turma(app, turma: crate::Turma),
        get_mensalidades(app),
        create_mensalidade(app, m: crate::Mensalidade),
        pagar_mensalidade(app, id: i64, data_pagamento: String, forma_pagamento: String),
        gerar_mensalidade_para_aluno(app, aluno_id: i64, mes_referencia: String),
        gerar_mensalidades_do_mes(app, mes_referencia: String),
        atualizar_taxa_matricula_mensalidade(app, id: i64, taxa: f64),
        salvar_frequencia_turma(app, turma_id: i64, data: String, registros: String),
        get_frequencia_por_turma_data(app, turma_id: i64, data: String),
        get_frequencia_historico(app, turma_id: i64),
        get_ocorrencias(app),
        create_ocorrencia(app, o: crate::Ocorrencia),
        get_ocorrencias_periodo(app, data_inicio: String, data_fim: String),
        update_ocorrencia(app, o: crate::Ocorrencia),
        verificar_primeiro_acesso(app),
        criar_usuario_inicial(app, username: String, password: String, nome_completo: String),
        reset_admin_password(app),
        reset_all_data_and_init(app),
        garantir_admin_login(app),
        criar_dados_teste(app),
        get_mensalidades_periodo(app, data_inicio: String, data_fim: String),
        delete_aluno(app, id: i64),
        delete_turma(app, id: i64),
        delete_mensalidade(app, id: i64),
        delete_frequencia_registro(app, id: i64),
        delete_ocorrencia(app, id: i64),
        listar_cargos(app),
        criar_cargo(app, cargo: crate::Cargo),
        update_cargo(app, cargo: crate::Cargo),
        delete_cargo(app, id: i64),
        listar_escalas_trabalho(app),
        criar_escala_trabalho(app, escala: crate::EscalaTrabalho),
        update_escala_trabalho(app, escala: crate::EscalaTrabalho),
        delete_escala_trabalho(app, id: i64),
        listar_funcionarios(app),
        criar_funcionario(app, func: crate::Funcionario),
        get_funcionario_by_id(app, id: i64),
        update_funcionario(app, func: crate::Funcionario),
        delete_funcionario(app, id: i64),
        adicionar_funcionario_turma(app, funcionario_id: i64, turma_id: i64, data_inicio: Option<String>),
        remover_funcionario_turma(app, funcionario_id: i64, turma_id: i64),
        get_funcionario_turmas(app, funcionario_id: i64),
        listar_frequencia_funcionarios_por_data(app, data: String),
        salvar_frequencia_funcionario(app, f: crate::FrequenciaFuncionario),
        listar_gastos_fixos(app),
        criar_gasto_fixo(app, gasto: crate::GastoFixo),
        update_gasto_fixo(app, gasto: crate::GastoFixo),
        delete_gasto_fixo(app, id: i64),
        get_gastos_fixos_mes(app, mes: String),
        listar_company_expenses(app),
        criar_company_expense(app, expense: crate::CompanyExpense),
        update_company_expense(app, expense: crate::CompanyExpense),
        delete_company_expense(app, id: i64),
        pagar_company_expense(app, id: i64, data_pagamento: String, forma_pagamento: String),
        listar_company_revenues(app),
        criar_company_revenue(app, revenue: crate::CompanyRevenue),
        update_company_revenue(app, revenue: crate::CompanyRevenue),
        delete_company_revenue(app, id: i64),
        receber_company_revenue(app, id: i64, data_recebimento: String, forma_recebimento: String),
        listar_pagamentos_salarios(app, mes: String),
        pagar_salario(app, id: i64, data_pagamento: String),
        get_financial_overview(app, mes: String),
        listar_servicos(app, tipo: Option<String>),
        criar_servico(app, servico: crate::Servico),
        update_servico(app, servico: crate::Servico),
        delete_servico(app, id: i64),
        vincular_servico_aluno(app, aluno_id: i64, servico_id: i64, valor_acordado: Option<f64>, data_inicio: String),
        desvincular_servico_aluno(app, aluno_id: i64, servico_id: i64),
        update_valor_acordado_servico(app, aluno_id: i64, servico_id: i64, valor_acordado: f64),
        get_servicos_do_aluno(app, aluno_id: i64),
        get_frequencia_diaria(app, turma_id: i64, data: String),
        get_frequencia_semanal(app, turma_id: i64, data: String),
        get_frequencia_mensal(app, turma_id: i64, mes: i64, ano: i64),
        get_frequencia_semestral(app, turma_id: i64, semestre: i64, ano: i64),
        get_frequencia_anual(app, turma_id: i64, ano: i64),
        criar_backup_manual(app, user_id: i64),
        criar_backup_partes(app, user_id: i64),
        criar_backup_personalizado(app, caminho: String, parte: Option<String>, user_id: i64),
        obter_pasta_backup_padrao(app, parte: Option<String>),
        listar_backups(app),
        restaurar_backup(app, backup_id: i64, user_id: i64, mode: String),
        importar_backup(app, user_id: i64, caminho: String),
        validar_backup(app, backup_id: i64),
        deletar_backup(app, backup_id: i64),
        get_backup_settings(app),
        update_backup_settings(app, settings: crate::backup::BackupSettings),
        executar_backup_automatico(app),
        salvar_logo(app, logo_base64: String),
        get_logo(app),
        rede_local_get(app),
        rede_local_set(app, config: crate::servidor_rede::RedeLocalConfig),
        importar_backup_base64(app, user_id: i64, nome_arquivo: String, dados_base64: String),
    );

    if comando == "logout" {
        if let Some(t) = token_web {
            remover_token(t);
        }
    }

    resultado
}

pub fn handle_rpc_sem_app(comando: &str, args: Value) -> Result<Value, String> {
    match comando {
        "salvar_arquivo_em" => {
            let a: ArgsSalvarArquivoEm = serde_json::from_value(camel_to_snake_keys(args))
                .map_err(|e| format!("Argumentos inválidos para salvar_arquivo_em: {}", e))?;
            crate::salvar_arquivo_em(a.caminho, a.conteudo).map(|_| Value::Null)
        }
        "log_frontend_error" => {
            let a: ArgsLogFrontendError = serde_json::from_value(camel_to_snake_keys(args))
                .map_err(|e| format!("Argumentos inválidos para log_frontend_error: {}", e))?;
            crate::log_frontend_error(a.message, a.stack).map(|_| Value::Null)
        }
        "get_ip_local" => {
            crate::get_ip_local().map(|v| Value::String(v))
        }
        "listar_ips_locais" => {
            crate::listar_ips_locais().map(|ips| Value::Array(ips.into_iter().map(Value::String).collect()))
        }
        _ => Err(format!("Comando desconhecido: {}", comando)),
    }
}