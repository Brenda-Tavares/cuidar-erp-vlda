# Cuidar ERP - Vila do Aprender

Sistema desktop de gestão para instituições educacionais, com arquitetura offline-first.
Construído como aplicação desktop nativa com backend em **Rust** sobre o framework
**Tauri 2** e frontend em **TypeScript / React**, com dados persistidos em um banco
**SQLite embutido**. Desenvolvido e entregue sob demanda para uma única instituição
em Salvador, Bahia.

> **Projeto de portfólio.** Este repositório é a versão pública e saneada de um projeto
> comercial. Credenciais, documentação interna, chaves privadas e dados do cliente foram
> removidos. Nada aqui permite forjar licenças ou recuperar segredos de produção.

---

## Sumário

- [Contexto](#contexto)
- [O problema](#o-problema)
- [A solução](#a-solução)
- [Resultado](#resultado)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Modelo de segurança](#modelo-de-segurança)
- [Módulos funcionais](#módulos-funcionais)
- [Panorama do código](#panorama-do-código)
- [Compilação a partir do código](#compilação-a-partir-do-código)
- [Testes](#testes)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Licença](#licença)
- [Autora](#autora)

---

## Contexto

O projeto foi encomendado como software proprietário, sob demanda, por uma única instituição
de educação infantil. O conjunto de restrições definido pelo cliente era incomum para um
sistema de gestão: a pessoa responsável pela rotina administrativa não tem formação
técnica, a instituição não possui infraestrutura de TI própria, e o software não pode
depender de um serviço externo que possa deixar de ser pago.

O produto foi portanto desenhado em torno de quatro requisitos inegociáveis:

1. Precisar rodar inteiramente em uma única máquina Windows e continuar funcionando sem
   internet.
2. Não consumir recursos relevantes de hardware, porque roda em equipamentos compartilhados
   ao lado das rotinas da instituição.
3. Precisar ser operável por pessoa não técnica sem treinamento.
4. Não expor dados de alunos, funcionários ou financeiro a terceiros.

---

## O problema

Sistemas genéricos de gestão escolar pressupõem um departamento de TI. Esta instituição não
tinha nenhum. As alternativas eram:

- Um produto SaaS em nuvem, que colocaria dados pessoais de crianças e funcionários em
  servidor de terceiros e criaria um custo mensal permanente para um serviço que só precisa
  registrar presença e mensalidades.
- Uma planilha, que não garante integridade de dados, não produz relatórios confiáveis e
  perde o histórico de versões.
- Uma aplicação web, que exige servidor, domínio e alguém responsável por ambos.

As três falham no mesmo eixo: pressupõem um operador tecnicamente capaz. O operador real é
uma coordenadora pedagógica.

---

## A solução

Uma aplicação desktop nativa que elimina o servidor. Não há backend para hospedar, domínio
para renovar nem conta para criar. O processo é iniciado, abre uma janela local e lê um
arquivo local.

As consequências de projeto foram específicas:

- **Shell nativo em vez de navegador.** O Tauri renderiza um frontend web, mas o executa no
  próprio webview do sistema operacional, o que mantém o tamanho da instalação e a memória
  residente muito abaixo de uma aplicação Electron, ainda permitindo uma stack frontend
  moderna.
- **SQLite compilado dentro do binário.** O motor de banco é ligado estaticamente, de modo
  que não há servidor de banco, serviço a instalar nem porta a abrir.
- **Dados fora do diretório de instalação.** O banco fica na pasta de dados da aplicação em
  nível de máquina, então atualizar o programa ou desinstalá-lo nunca atinge os registros
  da instituição.
- **Modelo de comandos em camadas.** Todo acesso a dados é exposto como comando tipado
  invocado pela ponte de IPC. O frontend não tem caminho direto para o banco.
- **Servidor local embutido.** Opcional, desabilitado por padrão, vinculado apenas a
  interfaces locais, para que a aplicação possa ser acessada por um celular ou tablet na
  mesma rede sem expor nada à internet.

---

## Resultado

Uma aplicação desktop de instalação única que cobre a rotina administrativa da instituição:
matrícula e registros de matrícula de alunos, gestão de turmas, frequência, cobrança de
mensalidades, gestão de funcionários com controle de acesso por perfil, registros de
ocorrências, serviços adicionais cobrados por aluno, despesas fixas, controle de receitas e
despesas, e um conjunto de relatórios exportáveis para PDF e Excel.

Como todo o conjunto de dados fica em um único arquivo local com backups automatizados, a
instituição não tem custo recorrente de infraestrutura, nenhum processamento externo de
dados e nenhuma dependência de que um serviço de terceiro continue disponível.

---

## Stack tecnológica

### Camadas de linguagem e runtime

A aplicação não é um código de uma única linguagem. Ela possui três camadas distintas, cada
uma com sua toolchain.

| Camada | Linguagem | Toolchain | Papel |
| --- | --- | --- | --- |
| Backend desktop | Rust 2021 (MSRV 1.77) | Cargo | Toda a lógica de negócio, persistência, segurança e IPC |
| Interface | TypeScript 5.4.5 (strict) | Build do Next.js 14 | Todas as telas e interações |
| Ferramentas nativas | Rust 2021 | Cargo | Instalador, desinstalador e biblioteca de licença |

**Rust versus Tauri.** Não são alternativas. Tauri é o framework da aplicação; Rust é a
linguagem em que o backend é escrito. O próprio Tauri é um framework em Rust, portanto
escolher Tauri significa escolher Rust para o backend. Neste projeto o Rust é usado em toda
a parte de servidor, e não apenas nas partes exigidas pelo Tauri.

### Backend — crates Rust

Todas as dependências declaradas em `src-tauri/Cargo.toml`.

| Crate | Versão | Função neste projeto |
| --- | --- | --- |
| `tauri` | 2 | Runtime desktop: gerenciamento de janela, despacho de comandos IPC, empacotamento de assets |
| `tauri-plugin-dialog` | 2 | Diálogos nativos de seleção de arquivo e diretório |
| `serde` / `serde_json` | 1 | Serialização de todo valor que atravessa a fronteira IPC |
| `rusqlite` | 0.32 (`bundled`) | Driver SQLite. O recurso `bundled` compila estaticamente o SQLite dentro do binário, eliminando a dependência do sistema |
| `bcrypt` | 0.15 | Hash de senhas com o fator de trabalho padrão da biblioteca |
| `jsonwebtoken` | 9.3 | Emissão e validação de JWT (HS256) |
| `sha2` / `hex` | 0.10 / 0.4 | Impressão digital SHA-256 dos tokens de sessão antes de salvar |
| `uuid` | 1.10 (`v4`) | Identificadores aleatórios e geração de segredos efêmeros |
| `ed25519-dalek` | 2 | Verificação de assinatura Ed25519 para validação de licença |
| `chrono` | 0.4 | Aritmética de data e hora, agendamentos, limites de período de relatório |
| `tokio` | 1 (`full`) | Runtime assíncrono para tratamento concorrente de IPC |
| `tiny_http` | 0.12 | Servidor HTTP embutido para acesso opcional pela rede local |
| `local-ip-address` | 0.6 | Descoberta de interfaces de rede local e lista de permitidos |
| `regex` | 1.10 | Correspondência de padrões em validação e busca |
| `log` / `env_logger` | 0.4 / 0.11 | Log estruturado com destino em arquivo rotativo |
| `dirs` | 5 | Resolução de diretórios padrão específicos do sistema operacional |
| `lazy_static` | 1.4 | Inicialização diferida de estáticos compartilhados |
| `base64` | 0.22 | Codificação de tokens e recursos embarcados |
| `open` | 5 | Abertura de URLs e arquivos externos a partir da aplicação |
| `whoami` | 1 | Resolução da identidade do usuário local |

Dependências de build: `tauri-build` (embarcamento de assets e configuração de bundle),
`ed25519-dalek` e `rand` (geração do par de chaves de desenvolvimento).

### Frontend — TypeScript e React

Todas as dependências declaradas em `package.json`.

| Pacote | Versão | Função neste projeto |
| --- | --- | --- |
| `next` | 14.2 | Framework React. Configurado com `output: 'export'` para gerar um bundle totalmente estático |
| `react` / `react-dom` | 18.3 | Runtime de interface, modelo de dados do App Router |
| `typescript` | 5.4.5 | Sistema de tipos. O compilador roda com `strict: true` |
| `tailwindcss` / `postcss` / `autoprefixer` | 3.4 | Pipeline de estilos utilitário-first |
| `@radix-ui/*` | 1.1 | Primitivos acessíveis sem estilo (dialog, select) usados pela camada de componentes |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7 / 2.1 / 2.5 | Composição de classes por variante e condição |
| `zustand` | 5.0 | Store de estado no cliente |
| `react-hook-form` | 7.53 | Gerenciamento de estado de formulários |
| `zod` | 3.23 | Validação por schema compartilhada entre formulários e handlers |
| `@hookform/resolvers` | 3.9 | Adaptador que conecta schemas Zod ao React Hook Form |
| `react-imask` | 7.6 | Máscaras de entrada para documentos, telefones e moeda |
| `recharts` | 3.8 | Gráficos no dashboard e nos relatórios financeiros |
| `react-calendar` | 6.0 | Componente de seleção de data |
| `jspdf` / `jspdf-autotable` | 4.2 / 3.8 | Geração de relatórios PDF com layout de tabelas |
| `xlsx` | 0.18 | Exportação para Excel |
| `crypto-js` | 4.2 | Utilitários criptográficos no cliente |
| `lucide-react` | 0.453 | Conjunto de ícones |

### Biblioteca de componentes

A camada de interface é construída com **shadcn/ui**, um modelo de distribuição em que os
componentes são copiados para o repositório e passam a pertencer ao projeto, em vez de
consumidos como dependência opaca. O Radix UI fornece o comportamento acessível e o Tailwind
fornece a estilização.

### Banco de dados

| Aspecto | Escolha |
| --- | --- |
| Motor | SQLite 3 |
| Driver | `rusqlite` com o recurso `bundled` |
| Implantação | Ligado estaticamente ao executável. Sem servidor, sem serviço, sem runtime externo |
| Tabelas | 28 |
| Versão do schema | 21, registrada em `schema_migrations` e aplicada automaticamente na inicialização |
| Migrations | Sequenciais e idempotentes. Migrations pendentes são aplicadas na inicialização e falhas são registradas em log em vez de descartadas silenciosamente |
| Local | `%ProgramData%\Cuidar-ERP-VDA\Data\cuidar.db`, fora do diretório de instalação |
| Concorrência | Modelo de acesso de processo único, escritas serializadas, configuração compatível com WAL |

Grupos de tabelas: identidade e acesso (`users`, `user_sessions`, `login_attempts`,
`audit_log`, `two_factor_auth` reservada para uso futuro), matrícula (`alunos`,
`responsaveis`, `crianca_responsaveis`, `matriculas`, `turmas`), cobrança (`mensalidades`,
`gastos_fixos`, `servicos`, `aluno_servicos`), frequência (`frequencias`,
`frequencia_registros`, `frequencia_funcionarios`), funcionários (`funcionarios`, `cargos`,
`escala_trabalho`, `funcionario_turmas`), registros institucionais (`ocorrencias`,
`configuracoes`, `creche`), financeiro (`company_expenses`, `company_revenues`) e
infraestrutura (`schema_migrations`, `database_backups`, `backup_settings`).

### Build e distribuição

| Componente | Tecnologia |
| --- | --- |
| Empacotamento desktop | Bundler do Tauri, alvo `msi` |
| Formato do instalador | Windows Installer (MSI) gerado com o WiX Toolset |
| Idioma do instalador | `pt-BR` |
| CLI do instalador | Binário Rust próprio (`instalador/`) que embute o MSI e valida a licença |
| Biblioteca de licença | Biblioteca dinâmica Rust (`instalador-dll/`) expondo a verificação Ed25519 |
| Desinstalador | Binário Rust próprio (`desinstalador/`) |
| Elevação | Manifesto de aplicação Windows exigindo privilégios de administrador |

O identificador da aplicação é `com.cuidarerp.vda` e a versão de distribuição é `1.0.8`.

### Ferramentas de qualidade

| Ferramenta | Versão | Escopo |
| --- | --- | --- |
| `cargo test` | nativa | 35 testes unitários sobre validação, senhas e lógica de migration |
| Cypress | 15.16 | 16 arquivos de especificação end-to-end cobrindo toda a rotina administrativa |
| `@testing-library/cypress` | 10.1 | Auxiliares de consulta para seletores end-to-end |

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  Webview (motor do sistema, não um browser embarcado)        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Export estático Next.js 14 - TypeScript - React 18     │  │
│  │  41 rotas · store Zustand · validação Zod              │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │  invocação IPC tipada
                            │  (camelCase to snake_case,
                            │   serialização de argumentos e retorno)
┌───────────────────────────v──────────────────────────────────┐
│  Backend Rust - Tauri 2                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  179 comandos · camada de validação · módulo de auth    │  │
│  │  cache TTL com invalidação por padrão · log de auditoria│  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────┬────────────────────┘
       │                                  │
┌──────v──────────────────┐    ┌──────────v────────────────────┐
│ SQLite (rusqlite,       │    │ Servidor local opcional       │
│ ligado estaticamente)  │    │ tiny_http na porta 1420       │
│ 28 tabelas, schema v21  │    │ POST /rpc, apenas interfaces │
└─────────────────────────┘    │ locais, comandos sensíveis    │
                               │ não são expostos              │
┌─────────────────────────┐    └───────────────────────────────┘
│ Logger em arquivo       │
│ (log + env_logger,      │    ┌───────────────────────────────┐
│ rotativo)               │    │ Motor de backup              │
└─────────────────────────┘    │ verificação por checksum      │
                               │ SHA-256, periódico e manual,  │
                               │ por parte                    │
                               └───────────────────────────────┘
```

### Módulos do backend

| Módulo | Linhas | Responsabilidade |
| --- | --- | --- |
| `main.rs` | 4.409 | Definição dos comandos, regras de negócio, orquestração |
| `migrations.rs` | 984 | Versionamento do schema e aplicação automática de migrations |
| `backup.rs` | 486 | Criação de backups, checksums, retenção, verificação de restauração |
| `servidor_rede.rs` | 350 | Servidor HTTP local opcional e lista de interfaces permitidas |
| `rpc.rs` | 275 | Roteamento de requisições, propagação de token, coerção de argumentos |
| `validation.rs` | 179 | Validação de documentos, e-mail, telefone e datas |
| `logger.rs` | 101 | Destino de log rotativo em arquivo |
| `auth.rs` | 75 | Emissão, validação e hashing de tokens |
| `cache.rs` | 65 | Cache em memória com TTL e invalidação por padrão |

### Caminho de invocação

Todo acesso a dados percorre o mesmo caminho, sem exceções:

1. A interface chama um único auxiliar de invocação, que serializa os argumentos.
2. Na build desktop a chamada é despachada pela ponte IPC do framework.
3. No navegador o mesmo auxiliar recorre a `POST /rpc` contra o servidor local,
   anexando o token de sessão e convertendo as convenções de nomeação de argumentos.
4. O backend valida a entrada, aplica a autorização, executa a instrução e devolve um
   resultado serializado.

O frontend não tem conexão direta com o banco em nenhuma build.

---

## Modelo de segurança

| Controle | Implementação |
| --- | --- |
| Armazenamento de senhas | bcrypt com o fator de trabalho padrão da biblioteca. Texto puro nunca é persistido nem registrado em log |
| Tokens de sessão | JWT assinado com HS256. Token de acesso válido por 8 horas, refresh token por 30 dias |
| Segredo de assinatura | Lido da variável de ambiente `JWT_SECRET`. Quando ausente, um valor criptograficamente aleatório é gerado no início do processo, de modo que não existe segredo fixo no código-fonte |
| Armazenamento de token | Apenas a impressão digital SHA-256 do token de sessão é gravada no banco |
| Resistência a força bruta | Máximo de 5 tentativas falhas, seguido de bloqueio de 15 minutos registrado em `login_attempts` |
| Autorização | Baseada em perfil. Cada comando exige seu próprio requisito de perfil no servidor |
| Trilha de auditoria | Operações sensíveis são gravadas em `audit_log` com autor e horário |
| Validação de licença | Assinatura Ed25519 verificada pelo instalador. A chave privada de assinatura não faz parte deste repositório |
| Validação de entrada | Módulo centralizado para documentos nacionais, e-mail, telefone, datas e valores monetários |
| Isolamento de dados | Banco armazenado fora do diretório de instalação, de modo que atualizações e desinstalações não destroyam registros |
| Exposição de rede | O servidor local opcional se vincula apenas a interfaces locais e omite deliberadamente comandos sensíveis de recuperação |

---

## Módulos funcionais

| Módulo | Escopo |
| --- | --- |
| Dashboard | Métricas agregadas, visão de frequência, resumo financeiro |
| Alunos | Matrícula, edição, responsáveis, registros de matrícula, serviços por aluno |
| Turmas | Criação de turmas, atribuição de alunos e funcionários |
| Frequência | Registro diário por turma, justificativas, frequência de funcionários |
| Mensalidades | Geração de cobranças, vencimentos, sobrescritas por aluno, acompanhamento de pagamentos |
| Financeiro | Receitas, despesas, custos fixos, visão financeira por aluno |
| Funcionários | Cadastro, perfis, atribuição de turmas, escalas de trabalho |
| Cargos | Catálogo de permissões e administração de perfis |
| Serviços | Serviços adicionais cobrados por aluno e vinculados a alunos |
| Ocorrências | Registros de ocorrência com data, gravidade e resolução |
| Relatórios | Alunos, frequência, financeiro, funcionários e ocorrências, exportáveis para PDF e Excel |
| Administração | Inspeção do log de auditoria, utilitários de dados de teste |
| Configurações | Dados da instituição, custos fixos, backups, segurança, serviços |
| Onboarding | Fluxo guiado de primeira execução |

---

## Panorama do código

| Área | Arquivos | Linhas |
| --- | --- | --- |
| Backend Rust (`src-tauri/src`) | 9 | 6.924 |
| Rotas e telas Next.js (`app`) | 48 | 14.499 |
| Biblioteca de componentes (`components`) | 18 | 1.898 |
| Lógica do frontend (`lib`) | 19 | 1.235 |
| Testes end-to-end (`cypress`) | 20 | 550 |
| Ferramentas de instalador e licença | 10 | 436 |

---

## Compilação a partir do código

### Pré-requisitos

- Node.js 20 ou superior
- Toolchain Rust, canal estável
- Microsoft C++ Build Tools (necessário para a compilação do SQLite embutido do `rusqlite`)
- Runtime WebView2 (presente por padrão no Windows 10 e 11)

### Instalar dependências

```bash
npm install
```

### Desenvolvimento

```bash
npx tauri dev
```

### Build de produção

```bash
npx tauri build
```

Saída: `src-tauri/target/release/bundle/msi/`

### Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `SENHA_PADRAO` | Credencial inicial de administrador. Necessária para criar a primeira conta |
| `JWT_SECRET` | Segredo de assinatura de tokens. Gerado aleatoriamente na inicialização quando ausente |

Nenhum segredo é armazenado neste repositório. Os nomes das variáveis estão documentados em
`.env.example`.

### Observação sobre os crates do instalador

Os crates `instalador/` e `instalador-dll/` embutem `dist/cuidarerp-latest.msi` em tempo de
compilação, e `dist/` é um artefato de build que não é versionado. Para compilar esses dois
crates, gere o MSI antes (`npx tauri build`, ou o `compilar_instalador.bat` do projeto) e
coloque-o em `dist/cuidarerp-latest.msi`. A aplicação em si compila diretamente a partir de
um clone novo, sem essa etapa.

---

## Testes

```bash
cd src-tauri
cargo test                      # 35 testes unitários

cd ..
npm run cypress:run:headless    # 16 especificações end-to-end
```

A suíte unitária cobre validação de entrada, semântica de hash e verificação de senhas, e o
comportamento de migration do schema. A suíte end-to-end exercita a rotina administrativa
pela interface: autenticação, ciclo de vida de alunos e funcionários, frequência, registros
financeiros, relatórios, serviços e operações de backup.

---

## Estrutura do repositório

```
src-tauri/
  src/
    main.rs            Superfície de comandos e regras de negócio
    migrations.rs      Versionamento do schema
    backup.rs          Motor de backup
    cache.rs           Cache em memória
    auth.rs            Emissão e validação de tokens
    validation.rs      Validação de entrada
    rpc.rs             Roteamento de requisições locais
    servidor_rede.rs   Servidor local opcional
    logger.rs          Log em arquivo
  migrations/          Arquivos SQL de migration
  windows/             Fragmentos do WiX, assets do instalador, locale
  tauri.conf.json     Configuração de bundle e janela
app/                   Telas do App Router do Next.js
components/            Componentes de interface
lib/                   Store, hooks, utilitários, geradores de relatório
cypress/               Especificações end-to-end
database/schema.sql    Schema de referência
instalador/            CLI do instalador
instalador-dll/        Biblioteca de validação de licença
desinstalador/         CLI do desinstalador
docs/                  Documentação técnica e de usuário
scripts/               Scripts de configuração e manutenção
```

---

## Licença

MIT. Consulte o arquivo `LICENSE`.

O nome Cuidar ERP e a marca ShipClaw são propriedade de seus respectivos titulares. Este
repositório é publicado para fins de portfólio e avaliação técnica.

---

## Autora

**Brenda Tavares** - Desenvolvedora Backend

- Humanidades, Universidade Federal da Bahia (UFBA)
- Desenvolvimento Back-End, Universidade Pitágoras Unopar Anhanguera
- GitHub: <https://github.com/Brenda-Tavares>
- LinkedIn: <https://www.linkedin.com/in/brenda-campos-tavares/>

---

English: [README.md](README.md) | Simplified Chinese: [README.zh-CN.md](README.zh-CN.md)