
use rusqlite::{Connection, Result as SqlResult, params};


#[allow(dead_code)]
const CURRENT_SCHEMA_VERSION: i32 = 21;

pub fn get_schema_version(conn: &Connection) -> SqlResult<i32> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )
}

pub fn record_migration(conn: &Connection, version: i32, name: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        [version.to_string().as_str(), name],
    )?;
    Ok(())
}

pub fn init_migrations_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
    )?;
    Ok(())
}

pub fn apply_migrations(conn: &Connection) -> SqlResult<()> {
    init_migrations_table(conn)?;
    let current_version = get_schema_version(conn)?;

    if current_version < 1 {
        apply_migration_001(conn)?;
        record_migration(conn, 1, "001_initial_schema")?;
    }

    if current_version < 2 {
        apply_migration_002(conn)?;
        record_migration(conn, 2, "002_add_status_columns")?;
    }

    if current_version < 3 {
        apply_migration_003(conn)?;
        record_migration(conn, 3, "003_add_timestamps")?;
    }

    if current_version < 4 {
        apply_migration_004(conn)?;
        record_migration(conn, 4, "004_add_audit_log")?;
    }

    if current_version < 5 {
        apply_migration_005(conn)?;
        record_migration(conn, 5, "005_auth_security")?;
    }

    if current_version < 6 {
        apply_migration_006(conn)?;
        record_migration(conn, 6, "006_backup_tables")?;
    }

    if current_version < 7 {
        apply_migration_007(conn)?;
        record_migration(conn, 7, "007_employee_financial_service_tables")?;
    }

    if current_version < 8 {
        apply_migration_008(conn)?;
        record_migration(conn, 8, "008_add_deleted_at_columns")?;
    }

    if current_version < 9 {
        apply_migration_009(conn)?;
        record_migration(conn, 9, "009_add_tipo_to_servicos")?;
    }

    if current_version < 10 {
        apply_migration_010(conn)?;
        record_migration(conn, 10, "010_add_financial_columns_to_creche")?;
    }

    if current_version < 11 {
        apply_migration_011(conn)?;
        record_migration(conn, 11, "011_add_valor_mensalidade_override_to_alunos")?;
    }

    if current_version < 12 {
        apply_migration_012(conn)?;
        record_migration(conn, 12, "012_add_unique_index_to_mensalidades")?;
    }

    if current_version < 13 {
        apply_migration_013(conn)?;
        record_migration(conn, 13, "013_add_pagamentos_salarios")?;
    }

    if current_version < 14 {
        apply_migration_014(conn)?;
        record_migration(conn, 14, "014_fix_gastos_fixos_unique")?;
    }

    if current_version < 15 {
        apply_migration_015(conn)?;
        record_migration(conn, 15, "015_add_taxa_matricula_to_creche")?;
    }

    if current_version < 16 {
        apply_migration_016(conn)?;
        record_migration(conn, 16, "016_seed_default_data")?;
    }

    if current_version < 17 {
        apply_migration_017(conn)?;
        record_migration(conn, 17, "017_monthly_backup_interval")?;
    }

    if current_version < 18 {
        apply_migration_018(conn)?;
        record_migration(conn, 18, "018_unique_frequencia_registros_index")?;
    }

    if current_version < 19 {
        apply_migration_019(conn)?;
        record_migration(conn, 19, "019_add_taxa_matricula_to_mensalidades")?;
    }

    if current_version < 20 {
        apply_migration_020(conn)?;
        record_migration(conn, 20, "020_add_numero_matricula_to_alunos")?;
    }

    if current_version < 21 {
        apply_migration_021(conn)?;
        record_migration(conn, 21, "021_add_dia_vencimento_to_alunos")?;
    }

    Ok(())
}

fn apply_migration_012(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_mensalidades_aluno_vencimento ON mensalidades(aluno_id, vencimento) WHERE deleted_at IS NULL",
        params![]
    )?;
    Ok(())
}

fn apply_migration_013(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS pagamentos_salarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            funcionario_id INTEGER NOT NULL,
            mes TEXT NOT NULL,
            valor REAL NOT NULL,
            pago INTEGER DEFAULT 0,
            data_pagamento TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_salarios_func_mes
            ON pagamentos_salarios(funcionario_id, mes) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_pagamentos_salarios_funcionario ON pagamentos_salarios(funcionario_id);
        CREATE INDEX IF NOT EXISTS idx_pagamentos_salarios_mes ON pagamentos_salarios(mes);"
    )?;
    Ok(())
}

fn apply_migration_014(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS gastos_fixos_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor_padrao REAL NOT NULL,
            valor_atual REAL NOT NULL,
            mes TEXT NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            editavel INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        );
        INSERT OR IGNORE INTO gastos_fixos_new SELECT * FROM gastos_fixos;
        DROP TABLE gastos_fixos;
        ALTER TABLE gastos_fixos_new RENAME TO gastos_fixos;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_gastos_fixos_nome_mes
            ON gastos_fixos(nome, mes) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_gastos_fixos_mes ON gastos_fixos(mes);"
    )?;
    Ok(())
}

fn apply_migration_015(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE creche ADD COLUMN taxa_matricula REAL DEFAULT 0",
        params![]
    )?;
    Ok(())
}

fn apply_migration_016(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "INSERT OR IGNORE INTO creche (id, nome, endereco, cidade, estado, telefone, onboarding_completo, taxa_matricula)
         VALUES (1, 'Vila do Aprender', '', '', '', '(71) 9 9175-2272', 1, 100.0);

         INSERT OR IGNORE INTO servicos (nome, descricao, valor_padrao, tipo, status) VALUES
             ('Contraturno (Sem almoço e sem banho)', 'Mensalidade contraturno sem alimentação e sem banho', 600.00, 'creche', 'ativo'),
             ('Contraturno + Almoço (Sem banho)', 'Mensalidade contraturno com almoço sem banho', 700.00, 'creche', 'ativo'),
             ('Contraturno + Almoço + Banho', 'Mensalidade contraturno completa', 800.00, 'creche', 'ativo'),
             ('Diária com almoço', 'Diária com alimentação incluída', 89.00, 'creche', 'ativo'),
             ('Diária sem almoço', 'Diária sem alimentação', 69.00, 'creche', 'ativo'),
             ('Taxa de Material Escolar', 'Taxa única de material escolar', 140.00, 'creche', 'ativo'),
             ('Uniforme (Camisa + Short)', 'Kit uniforme completo', 120.00, 'creche', 'ativo');"
    )?;
    Ok(())
}

fn apply_migration_017(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "UPDATE backup_settings SET backup_interval_hours = 720 WHERE id = 1",
        params![]
    )?;
    Ok(())
}

fn apply_migration_018(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "UPDATE frequencia_registros
         SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
         WHERE deleted_at IS NULL
           AND id NOT IN (
               SELECT MIN(id) FROM frequencia_registros
               WHERE deleted_at IS NULL
               GROUP BY turma_id, data
           )",
        params![]
    )?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_frequencia_registros_turma_data
            ON frequencia_registros(turma_id, data) WHERE deleted_at IS NULL",
        params![]
    )?;
    Ok(())
}

fn apply_migration_019(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE mensalidades ADD COLUMN taxa_matricula REAL DEFAULT 0",
        params![]
    )?;
    Ok(())
}

fn apply_migration_020(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE alunos ADD COLUMN numero_matricula TEXT",
        params![]
    )?;

    let ids: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM alunos ORDER BY id")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE alunos SET numero_matricula = ?1 WHERE id = ?2",
            params![format!("{:02}", i + 1), id],
        )?;
    }

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_numero_matricula ON alunos(numero_matricula) WHERE deleted_at IS NULL",
        params![]
    )?;
    Ok(())
}

fn apply_migration_021(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE alunos ADD COLUMN dia_vencimento INTEGER",
        params![]
    )?;
    Ok(())
}

fn apply_migration_007(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            salario_base REAL,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS escala_trabalho (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            dias_semana TEXT NOT NULL,
            hora_entrada TEXT NOT NULL,
            hora_saida TEXT NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_completo TEXT NOT NULL,
            nome_social TEXT,
            cpf TEXT UNIQUE,
            telefone TEXT NOT NULL,
            telefone_secundario TEXT,
            email TEXT UNIQUE,
            salario REAL NOT NULL,
            cargo_id INTEGER NOT NULL,
            escala_trabalho_id INTEGER,
            contato_emergencia TEXT,
            telefone_emergencia TEXT,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY (cargo_id) REFERENCES cargos(id) ON DELETE RESTRICT,
            FOREIGN KEY (escala_trabalho_id) REFERENCES escala_trabalho(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS funcionario_turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            funcionario_id INTEGER NOT NULL,
            turma_id INTEGER NOT NULL,
            data_inicio DATE NOT NULL,
            data_fim DATE,
            UNIQUE(funcionario_id, turma_id),
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE,
            FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS frequencia_funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            funcionario_id INTEGER NOT NULL,
            data DATE NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('presente','ausente','falta_justificada')),
            justificativa TEXT,
            tipo_justificativa TEXT CHECK (tipo_justificativa IN ('atestado_medico','falecimento_parentes','situacoes_circunstanciais','outros',NULL)),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            UNIQUE(funcionario_id, data),
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS gastos_fixos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor_padrao REAL NOT NULL,
            valor_atual REAL NOT NULL,
            mes TEXT NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            editavel INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            UNIQUE(nome, mes)
        );
        CREATE TABLE IF NOT EXISTS company_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria TEXT NOT NULL,
            descricao TEXT,
            valor REAL NOT NULL,
            data_despesa DATE NOT NULL,
            data_pagamento DATE,
            forma_pagamento TEXT CHECK (forma_pagamento IN ('pix','cartao_credito','cartao_debito','dinheiro','transferencia','boleto',NULL)),
            funcionario_id INTEGER,
            status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
            comprovante_path TEXT,
            notas TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS company_revenues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria TEXT NOT NULL,
            descricao TEXT,
            valor REAL NOT NULL,
            data_receita DATE NOT NULL,
            data_recebimento DATE,
            forma_recebimento TEXT CHECK (forma_recebimento IN ('pix','cartao_credito','cartao_debito','dinheiro','transferencia','boleto',NULL)),
            status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
            comprovante_path TEXT,
            notas TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS servicos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            valor_padrao REAL NOT NULL,
            status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS aluno_servicos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER NOT NULL,
            servico_id INTEGER NOT NULL,
            valor_acordado REAL,
            data_inicio DATE NOT NULL,
            data_fim DATE,
            deleted_at DATETIME,
            FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
            FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_cargos_status ON cargos(status);
        CREATE INDEX IF NOT EXISTS idx_escala_trabalho_status ON escala_trabalho(status);
        CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo_id);
        CREATE INDEX IF NOT EXISTS idx_funcionarios_status ON funcionarios(status);
        CREATE INDEX IF NOT EXISTS idx_funcionario_turmas_funcionario ON funcionario_turmas(funcionario_id);
        CREATE INDEX IF NOT EXISTS idx_funcionario_turmas_turma ON funcionario_turmas(turma_id);
        CREATE INDEX IF NOT EXISTS idx_frequencia_funcionarios_funcionario ON frequencia_funcionarios(funcionario_id);
        CREATE INDEX IF NOT EXISTS idx_frequencia_funcionarios_data ON frequencia_funcionarios(data);
        CREATE INDEX IF NOT EXISTS idx_gastos_fixos_status ON gastos_fixos(status);
        CREATE INDEX IF NOT EXISTS idx_gastos_fixos_mes ON gastos_fixos(mes);
        CREATE INDEX IF NOT EXISTS idx_company_expenses_categoria ON company_expenses(categoria);
        CREATE INDEX IF NOT EXISTS idx_company_expenses_data ON company_expenses(data_despesa);
        CREATE INDEX IF NOT EXISTS idx_company_expenses_status ON company_expenses(status);
        CREATE INDEX IF NOT EXISTS idx_company_expenses_funcionario ON company_expenses(funcionario_id);
        CREATE INDEX IF NOT EXISTS idx_company_revenues_categoria ON company_revenues(categoria);
        CREATE INDEX IF NOT EXISTS idx_company_revenues_data ON company_revenues(data_receita);
        CREATE INDEX IF NOT EXISTS idx_company_revenues_status ON company_revenues(status);
        CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);
        CREATE INDEX IF NOT EXISTS idx_aluno_servicos_aluno ON aluno_servicos(aluno_id);
        CREATE INDEX IF NOT EXISTS idx_aluno_servicos_servico ON aluno_servicos(servico_id);"
    )?;

    let _ = conn.execute("ALTER TABLE frequencias ADD COLUMN tipo_justificativa TEXT CHECK (tipo_justificativa IN ('atestado_medico','falecimento_parentes','situacoes_circunstanciais','outros',NULL))", []);
    let _ = conn.execute("ALTER TABLE frequencias ADD COLUMN justificativa TEXT", []);

    Ok(())
}

fn apply_migration_008(conn: &Connection) -> SqlResult<()> {
    let tables = [
        "alunos", "turmas", "responsaveis", "crianca_responsaveis",
        "matriculas", "mensalidades", "frequencias", "frequencia_registros",
        "ocorrencias", "users", "configuracoes", "creche",
    ];
    for table in tables {
        let _ = conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN deleted_at DATETIME", table),
            [],
        );
    }
    Ok(())
}

fn apply_migration_001(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            data_nascimento DATE NOT NULL,
            nome_responsavel TEXT NOT NULL,
            telefone_responsavel TEXT NOT NULL,
            telefone_responsavel_2 TEXT,
            status TEXT DEFAULT 'ativo',
            turma_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            ano INTEGER,
            turno TEXT,
            vagas INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ativa',
            responsaveis TEXT
        );
        CREATE TABLE IF NOT EXISTS responsaveis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT,
            email TEXT,
            cpf TEXT
        );
        CREATE TABLE IF NOT EXISTS crianca_responsaveis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            responsavel_id INTEGER,
            parentesco TEXT
        );
        CREATE TABLE IF NOT EXISTS matriculas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            turma_id INTEGER,
            data_matricula TEXT,
            status TEXT
        );
        CREATE TABLE IF NOT EXISTS mensalidades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            vencimento TEXT,
            valor REAL,
            pago INTEGER DEFAULT 0,
            data_pagamento TEXT,
            forma_pagamento TEXT
        );
        CREATE TABLE IF NOT EXISTS frequencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            data TEXT,
            presente INTEGER
        );
        CREATE TABLE IF NOT EXISTS frequencia_registros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            turma_id INTEGER,
            data TEXT,
            registros TEXT
        );
        CREATE TABLE IF NOT EXISTS ocorrencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            data TEXT,
            descricao TEXT,
            tipo TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hard TEXT,
            role TEXT
        );
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT
        );
        CREATE TABLE IF NOT EXISTS creche (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            nome TEXT NOT NULL,
            cnpj TEXT,
            endereco TEXT NOT NULL,
            numero TEXT,
            bairro TEXT,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL,
            telefone TEXT,
            email TEXT,
            senha_admin TEXT,
            onboarding_completo BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );"
    )?;
    Ok(())
}

fn apply_migration_002(conn: &Connection) -> SqlResult<()> {
    let _ = conn.execute("ALTER TABLE turmas ADD COLUMN status TEXT DEFAULT 'ativa'", params![]);
    let _ = conn.execute("ALTER TABLE turmas ADD COLUMN responsaveis TEXT", params![]);
    let _ = conn.execute("ALTER TABLE alunos ADD COLUMN turma_id INTEGER", params![]);
    let _ = conn.execute("ALTER TABLE crianca_responsaveis ADD COLUMN parentesco TEXT", params![]);
    let _ = conn.execute("ALTER TABLE turmas ADD COLUMN vagas INTEGER DEFAULT 0", params![]);
    let _ = conn.execute("ALTER TABLE alunos ADD COLUMN telefone_responsavel_2 TEXT", params![]);
    Ok(())
}

fn apply_migration_003(conn: &Connection) -> SqlResult<()> {
    let _ = conn.execute("ALTER TABLE alunos ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", params![]);
    let _ = conn.execute("ALTER TABLE turmas ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", params![]);
    let _ = conn.execute("ALTER TABLE creche ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", params![]);
    Ok(())
}

fn apply_migration_004(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            action TEXT NOT NULL,
            table_name TEXT,
            record_id INTEGER,
            old_values TEXT,
            new_values TEXT,
            description TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);"
    )?;
    Ok(())
}

fn apply_migration_005(conn: &Connection) -> SqlResult<()> {
    let _ = conn.execute("ALTER TABLE users ADD COLUMN last_login DATETIME", params![]);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN login_attempts_count INTEGER DEFAULT 0", params![]);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN locked_until DATETIME", params![]);

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            refresh_token_hash TEXT UNIQUE,
            ip_address TEXT,
            user_agent TEXT,
            device_info TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS two_factor_auth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            secret_key TEXT NOT NULL,
            is_enabled INTEGER DEFAULT 0,
            backup_codes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            enabled_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            ip_address TEXT,
            success INTEGER NOT NULL,
            failure_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
        CREATE INDEX IF NOT EXISTS idx_2fa_user ON two_factor_auth(user_id);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);"
    )?;
    Ok(())
}

fn apply_migration_006(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS database_backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            backup_type TEXT NOT NULL DEFAULT 'manual',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            is_valid INTEGER DEFAULT 1,
            notes TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS backup_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auto_backup_enabled INTEGER DEFAULT 1,
            backup_interval_hours INTEGER DEFAULT 720,
            retention_days INTEGER DEFAULT 30,
            backup_path TEXT,
            last_backup_at DATETIME,
            next_backup_at DATETIME
        );
        INSERT OR IGNORE INTO backup_settings (id, auto_backup_enabled, backup_interval_hours, retention_days)
        VALUES (1, 1, 720, 30);
        CREATE INDEX IF NOT EXISTS idx_backups_created ON database_backups(created_at);
        CREATE INDEX IF NOT EXISTS idx_backups_type ON database_backups(backup_type);"
    )?;
    Ok(())
}

fn apply_migration_009(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE servicos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'creche' CHECK (tipo IN ('creche', 'interno'))",
        params![]
    )?;
    Ok(())
}

fn apply_migration_010(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE creche ADD COLUMN valor_padrao_mensalidade REAL DEFAULT 0",
        params![]
    )?;
    conn.execute(
        "ALTER TABLE creche ADD COLUMN dia_vencimento INTEGER DEFAULT 5 CHECK (dia_vencimento BETWEEN 1 AND 28)",
        params![]
    )?;
    Ok(())
}

fn apply_migration_011(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "ALTER TABLE alunos ADD COLUMN valor_mensalidade_override REAL",
        params![]
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn expected_tables() -> Vec<&'static str> {
        vec![
            "alunos", "turmas", "responsaveis", "crianca_responsaveis",
            "matriculas", "mensalidades", "frequencias", "frequencia_registros",
            "ocorrencias", "users", "configuracoes", "creche",
            "schema_migrations",
            "audit_log",
            "user_sessions", "two_factor_auth", "login_attempts",
            "database_backups", "backup_settings",
            "cargos", "escala_trabalho", "funcionarios", "funcionario_turmas",
            "frequencia_funcionarios", "gastos_fixos", "company_expenses",
            "company_revenues", "servicos", "aluno_servicos",
        ]
    }

    fn get_table_names(conn: &Connection) -> Vec<String> {
        conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).unwrap()
            .query_map([], |row| row.get(0)).unwrap()
            .filter_map(Result::ok)
            .collect()
    }

    fn table_exists(conn: &Connection, name: &str) -> bool {
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
            params![name],
            |row| row.get(0),
        ).unwrap_or(0);
        count > 0
    }

    fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
        let cols: Vec<String> = conn.prepare(
            &format!("PRAGMA table_info({})", table)
        ).unwrap()
            .query_map([], |row| row.get(1)).unwrap()
            .filter_map(Result::ok)
            .collect();
        cols.contains(&column.to_string())
    }

    #[test]
    fn test_fresh_db_creates_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        let tables = get_table_names(&conn);
        for expected in expected_tables() {
            assert!(tables.contains(&expected.to_string()),
                "Tabela '{}' não foi criada. Tables: {:?}", expected, tables);
        }
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();
        let version_after_first = get_schema_version(&conn).unwrap();

        let result = apply_migrations(&conn);
        assert!(result.is_ok(), "Segunda execução de migrations falhou: {:?}", result);

        let version_after_second = get_schema_version(&conn).unwrap();
        assert_eq!(version_after_first, version_after_second,
            "Versão mudou após re-aplicar: {} -> {}", version_after_first, version_after_second);
    }

    #[test]
    fn test_schema_version_is_current() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, CURRENT_SCHEMA_VERSION,
            "Schema version {} should match CURRENT_SCHEMA_VERSION {}", version, CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn test_apply_migrations_from_scratch() {
        let conn = Connection::open_in_memory().unwrap();
        let result = apply_migrations(&conn);
        assert!(result.is_ok(), "apply_migrations from scratch failed: {:?}", result);

        let version = get_schema_version(&conn).unwrap();
        assert!(version > 0, "Version should be > 0 after migrations");
    }

    #[test]
    fn test_migration_001_tables_have_required_columns() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        assert!(column_exists(&conn, "alunos", "nome"));
        assert!(column_exists(&conn, "alunos", "data_nascimento"));
        assert!(column_exists(&conn, "alunos", "status"));
        assert!(column_exists(&conn, "turmas", "nome"));
        assert!(column_exists(&conn, "turmas", "status"));
        assert!(column_exists(&conn, "users", "username"));
        assert!(column_exists(&conn, "users", "password_hard"));
        assert!(column_exists(&conn, "creche", "nome"));
        assert!(column_exists(&conn, "creche", "onboarding_completo"));
    }

    #[test]
    fn test_migration_004_audit_log_has_all_columns() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        assert!(table_exists(&conn, "audit_log"), "audit_log table missing");
        assert!(column_exists(&conn, "audit_log", "action"));
        assert!(column_exists(&conn, "audit_log", "table_name"));
        assert!(column_exists(&conn, "audit_log", "record_id"));
        assert!(column_exists(&conn, "audit_log", "old_values"));
        assert!(column_exists(&conn, "audit_log", "new_values"));
        assert!(column_exists(&conn, "audit_log", "description"));
        assert!(column_exists(&conn, "audit_log", "created_at"));
        assert!(column_exists(&conn, "audit_log", "user_id"));
        assert!(column_exists(&conn, "audit_log", "username"));
    }

    #[test]
    fn test_foreign_keys_are_enabled() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        apply_migrations(&conn).unwrap();

        let fk_status: bool = conn.query_row(
            "PRAGMA foreign_keys",
            [],
            |row| row.get(0),
        ).unwrap_or(false);
        assert!(fk_status, "Foreign keys should be enabled");
    }

    #[test]
    fn test_create_all_tables_twice_no_error() {
        let conn = Connection::open_in_memory().unwrap();

        for _ in 0..2 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS alunos (id INTEGER PRIMARY KEY, nome TEXT);
                 CREATE TABLE IF NOT EXISTS turmas (id INTEGER PRIMARY KEY, nome TEXT);"
            ).unwrap();
        }
    }

    #[test]
    fn test_migration_006_creates_backup_tables() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        assert!(table_exists(&conn, "database_backups"), "database_backups table missing");
        assert!(table_exists(&conn, "backup_settings"), "backup_settings table missing");

        assert!(column_exists(&conn, "database_backups", "filename"));
        assert!(column_exists(&conn, "database_backups", "file_path"));
        assert!(column_exists(&conn, "database_backups", "file_size"));
        assert!(column_exists(&conn, "database_backups", "checksum"));
        assert!(column_exists(&conn, "database_backups", "backup_type"));
        assert!(column_exists(&conn, "database_backups", "created_at"));
        assert!(column_exists(&conn, "database_backups", "is_valid"));

        assert!(column_exists(&conn, "backup_settings", "auto_backup_enabled"));
        assert!(column_exists(&conn, "backup_settings", "backup_interval_hours"));
        assert!(column_exists(&conn, "backup_settings", "retention_days"));

        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM backup_settings",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1, "Default backup_settings row should exist");
    }

    #[test]
    fn test_migration_007_creates_employee_financial_service_tables() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        assert!(table_exists(&conn, "cargos"), "cargos table missing");
        assert!(table_exists(&conn, "escala_trabalho"), "escala_trabalho table missing");
        assert!(table_exists(&conn, "funcionarios"), "funcionarios table missing");
        assert!(table_exists(&conn, "funcionario_turmas"), "funcionario_turmas table missing");
        assert!(table_exists(&conn, "frequencia_funcionarios"), "frequencia_funcionarios table missing");
        assert!(table_exists(&conn, "gastos_fixos"), "gastos_fixos table missing");
        assert!(table_exists(&conn, "company_expenses"), "company_expenses table missing");
        assert!(table_exists(&conn, "company_revenues"), "company_revenues table missing");
        assert!(table_exists(&conn, "servicos"), "servicos table missing");
        assert!(table_exists(&conn, "aluno_servicos"), "aluno_servicos table missing");

        assert!(column_exists(&conn, "cargos", "nome"));
        assert!(column_exists(&conn, "funcionarios", "nome_completo"));
        assert!(column_exists(&conn, "funcionarios", "cargo_id"));
        assert!(column_exists(&conn, "funcionario_turmas", "funcionario_id"));
        assert!(column_exists(&conn, "funcionario_turmas", "turma_id"));
        assert!(column_exists(&conn, "frequencia_funcionarios", "status"));
        assert!(column_exists(&conn, "gastos_fixos", "nome"));
        assert!(column_exists(&conn, "gastos_fixos", "valor_atual"));
        assert!(column_exists(&conn, "company_expenses", "categoria"));
        assert!(column_exists(&conn, "company_revenues", "categoria"));
        assert!(column_exists(&conn, "servicos", "nome"));
        assert!(column_exists(&conn, "aluno_servicos", "aluno_id"));
        assert!(column_exists(&conn, "aluno_servicos", "servico_id"));

        assert!(column_exists(&conn, "frequencias", "tipo_justificativa"),
            "tipo_justificativa column should exist on frequencias");
        assert!(column_exists(&conn, "frequencias", "justificativa"),
            "justificativa column should exist on frequencias");
    }

    #[test]
    fn test_migration_008_adds_deleted_at_to_all_base_tables() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        let base_tables = [
            "alunos", "turmas", "responsaveis", "crianca_responsaveis",
            "matriculas", "mensalidades", "frequencias", "frequencia_registros",
            "ocorrencias", "users", "configuracoes", "creche",
        ];
        for table in &base_tables {
            assert!(column_exists(&conn, table, "deleted_at"),
                "{} should have deleted_at column after migration 008", table);
        }
    }

    #[test]
    fn test_migration_018_deduplicates_and_adds_unique_indexes() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        conn.execute("DROP INDEX idx_frequencia_registros_turma_data", []).unwrap();

        conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (1, '2026-01-01', '[]')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (1, '2026-01-01', '[dup]')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (1, '2026-01-02', '[]')",
            [],
        ).unwrap();

        apply_migration_018(&conn).unwrap();

        let active_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM frequencia_registros WHERE deleted_at IS NULL",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(active_count, 2, "Duplicate should have been soft-deleted");

        let dup_result = conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (1, '2026-01-02', '[]')",
            [],
        );
        assert!(dup_result.is_err(), "Unique index should reject duplicate active record");

        conn.execute(
            "UPDATE frequencia_registros SET deleted_at = CURRENT_TIMESTAMP WHERE data = '2026-01-02'",
            [],
        ).unwrap();
        let reinsert = conn.execute(
            "INSERT INTO frequencia_registros (turma_id, data, registros) VALUES (1, '2026-01-02', '[]')",
            [],
        );
        assert!(reinsert.is_ok(), "Reinsert after soft-delete should succeed");
    }

    #[test]
    fn test_migration_020_adds_sequential_numero_matricula() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();

        conn.execute(
            "INSERT INTO alunos (nome, data_nascimento, nome_responsavel, telefone_responsavel, status) VALUES
             ('Aluno A', '2020-01-01', 'Resp', '1', 'ativo'),
             ('Aluno B', '2020-01-02', 'Resp', '2', 'ativo'),
             ('Aluno C', '2020-01-03', 'Resp', '3', 'ativo')",
            [],
        ).unwrap();

        conn.execute("DROP INDEX idx_alunos_numero_matricula", []).unwrap();
        conn.execute("ALTER TABLE alunos DROP COLUMN numero_matricula", []).unwrap();

        apply_migration_020(&conn).unwrap();

        let nums: Vec<String> = {
            let mut stmt = conn.prepare("SELECT numero_matricula FROM alunos ORDER BY id").unwrap();
            stmt.query_map([], |r| r.get(0)).unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        assert_eq!(nums, vec!["01", "02", "03"]);

        conn.execute("INSERT INTO alunos (nome, data_nascimento, nome_responsavel, telefone_responsavel, status) VALUES ('Aluno D', '2020-01-04', 'Resp', '4', 'ativo')", []).unwrap();
        assert!(column_exists(&conn, "alunos", "numero_matricula"));
    }
}
