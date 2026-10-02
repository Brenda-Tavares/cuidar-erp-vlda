# Cuidar ERP - Vila do Aprender

Offline-first desktop management system for educational institutions. Built as a native
desktop application with a **Rust** backend on the **Tauri 2** framework and a
**TypeScript / React** frontend, persisted in an **embedded SQLite** database. Developed and
delivered on demand for a single client institution in Salvador, Bahia, Brazil.

> **Portfolio project.** This repository is a sanitized public version of a commercial
> project. Credentials, internal documentation, private keys and client data have been
> removed. No part of this repository can be used to forge licenses or recover production
> secrets.

---

## Table of contents

- [Context](#context)
- [The problem](#the-problem)
- [The solution](#the-solution)
- [Outcome](#outcome)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Functional modules](#functional-modules)
- [Codebase overview](#codebase-overview)
- [Building from source](#building-from-source)
- [Tests](#tests)
- [Repository structure](#repository-structure)
- [License](#license)
- [Author](#author)

---

## Context

The project was commissioned as proprietary, on-demand software by a single early-childhood
education institution. The constraint set by the client was unusual for a management system:
the person responsible for day-to-day administration has no technical background, the
institution has no dedicated IT infrastructure, and the software cannot depend on an external
service that might stop being paid for.

The product was therefore designed around four non-negotiable requirements:

1. It must run entirely on a single Windows machine and keep working with no internet access.
2. It must not consume meaningful hardware resources, because it runs on shared office
   equipment alongside the routines of the institution.
3. It must be operable by a non-technical user without training.
4. It must not expose student, employee or financial data to any third party.

---

## The problem

Generic school management systems assume an IT department. This institution had none.
The alternatives were:

- A cloud SaaS product, which put personal data of children and staff on a third-party
  server and created a permanent monthly cost for a service that only needs to record
  attendance and tuition.
- A spreadsheet, which cannot enforce data integrity, cannot produce reliable reports, and
  which loses version history.
- A web application, which requires a server, a domain and someone responsible for both.

All three fail on the same axis: they assume an operator who is technically capable.
The actual operator is an educational coordinator.

---

## The solution

A native desktop application that removes the server entirely. There is no backend service
to deploy, no domain to renew, and no account to create. The process starts, opens a local
window and reads a local file.

The design consequences were specific:

- **Native shell instead of a browser.** Tauri renders a web frontend but runs it in the
  operating system's own webview, which keeps installation size and resident memory far below
  an Electron application while still allowing a modern frontend stack.
- **SQLite compiled into the binary.** The database engine is statically linked, so there is
  no database server, no service to install and no port to open.
- **Data outside the installation directory.** The database lives in the machine-wide
  application data folder, so updating the application or uninstalling it never touches
  institutional records.
- **A layered command model.** All data access is exposed as typed commands invoked through
  the framework's IPC bridge. The frontend has no direct path to the database.
- **A built-in local server.** Optional, disabled by default, bound only to local interfaces,
  so the application can be reached from a phone or a tablet on the same network without
  exposing anything to the internet.

---

## Outcome

A single-install desktop application covering the institution's administrative routine:
student enrolment and enrolment records, class management, attendance, monthly tuition
billing, staff management with role-based access, incident records, additional services
billed per student, fixed expenses, revenue and expense tracking, and a report suite
exportable to PDF and Excel.

Because the entire dataset lives in one local file with automated backups, the institution
has no recurring infrastructure cost, no external data processing, and no dependency on a
third-party service remaining available.

---

## Technology stack

### Language and runtime layers

The application is not a single-language codebase. It has three distinct layers, each with a
different toolchain.

| Layer | Language | Toolchain | Role |
| --- | --- | --- | --- |
| Desktop backend | Rust 2021 (MSRV 1.77) | Cargo | All business logic, persistence, security, IPC |
| User interface | TypeScript 5.4.5 (strict) | Next.js 14 build | All screens and interaction |
| Native tooling | Rust 2021 | Cargo | Installer, uninstaller, license library |

**Rust versus Tauri.** They are not alternatives. Tauri is the application framework; Rust is
the language the backend is written in. Tauri itself is a Rust framework, so choosing Tauri
means choosing Rust for the backend. In this project Rust is used for the entire back end,
not only for the parts Tauri requires.

### Backend - Rust crates

All dependencies declared in `src-tauri/Cargo.toml`.

| Crate | Version | Purpose in this project |
| --- | --- | --- |
| `tauri` | 2 | Desktop runtime: window management, IPC command dispatch, asset bundling |
| `tauri-plugin-dialog` | 2 | Native file and directory selection dialogs |
| `serde` / `serde_json` | 1 | Serialization of every value crossing the IPC boundary |
| `rusqlite` | 0.32 (`bundled`) | SQLite driver. The `bundled` feature statically compiles the SQLite amalgamation into the binary, removing the system dependency |
| `bcrypt` | 0.15 | Password hashing at the library's default work factor |
| `jsonwebtoken` | 9.3 | JWT generation and validation (HS256) |
| `sha2` / `hex` | 0.10 / 0.4 | SHA-256 fingerprinting of session tokens before storage |
| `uuid` | 1.10 (`v4`) | Random identifiers and ephemeral secret generation |
| `ed25519-dalek` | 2 | Ed25519 signature verification for license validation |
| `chrono` | 0.4 | Date and time arithmetic, scheduling, report period boundaries |
| `tokio` | 1 (`full`) | Asynchronous runtime for concurrent IPC handling |
| `tiny_http` | 0.12 | Embedded HTTP server for optional local-network access |
| `local-ip-address` | 0.6 | Local network interface discovery and allow-listing |
| `regex` | 1.10 | Pattern matching across validation and search |
| `log` / `env_logger` | 0.4 / 0.11 | Structured logging with a rotating file sink |
| `dirs` | 5 | Resolution of OS-specific standard directories |
| `lazy_static` | 1.4 | Deferred initialization of shared statics |
| `base64` | 0.22 | Encoding for tokens and embedded resources |
| `open` | 5 | Launching external URLs and files from the application |
| `whoami` | 1 | Local user identity resolution |

Build-time dependencies: `tauri-build` (asset embedding and bundle configuration),
`ed25519-dalek` and `rand` (development key pair generation).

### Frontend - TypeScript and React

All dependencies declared in `package.json`.

| Package | Version | Purpose in this project |
| --- | --- | --- |
| `next` | 14.2 | React framework. Configured with `output: 'export'` to produce a fully static bundle |
| `react` / `react-dom` | 18.3 | User interface runtime, App Router data model |
| `typescript` | 5.4.5 | Type system. The compiler runs with `strict: true` |
| `tailwindcss` / `postcss` / `autoprefixer` | 3.4 | Utility-first styling pipeline |
| `@radix-ui/*` | 1.1 | Accessible unstyled primitives (dialog, select) used by the component layer |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7 / 2.1 / 2.5 | Variant and conditional class composition |
| `zustand` | 5.0 | Client state store |
| `react-hook-form` | 7.53 | Form state management |
| `zod` | 3.23 | Schema validation shared between forms and handlers |
| `@hookform/resolvers` | 3.9 | Adapter connecting Zod schemas to React Hook Form |
| `react-imask` | 7.6 | Input masking for documents, phone numbers and currency |
| `recharts` | 3.8 | Charts in the dashboard and financial reports |
| `react-calendar` | 6.0 | Date selection component |
| `jspdf` / `jspdf-autotable` | 4.2 / 3.8 | PDF report generation with table layout |
| `xlsx` | 0.18 | Excel export |
| `crypto-js` | 4.2 | Client-side cryptographic utilities |
| `lucide-react` | 0.453 | Icon set |

### Component library

The interface layer is built with **shadcn/ui**, a distribution model in which components
are copied into the repository and owned by the project rather than consumed as an opaque
dependency. Radix UI provides the accessible behaviour and Tailwind provides the styling.

### Database

| Aspect | Choice |
| --- | --- |
| Engine | SQLite 3 |
| Driver | `rusqlite` with the `bundled` feature |
| Deployment | Statically linked into the executable. No server, no service, no external runtime |
| Tables | 28 |
| Schema version | 21, tracked in `schema_migrations` and applied automatically at startup |
| Migrations | Sequential, idempotent. Pending migrations are applied on launch and failures are logged rather than silently discarded |
| Location | `%ProgramData%\Cuidar-ERP-VDA\Data\cuidar.db`, outside the installation directory |
| Concurrency | Single-process access model, serialized writes, WAL-compatible configuration |

Table groups: identity and access (`users`, `user_sessions`, `login_attempts`,
`audit_log`, `two_factor_auth` reserved for future use), enrolment (`alunos`, `responsaveis`,
`crianca_responsaveis`, `matriculas`, `turmas`), billing (`mensalidades`, `gastos_fixos`,
`servicos`, `aluno_servicos`), attendance (`frequencias`, `frequencia_registros`,
`frequencia_funcionarios`), staff (`funcionarios`, `cargos`, `escala_trabalho`,
`funcionario_turmas`), institutional records (`ocorrencias`, `configuracoes`, `creche`),
financial (`company_expenses`, `company_revenues`), and infrastructure
(`schema_migrations`, `database_backups`, `backup_settings`).

### Build and distribution

| Component | Technology |
| --- | --- |
| Desktop packaging | Tauri bundler, `msi` target |
| Installer format | Windows Installer (MSI) generated with the WiX Toolset |
| Installer locale | `pt-BR` |
| Installer CLI | Custom Rust binary (`instalador/`) that embeds the MSI and validates the license |
| License library | Rust dynamic library (`instalador-dll/`) exposing Ed25519 verification |
| Uninstaller | Custom Rust binary (`desinstalador/`) |
| Elevation | Windows application manifest requiring administrator privileges |

The application identifier is `com.cuidarerp.vda` and the distribution version is `1.0.8`.

### Quality tooling

| Tool | Version | Scope |
| --- | --- | --- |
| `cargo test` | built-in | 35 unit tests over validation, password handling and migration logic |
| Cypress | 15.16 | 16 end-to-end specification files covering the full administrative routine |
| `@testing-library/cypress` | 10.1 | Query helpers for end-to-end selectors |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Webview (system engine, not a bundled browser)              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 static export - TypeScript - React 18      │  │
│  │  41 routes · Zustand store · Zod validation            │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │  typed IPC invocation
                            │  (camelCase to snake_case,
                            │   argument and result serialization)
┌───────────────────────────v──────────────────────────────────┐
│  Rust backend - Tauri 2                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  179 commands · validation layer · auth module          │  │
│  │  TTL cache with pattern invalidation · audit log        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────┬────────────────────┘
       │                                  │
┌──────v──────────────────┐    ┌──────────v────────────────────┐
│ SQLite (rusqlite,       │    │ Optional local server          │
│ statically linked)      │    │ tiny_http on port 1420         │
│ 28 tables, schema v21   │    │ POST /rpc, local interfaces    │
└─────────────────────────┘    │ only, sensitive commands       │
                               │ not exposed                    │
┌─────────────────────────┐    └───────────────────────────────┘
│ File logger (log +      │
│ env_logger, rotating)   │    ┌───────────────────────────────┐
└─────────────────────────┘    │ Backup engine                 │
                               │ SHA-256 checksum verification  │
                               │ periodic and manual, per part  │
                               └───────────────────────────────┘
```

### Backend modules

| Module | Lines | Responsibility |
| --- | --- | --- |
| `main.rs` | 4,409 | Command definitions, business rules, orchestration |
| `migrations.rs` | 984 | Schema versioning and automatic migration application |
| `backup.rs` | 486 | Backup creation, checksums, retention, restore verification |
| `servidor_rede.rs` | 350 | Optional local HTTP server and interface allow-listing |
| `rpc.rs` | 275 | Request routing, token propagation, argument coercion |
| `validation.rs` | 179 | Document, e-mail, phone and date validation |
| `logger.rs` | 101 | Rotating file sink |
| `auth.rs` | 75 | Token issuance, validation and hashing |
| `cache.rs` | 65 | In-memory cache with TTL and pattern invalidation |

### Invocation path

Every data access flows through the same path, with no exceptions:

1. The interface calls a single invocation helper, which serializes arguments.
2. In the desktop build the call is dispatched over the framework's IPC bridge.
3. In a browser the same helper falls back to `POST /rpc` against the local server,
   attaching the session token and coercing argument naming conventions.
4. The backend validates input, applies authorization, executes the statement, and returns
   a serialized result.

The frontend has no direct connection to the database under any build.

---

## Security model

| Control | Implementation |
| --- | --- |
| Password storage | bcrypt at the library's default work factor. Plaintext is never persisted or logged |
| Session tokens | JWT signed with HS256. Access token valid 8 hours, refresh token valid 30 days |
| Signing secret | Read from the `JWT_SECRET` environment variable. When unset, a cryptographically random value is generated at process start, so no fixed secret exists in the source tree |
| Token storage | Only the SHA-256 fingerprint of a session token is written to the database |
| Brute-force resistance | Maximum 5 failed attempts, followed by a 15-minute lockout recorded in `login_attempts` |
| Authorization | Role-based. Every command enforces its own role requirement server-side |
| Audit trail | Security-relevant operations are written to `audit_log` with actor and timestamp |
| License validation | Ed25519 signature verified by the installer. The private signing key is not part of this repository |
| Input validation | Centralized module for national documents, e-mail addresses, phone numbers, dates and monetary values |
| Data isolation | Database stored outside the installation directory, so updates and uninstalls cannot destroy records |
| Network exposure | The optional local server binds local interfaces only and deliberately omits sensitive recovery commands |

---

## Functional modules

| Module | Scope |
| --- | --- |
| Dashboard | Aggregated metrics, attendance overview, financial summary |
| Students | Enrolment, edit, guardians, enrolment records, per-student services |
| Classes | Class creation, assignment of students and staff |
| Attendance | Daily register per class, justification records, staff attendance |
| Tuition | Billing generation, due dates, per-student overrides, payment tracking |
| Financial | Revenue, expenses, fixed costs, per-student financial view |
| Staff | Registration, roles, class assignments, work schedules |
| Roles | Permission catalogue and role administration |
| Services | Additional services billed per student and linked to students |
| Incidents | Occurrence records with date, severity and resolution |
| Reports | Students, attendance, financial, staff and incidents, exportable to PDF and Excel |
| Administration | Audit log inspection, data test utilities |
| Configuration | Institution details, fixed costs, backups, security, services |
| Onboarding | Guided first-run flow |

---

## Codebase overview

| Area | Files | Lines |
| --- | --- | --- |
| Rust backend (`src-tauri/src`) | 9 | 6,924 |
| Next.js routes and screens (`app`) | 48 | 14,499 |
| Component library (`components`) | 18 | 1,898 |
| Frontend logic (`lib`) | 19 | 1,235 |
| End-to-end tests (`cypress`) | 20 | 550 |
| Installer and license tooling | 10 | 436 |

---

## Building from source

### Prerequisites

- Node.js 20 or later
- Rust toolchain, stable channel
- Microsoft C++ Build Tools (required by the `rusqlite` bundled SQLite build)
- WebView2 runtime (present by default on Windows 10 and 11)

### Install dependencies

```bash
npm install
```

### Development

```bash
npx tauri dev
```

### Production build

```bash
npx tauri build
```

Output: `src-tauri/target/release/bundle/msi/`

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SENHA_PADRAO` | Initial administrator credential. Required to seed the first account |
| `JWT_SECRET` | Token signing secret. Generated randomly at startup when unset |

No secrets are stored in this repository. The variable names are documented in
`.env.example`.

### Note on the installer crates

The `instalador/` and `instalador-dll/` crates embed `dist/cuidarerp-latest.msi` at compile
time, and `dist/` is a build artifact that is not committed. To build those two crates,
produce the MSI first (`npx tauri build`, or the project's `compilar_instalador.bat`) and
place it at `dist/cuidarerp-latest.msi`. The application itself builds directly from a fresh
clone without this step.

---

## Tests

```bash
cd src-tauri
cargo test                      # 35 unit tests

cd ..
npm run cypress:run:headless    # 16 end-to-end specifications
```

The unit suite covers input validation, password hashing and verification semantics, and
schema migration behaviour. The end-to-end suite exercises the administrative routine
through the interface: authentication, student and staff lifecycles, attendance, financial
records, reports, services and backup operations.

---

## Repository structure

```
src-tauri/
  src/
    main.rs            Command surface and business rules
    migrations.rs      Schema versioning
    backup.rs          Backup engine
    cache.rs           In-memory cache
    auth.rs            Token issuance and validation
    validation.rs      Input validation
    rpc.rs             Local request routing
    servidor_rede.rs   Optional local server
    logger.rs          File logging
  migrations/          SQL migration files
  windows/             WiX fragments, installer assets, locale
  tauri.conf.json     Bundle and window configuration
app/                   Next.js App Router screens
components/            UI components
lib/                   Store, hooks, utilities, report generators
cypress/               End-to-end specifications
database/schema.sql    Reference schema
instalador/            Installer CLI
instalador-dll/        License validation library
desinstalador/         Uninstaller CLI
docs/                  Technical and user documentation
scripts/               Setup and maintenance scripts
```

---

## License

MIT. See `LICENSE`.

The name Cuidar ERP and the ShipClaw brand are property of their respective owner. This
repository is published for portfolio and review purposes.

---

## Author

**Brenda Tavares** - Backend Developer, Humanities (Federal University of Bahia, UFBA)

- GitHub: <https://github.com/Brenda-Tavares>
- LinkedIn: <https://www.linkedin.com/in/brenda-campos-tavares/>

---

Portuguese: [README.pt-BR.md](README.pt-BR.md) | Simplified Chinese:
[README.zh-CN.md](README.zh-CN.md)