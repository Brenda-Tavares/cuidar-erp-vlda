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
);
