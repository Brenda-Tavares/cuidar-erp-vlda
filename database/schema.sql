-- SQLite schema for ERP Instituição Educacional (desktop local)
-- Updated to match Tauri backend implementation
-- Version: 3 (with migrations support)

-- Table of users (for admin login)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hard TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','professor','pais')),
    last_login DATETIME,
    login_attempts_count INTEGER DEFAULT 0,
    locked_until DATETIME
);

-- Table of classrooms
CREATE TABLE IF NOT EXISTS turmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    ano INTEGER,
    turno TEXT,
    vagas INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativa',
    responsaveis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Table of students/children
CREATE TABLE IF NOT EXISTS alunos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    nome_responsavel TEXT NOT NULL,
    telefone_responsavel TEXT NOT NULL,
    telefone_responsavel_2 TEXT,
    status TEXT DEFAULT 'ativo',
    turma_id INTEGER,
    valor_mensalidade_override REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE SET NULL
);

-- Table of guardians/parents
CREATE TABLE IF NOT EXISTS responsaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT,
    telefone TEXT,
    email TEXT
);

-- Table of student-guardian relationships
CREATE TABLE IF NOT EXISTS crianca_responsaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    responsavel_id INTEGER NOT NULL,
    parentesco TEXT,
    principal BOOLEAN DEFAULT 0,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (responsavel_id) REFERENCES responsaveis(id) ON DELETE CASCADE
);

-- Table of enrollments (historical record)
CREATE TABLE IF NOT EXISTS matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    turma_id INTEGER NOT NULL,
    data_matricula TEXT,
    status TEXT,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
);

-- Table of monthly fees/tuition
CREATE TABLE IF NOT EXISTS mensalidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    vencimento TEXT NOT NULL,
    valor REAL NOT NULL,
    pago INTEGER DEFAULT 0,
    data_pagamento TEXT,
    forma_pagamento TEXT CHECK (forma_pagamento IN ('pix','cartao_credito','cartao_debito','dinheiro','transferencia','boleto')),
    deleted_at DATETIME,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Table of attendance records
CREATE TABLE IF NOT EXISTS frequencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    presente INTEGER,
    tipo_justificativa TEXT CHECK (tipo_justificativa IN ('atestado_medico','falecimento_parentes','situacoes_circunstanciais','outros',NULL)),
    justificativa TEXT,
    deleted_at DATETIME,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Table of class-level attendance records (aggregated)
CREATE TABLE IF NOT EXISTS frequencia_registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turma_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    registros TEXT NOT NULL,
    deleted_at DATETIME,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
);

-- Table of incidents/occurrences
CREATE TABLE IF NOT EXISTS ocorrencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT,
    deleted_at DATETIME,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Table of employee positions/roles
CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    salario_base REAL,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Table of work schedules/shifts
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

-- Table of employees/staff
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

-- Table of employee-class assignments (many-to-many)
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

-- Table of employee attendance records
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

-- Table of fixed expenses (Gastos Fixos Editáveis)
CREATE TABLE IF NOT EXISTS gastos_fixos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    valor_padrao REAL NOT NULL,
    valor_atual REAL NOT NULL,
    mes TEXT NOT NULL,
    descricao TEXT,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
    editavel BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE(nome, mes)
);

-- Table of company expenses (Despesas da Empresa)
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

-- Table of company revenues (Receitas da Empresa)
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

-- Table of generic configuration (key-value)
CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT
);

-- Table of daycare configuration (singleton)
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
    valor_padrao_mensalidade REAL DEFAULT 0,
    dia_vencimento INTEGER DEFAULT 5 CHECK (dia_vencimento BETWEEN 1 AND 28),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table of schema migrations (for versioning)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table of audit log (action tracking)
CREATE TABLE IF NOT EXISTS audit_log (
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
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_alunos_turma ON alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_crianca_responsavel_aluno ON crianca_responsaveis(aluno_id);
CREATE INDEX IF NOT EXISTS idx_crianca_responsavel_responsavel ON crianca_responsaveis(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON matriculas(turma_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno ON mensalidades(aluno_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_vencimento ON mensalidades(vencimento);
CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno_vencimento ON mensalidades(aluno_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno ON frequencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_data ON frequencias(data);
CREATE INDEX IF NOT EXISTS idx_frequencia_registros_turma ON frequencia_registros(turma_id);
CREATE INDEX IF NOT EXISTS idx_frequencia_registros_data ON frequencia_registros(data);
CREATE INDEX IF NOT EXISTS idx_frequencia_registros_turma_data ON frequencia_registros(turma_id, data);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno ON ocorrencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON alunos(status);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_status ON funcionarios(status);
CREATE INDEX IF NOT EXISTS idx_funcionario_turmas_funcionario ON funcionario_turmas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_funcionario_turmas_turma ON funcionario_turmas(turma_id);
CREATE INDEX IF NOT EXISTS idx_frequencia_funcionarios_funcionario ON frequencia_funcionarios(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_frequencia_funcionarios_data ON frequencia_funcionarios(data);
CREATE INDEX IF NOT EXISTS idx_cargos_status ON cargos(status);
CREATE INDEX IF NOT EXISTS idx_escala_trabalho_status ON escala_trabalho(status);
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
CREATE INDEX IF NOT EXISTS idx_aluno_servicos_servico ON aluno_servicos(servico_id);

-- Table of user sessions (JWT-based auth)
CREATE TABLE IF NOT EXISTS user_sessions (
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
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

-- Table of database backups
CREATE TABLE IF NOT EXISTS database_backups (
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
    backup_interval_hours INTEGER DEFAULT 24,
    retention_days INTEGER DEFAULT 30,
    backup_path TEXT,
    last_backup_at DATETIME,
    next_backup_at DATETIME
);

INSERT OR IGNORE INTO backup_settings (auto_backup_enabled, backup_interval_hours, retention_days)
VALUES (1, 24, 30);

CREATE INDEX IF NOT EXISTS idx_backups_created ON database_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_type ON database_backups(backup_type);

-- Table of services catalog
CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    valor_padrao REAL NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'creche' CHECK (tipo IN ('creche', 'interno')),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Table of student-service assignments
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
