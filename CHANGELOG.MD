# Changelog

Todas as alterações notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.1.0] — 2026-07-18

### Adicionado
- **Sistema de Licenciamento** — Validação Ed25519 na inicialização do app (machine ID + assinatura + expiração).
- **GUI de Geração de Licenças** — Aplicativo desktop (egui/eframe) com interface gráfica, persistência de config e botão "Gerar + Salvar" com saída organizada em pastas por cliente.
- **Ícone no .exe** — Ícone shield-ok embutido via recurso Windows (winresource) — visível no Explorador de Arquivos.
- **Documentação Interna** — `docs-licenca/` com especificação, manual completo (MD/HTML/PDF), guia Cryptomator, decisões técnicas e progresso.

### Modificado
- **CLI movido** — Ferramenta de linha de comando movida para `C:\projetos\cli-cuidar-erp\` (repositório separado).
- **README atualizado** — Seção de licença corrigida para refletir validação em runtime.
- **Arquitetura** — `src-tauri/src/license.rs` adicionado ao diagrama.

### Removido
- **`cli/` do repositório principal** — Pasta removida (não versionada, movida para projeto separado).

## [1.0.0] — 2026-07-02

### Adicionado
- **Dashboard** — Visão geral institucional com indicadores-chave em tempo real.
- **Gestão de Alunos** — Cadastro, matrícula, dados pessoais, responsáveis, serviços vinculados e controle de status.
- **Turmas** — Organização por turno (manhã, tarde, integral) com alocação de alunos e funcionários.
- **Gestão de Funcionários** — Cargos, salários, escalas, alocação em turmas e controle de frequência.
- **Mensalidades** — Controle mensal de pagamentos com filtros e visão geral de status.
- **Financeiro** — Despesas, receitas, gastos fixos e resumos financeiros mensais.
- **Frequência** — Registro diário de frequência de alunos e funcionários.
- **Ocorrências** — Registro de ocorrências de alunos com categorização.
- **Relatórios** — Relatórios de alunos, frequência, financeiro e funcionários com exportação em PDF.
- **Autenticação** — Gerenciamento de sessão baseado em JWT com bcrypt.
- **Backups** — Backup manual e automático com funcionalidade de restauração.
- **Configurações** — Perfil da instituição, serviços cadastrados, gastos fixos e segurança.
- **Cache LRU** — Cache em memória com TTL de 60 minutos para dados do dashboard.
- **Geração Automática Mensal** — Criação automática de mensalidades, salários e gastos fixos ao acessar o dashboard do mês corrente.
- **Atalhos de Teclado** — Navegação rápida com `Ctrl+N`, `Ctrl+S`, `?`.
- **Onboarding Guiado** — Tour interativo para novos usuários.
- **Responsividade** — Layout adaptável para diferentes resoluções de tela.
- **Modo Offline** — Funcionamento completo sem necessidade de conexão com internet.

### Técnico
- **Stack:** Tauri 2 + Next.js 14 + React 18 + Tailwind CSS 3 + SQLite (rusqlite).
- **ORM:** Acesso direto a SQLite via rusqlite com prepared statements.
- **Migrações:** 14 migrações incrementais com versionamento.
- **Gerenciamento de Estado:** Zustand.
- **Componentes:** shadcn/ui + Lucide React.
- **Testes:** Cypress para testes end-to-end.
- **Instalador:** Tauri bundler para Windows (MSI/NSIS).
