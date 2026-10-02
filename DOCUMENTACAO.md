# Cuidar ERP - Vila do Aprender - Documentação e Registro

Última atualização: 18/08/2026

## 1. Visão geral

Aplicativo desktop Windows (Tauri 2 + Rust + Next.js 14 static export) para gestão de instituições educacionais:
alunos, turmas, frequência, ocorrências, mensalidades, funcionários, salários, gastos fixos,
receitas/despesas manuais e relatórios. Instalação com MSI (WiX) com validação de licença
(Ed25519) via instalador próprio.

- Pasta do projeto: `C:\projetos\cuidar-erp-vila-do-aprender`
- Identificador: `com.cuidarerp.vda` - UpgradeCode estável do WiX
- Produto exibido: `Cuidar ERP - Vila do Aprender` (hífen simples, por decisão da usuária — o travessão em dash causava caracteres quebrados no nome)
- Não há repositório git (será criado após conclusão do projeto)

## 2. Versões

| Versão | Data | Conteúdo |
|--------|------|----------|
| 1.0.0 | 11/08/2026 | Primeira versão instalada |
| 1.0.1 | 15/08/2026 | Boot otimizado (hash bcrypt em OnceLock), página Financeiro reescrita (KPIs + salários), loading screen |
| 1.0.2 | 18/08/2026 | Correções: financeiro (SQL `f.nome`), rotas dinâmicas `[id]` → estáticas `?id=`, instrumentação de erros, telefone 11 dígitos, migrations com log |
| 1.0.3 | 18/08/2026 | Ocorrências corrigidas (camelCase), calendários, edição de frequência, escala de trabalho, turmas no novo funcionário, relatórios por categoria, dados em ProgramData, backups por data, WiX (outro HD/SSD, desinstalação limpa), nome do produto com hífen |
| 1.0.4 | 18/08/2026 | Acentuação corrigida (4 telas), "% Folha/Receita", caixinha do valor da mensalidade, cache do dashboard em vínculos de serviços, taxa de matrícula automática no mês do cadastro + opção por mensalidade (migration 019) |
| 1.0.5 | 18/08/2026 | Pasta de backups criada ao abrir o app + backup mensal verificado na inicialização; subpasta por mês e nome de arquivo com data/hora; backup por partes (7 domínios) + geral; restauração com 2 modos (substituir/acrescentar); número de matrícula sequencial automático (migration 020); instalador com log MSI (`C:\CuidarErp-Install.log`) e encerramento do app na instalação (KillAppOnInstall) |
| 1.0.6 | 18/08/2026 | Caixinhas de valor de serviços no aluno com estilo padrão; mensalidade automática ao criar aluno (mês corrente) + recálculo inteligente das mensalidades não pagas ao vincular/desvincular/alterar serviços; correção da edição rápida de valor de serviço (envia serviço completo); Importar Backup (validação + registro + pergunta de restauração); telefone celular exige 9 após o DDD (frontend + backend); editar funcionário sem loop de erros (camelCase + deps do useEffect); banner de edição na frequência; instalador profissional — MSI copiado para `%ProgramData%\Cuidar-ERP-VDA\Instalador\cuidarerp-latest.msi` (origem estável, pasta do instalador livre, desinstalação nunca falha); limpeza dos resíduos de instalações de teste |
| 1.0.7 | 19/08/2026 | **Acesso em Rede Local**: servidor web embutido (`tiny_http`) servindo o app completo em `http://<IP>:1420`; config em Configurações → Instituição (switch + porta + copiar endereço); login/token web (12h) via `POST /rpc`; restrição à rede local (bloqueia internet); **todos os comandos do frontend expostos via `/rpc`** (`dispatch!` macro com ~120 comandos + 4 sem-app: `salvar_arquivo_em`, `log_frontend_error`, `get_ip_local`, `listar_ips_locais`); upload de backup pela web (`importar_backup_base64`); recuperação de emergência do `main.rs` truncado (bloco de produção reconstruído da cópia antiga + 8 funções exclusivas recriadas + invoke_handler regenerado com 167 comandos); **correção do contador de mensalidades pendentes do dashboard** (só mês atual + não deletadas, singular/plural correto); **correção do envelope `Result` no `dispatch!` web** (navegador recebia `{"Ok":...}` em vez do valor direto e caía na tela de criar creche sem dados — agora desembrulha e entrega valor direto, igual ao desktop) |
| 1.0.8 | 21/08/2026 | Release corretiva que resolve o loop dashboard↔login no acesso web (ver seção "Problemas conhecidos 1.0.8" para detalhes) e implementa melhorias: validação de duas palavras em nome/nome_responsavel, campo dia_vencimento no cadastro de aluno, tema claro fixo no mobile (darkMode: 'none') e correção de contador de mensalidades para mês atual apenas |
| 1.0.8 | 21/08/2026 | **Loop dashboard ↔ login no acesso web corrigido** — causa raiz: token web expirado/inválido após reinício do app mantinha `cuidar_erp_user` persistente no `localStorage`, fazendo com que a página de login auto-redirecionasse para o dashboard; o dashboard, ao tentar carregar dados com token inválido, gerava erro 401 "Não autenticado", que provocava um redirecionamento hard para /login, que por sua vez, ao detectar usuário persistente, redirecionava novamente para o dashboard, criando um loop infinito. **Correções aplicadas**: (1) `lib/tauri-invoke.ts`: ao detectar "Não autenticado", removido tanto `cuidar_erp_rede_token` quanto `cuidar_erp_user` do localStorage, quebrando o loop na origem; (2) `app/login/page.tsx`: validação de sessão via `verificar_onboarding` antes de auto-redirecionar; erro de autenticação → `resetAuth()` (fica no formulário); (3) `lib/store/auth-store.ts`: no `init()`, erro "Não autenticado" → `resetAuth()` ao invés de apenas `set({creche: null})`; (4) `app/(app)/layout.tsx`: `ready && !user → router.replace('/login')` (evita "Carregando..." infinito). **Validado**: release 1.0.8 instalada em PC de dev; servidor ativo em `http://192.168.100.6:1420`; teste no celular e outro computador — login funcional, dashboard estável, nenhuma rota dashboard↔login. |
| 1.0.9 | 03/09/2026 | **Diálogo de desinstalação com 3 opções**: UserDataDlg no MSI com 3 radio buttons (0=desinstalar, 1=apagar backups, 2=apagar dados do sistema); CustomAction `RemoveAllUserData` removida; ControlEvent `RemoveButton → UserDataDlg` com Order=2. **Instalador visível no painel**: `instalador.exe` agora se registra em `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\CuidarERPVDA` com `UninstallString` para `--uninstall`. **Flag `--uninstall`**: instalador detecta argumento e abre MSI diretamente em modo desinstalação (sem pedir chave). **Chave universal**: formato `:validade:nome:assinatura` (sem `machine_id`); nome `V1l4@do#Apr3nd3r`; validade `2031-09-03` (5 anos); assinatura Ed25519 com `dev_private_key.bin`; sem backwards compatibility. |

Versões sincronizadas em: `src-tauri/tauri.conf.json`, `package.json` + `package-lock.json`,
`src-tauri/Cargo.toml`, `instalador/Cargo.toml`.

## 3. Arquitetura

### Frontend (Next.js 14, `output: 'export'`)
- `app/(app)/*` - páginas autenticadas (dashboard, alunos, turmas, frequencia, mensalidades,
  funcionarios, financeiro, ocorrencias, relatorios, configuracoes)
- Banco via comandos Tauri (`invoke`) - nenhuma chamada HTTP direta
- `lib/tauri-invoke.ts` (desde 1.0.7) - camada única de invocação: usa `window.__TAURI__.invoke`
  quando roda dentro do app (Tauri) e **cai para `POST /rpc` no navegador** (acesso em rede local),
  convertendo automaticamente argumentos camelCase → snake_case e anexando o token web
- Erros de render capturados por `app/(app)/error.tsx` (Next) e `components/layout/ErrorBoundary.tsx`
- Erros de runtime (window.onerror/unhandledrejection) enviados ao backend por `log_frontend_error`
  (desde 1.0.2)

### Backend (Rust, `src-tauri/src/main.rs`)
- SQLite via rusqlite; banco em `%ProgramData%\\Cuidar-ERP-VDA\\Data\\cuidar.db` (desde 1.0.3, fora da pasta de instalação)
- `migrations.rs` - schema versionado (`CURRENT_SCHEMA_VERSION = 20`, 20 migrations aplicadas no banco de produção)
- Cache em memória (`cache::GLOBAL_CACHE`) para listas (alunos, dashboard, etc.)
- Hash de senha bcrypt (custo 12) cacheado em `SENHA_HASH_PADRAO` (OnceLock)
- Logs do app em `%APPDATA%\com.cuidarerp.erp\logs\vila-do-aprender_YYYY-MM-DD.log`
- Auditoria de operações em tabela `audit_log`

### Acesso em Rede Local (desde 1.0.7)
- `servidor_rede.rs` - servidor `tiny_http` na porta 1420 (configurável), iniciado no `.setup` do Tauri;
  serve o `dist/` do Next.js (build estático) e aceita `GET /rpc` + `POST /rpc`
- `rpc.rs` - dispatcher web: macro `dispatch!` (~120 comandos) + comandos sem app
  (`salvar_arquivo_em`, `log_frontend_error`, `get_ip_local`, `listar_ips_locais`); login gera
  token aleatório (12h) validado via header `Authorization: Bearer`; argumentos camelCase → snake_case
- **O `dispatch!` desembrulha o `Result<T, String>` antes de serializar** (desde a correção da 1.0.7):
  `Ok(v)` → valor direto em `dados`, `Err(e)` → HTTP 400 com `{"ok":false,"erro":...}` — idêntico ao
  comportamento do IPC do Tauri no desktop. Sem isso o navegador recebia `{"Ok":{...}}` (envelope Rust)
  e o frontend quebrava (tela de criar creche, dados não carregavam).
- Segurança: aceita apenas IPs da rede local/loopback (bloqueia acesso externo); comandos sensíveis de
  recuperação (`resetar_banco`, `resetar_dados_teste`, `criar_admin_emergencia`,
  `diagnosticar_e_corrigir_login`, `resetar_senha_admin`, `save_file_dialog`) **não** são expostos via web
- Config salva na tabela `configuracoes` (chave `rede_local`, JSON `{"habilitada":true,"porta":1420,"ip":""}`)

### Instalação / distribuição
- `npx tauri build` → MSI em `src-tauri/target/release/bundle/msi/`
- `dist/cuidarerp-latest.msi` - cópia do MSI (nome fixo usado pelo instalador)
- `dist/instalador.exe` - valida licença Ed25519 (chave pública em `instalador/dev_public_key.bin`)
  e embute o MSI via `include_bytes!("../../dist/cuidarerp-latest.msi")`
- Instalação: `InstallScope=perMachine`, `AllowDowngrades=yes`, dados em `%LOCALAPPDATA%\com.cuidarerp.vda`
  removidos apenas se o usuário optar (diálogo "Remover dados do usuário" na desinstalação)
- MSIs antigos arquivados em `dist\antigos` (a cada release, os arquivos antigos do `dist` são movidos para lá)

## 4. Pipeline de release (manual)

1. Bump de versão nos 4 arquivos (ver seção 2)
2. `npx tauri build` (roda `npm run build` antes)
3. Copiar MSI gerado → `dist/cuidarerp-latest.msi` (manter também cópia versionada)
4. `cargo build --release` em `instalador/`
5. Copiar `instalador/target/release/instalador.exe` → `dist/`
6. Testar: instalar via `dist/instalador.exe`, conferir versão do exe e fluxos

Alternativa automatizada: `release.ps1` (ver seção 8).

## 5. Problemas conhecidos e correções (histórico)

### 1.0.1 → 1.0.2 (18/08/2026)

1. **Financeiro > Empresa quebrava ("Desculpe, ocorreu um erro...")**
   - Causa: `listar_pagamentos_salarios` usava `f.nome` (coluna inexistente) no JOIN com
     `funcionarios` (que tem `nome_completo`/`nome_social`) → SQL falhava → `overview` null →
     crash nos `overview!` da página → error boundary.
   - Correção: `COALESCE(NULLIF(f.nome_social,''), f.nome_completo)`.

2. **Editar aluno/funcionário/turma/ocorrência falhava (carregando → volta ao dashboard)**
   - Causa: rotas dinâmicas `app/(app)/*/[id]/` com `output: 'export'` + Tauri (sem SPA fallback):
     o arquivo `alunos/123.html` não existe em `out/` → navegação falha e reverte.
   - Correção: rotas estáticas com query string: `/alunos/editar?id=123` (idem funcionarios,
     turmas, ocorrencias). Arquivo estático existe → navegação funciona.

3. **Página Ocorrências quebrava (sem causa encontrada por inspeção)**
   - Correção: instrumentação - hook global de erros no frontend → comando `log_frontend_error`
     grava no log do app; endurecimento da página com `?? []`.
   - Status: verificar após 1.0.2 instalada (log revela o erro real se persistir).

4. **Telefone perdia 1 dígito em vários cadastros**
   - Causa: IMaskInput com array de máscaras `(00) 00000-0000`/`(00) 0000-0000` (funcionário)
     alternava para a máscara de 10 dígitos e descartava o último dígito.
   - Correção: máscara única `(00) 00000-0000` (11 dígitos) em todos os campos de telefone
     (14 campos, todos os formulários) e `validatePhone` agora exige exatamente 11 dígitos.

5. **Log do app vazio (17/08)** - em investigação junto com a instrumentação (#3).

6. **Migrações silenciosas**: `MIGRACOES_APLICADAS` OnceLock com `let _ = apply_migrations(...)`
   engolia erros. Correção: registrar erro no log (e remover OnceLock).

### 1.0.6 -> 1.0.7 (19/08/2026)

1. **Contador de mensalidades pendentes do dashboard** - `get_dashboard_stats` e
   `get_dashboard_stats_completo` usavam `SELECT COUNT(*) WHERE pago=0` (todas as pendentes
   de todos os meses). Agora: `pago=0 AND deleted_at IS NULL AND strftime('%Y-%m', vencimento)
   = <mês atual>` — o card e o alerta "neste mês" refletem só o mês corrente; alerta com
   singular/plural correto.
2. **Envelope `Result` no acesso web (causa raiz do "criar creche do zero" no navegador)** -
   o macro `dispatch!` (rpc.rs) serializava `serde_json::to_value(Result<T, String>)` — o
   navegador recebia `{"Ok": {...}}` em vez do valor direto. No desktop o IPC do Tauri
   desembrulha o Result automaticamente (por isso funcionava); na web o frontend
   (`lib/tauri-invoke.ts` → `dados.dados`) recebia o envelope → `creche.nome` = undefined →
   `isCrecheConfigurada` false → redirecionava para a tela de configurar creche e nenhum
   dado carregava (afetava ~120 comandos). Correção: `dispatch!` agora faz
   `match func(...) { Ok(v) => to_value(v), Err(e) => Err(e) }` — valor direto em `dados`
   ou HTTP 400 com `{"ok":false,"erro":...}`, idêntico ao desktop. O mesmo desembrulho foi
   aplicado em `get_ip_local`/`listar_ips_locais` (handle_rpc_sem_app).
3. **Instalar por cima da mesma versão não atualiza os arquivos** - ao rodar o instalador
   1.0.7 com o 1.0.7 já instalado, o Windows Installer conclui sem erro mas **não sobrescreve**
   o exe (mesma versão de produto/arquivo). Para atualizar, desinstalar antes
   (`msiexec /x {ProductCode} /qn`, elevado) e instalar de novo. Validado: exe 20609536 B
   v1.0.7 no lugar do antigo 20653056 B.

### 1.0.5 -> 1.0.6 (18/08/2026)

1. **Caixinhas de valor de serviços no aluno** - CurrencyInput de valor_acordado em
   novo/editar aluno usava `w-24` sem estilo; agora usa o padrão INPUT_CLASS (borda,
   padding, focus ring, largura w-40, valor à direita) e `value ?? 0` (nunca vazio).
2. **Mensalidade automática ao criar aluno** - `criar_aluno` continua não gerando nada;
   o frontend de novo aluno, após vincular os serviços, chama
   `gerar_mensalidade_para_aluno` com o mês corrente (try/catch silencioso: já existe ou
   valor 0 não interrompem o cadastro). Taxa de matrícula aplicada via
   `taxa_matricula_para_mes` (created_at do mês).
3. **Recálculo inteligente** - novo helper `recalcular_mensalidades_pendentes(conn,
   aluno_id)` em main.rs: re-executa `calcular_valor_mensalidade` (override OU padrão
   creche + SUM de aluno_servicos ativos) e atualiza `valor = base + taxa_matricula`
   apenas das linhas `pago = 0`. Chamado ao fim de `vincular_servico_aluno`,
   `desvincular_servico_aluno` e `update_valor_acordado_servico`. Mensalidades pagas
   nunca mudam. Coberto por 3 testes unitários novos (33 no total).
4. **Erro ao atualizar valor de serviço (lápis)** - `confirmInlineEdit` enviava
   `{ nome: '', ... }` e o backend (`update_servico` → `validar_nome`) recusava.
   Agora busca o serviço na lista e envia nome/descricao/tipo/status reais.
5. **Importar Backup** - `backup::importar_backup(conn, caminho, created_by)`: valida
   extensão `.db` e SQLite legível, copia como `importado_<timestamp>.db` para a pasta
   mensal de backups, registra em `database_backups` (type `importado`, notes = caminho
   original). Command `importar_backup` registrada no invoke_handler. UI: botão
   "Importar Backup" (plugin-dialog, filtro .db) → pergunta se restaura agora → reutiliza
   o diálogo Substituir/Acrescentar. Badge roxo "Importado" na lista.
6. **Telefone com 9** - `validatePhone` (TS) e `validar_telefone` (Rust): para 11 dígitos,
   o 3º dígito (após o DDD) deve ser 9; fixos de 10 dígitos seguem válidos.
7. **Editar funcionário** - `get_funcionario_turmas` recebia `{ funcionario_id }`
   (snake_case → Tauri 2 não mapeava → erro); agora `{ funcionarioId }`. O useEffect
   listava `toast` nas deps (identidade muda a cada render → loop de chamadas e toasts
   que não fechavam); removido. Apenas `[id, reset]`.
8. **Frequência: banner de edição** - banner acima da lista de presença: indigo
   "Editando frequência de DD/MM/AAAA" quando a data tem registro no histórico; âmbar
   "Nova frequência para DD/MM/AAAA" caso contrário. O clique no histórico já destacava
   a linha ativa (indigo) — agora o estado é sempre visível.
9. **Instalador profissional (causa raiz do "instalador preso")** - antes o MSI era
   extraído para %TEMP% e apagado após instalar; o Windows registrava a pasta de origem
   (onde o instalador foi salvo) como SOURCEDIR → essa pasta ficava "presa"/incluída
   enquanto o produto estivesse instalado (e a desinstalação usava o cache
   C:\WINDOWS\Installer\<hash>.msi, gerando dúvida sobre origem). Agora
   `preparar_msi_estavel()` copia o MSI para
   `%ProgramData%\Cuidar-ERP-VDA\Instalador\cuidarerp-latest.msi` (criando a pasta) e
   **não apaga**; fallback para %TEMP% apenas se ProgramData falhar. Resultado:
   origem estável, desinstalação/reparo nunca falham, a pasta do instalador do usuário
   fica livre. O `RemoveUserData` da desinstalação remove o ProgramData inteiro.
10. **Limpeza de resíduos de teste** - removidos ProgramData\Cuidar-ERP-VDA, Documentos\
    Cuidar-ERP, perfil WebView2 (%LOCALAPPDATA%\com.cuidarerp.vda), MSI*.LOG do TEMP,
    atalho órfão em D:; excluídas as pastas `cuidar erp vila do aprender instalador` e
    `MSIs antigos`; cópia de segurança dos bancos de teste em
    `tmp-tauri-test\residuo-teste-2026-08-18\`. release.ps1 agora arquiva os antigos do
    dist em `dist\antigos` (a pasta "MSIs antigos" foi eliminada a pedido da usuária).
11. **Teste real do instalador 1.0.6** - instalado e desinstalado no PC de dev: MSI
    estável criado em ProgramData, pasta do instalador livre durante a instalação,
    desinstalação "concluída com êxito", registro/Painel de Controle/Menu Iniciar limpos.

### 1.0.8 (21/08/2026)

1. **Loop dashboard ↔ login no acesso web** — causa raiz: token web expirado/inválido após reinício do app mantinha `cuidar_erp_user` persistente no `localStorage`, fazendo com que a página de login auto-redireccionasse para o dashboard; o dashboard, ao tentar carregar dados com token inválido, gerava erro 401 "Não autenticado", que provocava um redirecionamento hard para /login, que por sua vez, ao detectar usuário persistente, redirecionava novamente para o dashboard, criando um loop infinito. **Correções aplicadas**: (1) `lib/tauri-invoke.ts`: ao detectar "Não autenticado", removido tanto `cuidar_erp_rede_token` quanto `cuidar_erp_user` do localStorage, quebrando o loop na origem; (2) `app/login/page.tsx`: validação de sessão via `verificar_onboarding` antes de auto-redirecionar; erro de autenticação → `resetAuth()` (fica no formulário); (3) `lib/store/auth-store.ts`: no `init()`, erro "Não autenticado" → `resetAuth()` ao invés de apenas `set({creche: null})`; (4) `app/(app)/layout.tsx`: `ready && !user → router.replace('/login')` (evita "Carregando..." infinito). **Validado**: release 1.0.8 instalada em PC de dev; servidor ativo em `http://192.168.100.6:1420`; teste no celular e outro computador — login funcional, dashboard estável, nenhuma rota dashboard↔login.

2. **Validação "duas palavras" em nome e nome_responsavel** — implementada no frontend (Zod schema com `refine` para `nome` e `nome_responsavel`), impedindo cadastro de nomes contendo duas palavras separadas por espaço. Feedback visual: mensagem de erro clara indicando campo inválido.

3. **Campo `dia_vencimento` no cadastro de aluno** — agora disponível no formulário de novo aluno (select 1-31) e no backend (struct `Aluno` com `dia_vencimento: Option<i64>`). As 6 funções de criação e leitura de Aluno foram atualizadas para incluir o campo (`criar_aluno`, `get_aluno_by_id`, `update_aluno`, `get_alunos_by_turma`, `listar_alunos_paginado`, `listar_alunos`). Build Rust compilou sem erros (0 erros) após adição do campo.

4. **Tema claro fixo no mobile** — configurado `darkMode: 'none'` no `tailwind.config.js`, forçando modo claro no mobile (igual ao desktop), independentemente da configuração do sistema do usuário.

5. **Correção de contador de mensalidades para mês atual apenas** — card e alerta do dashboard agora contam apenas as mensalidades pendentes do mês corrente (`strftime('%Y-%m', vencimento) = mês corrente` + `deleted_at IS NULL`), com alerta singular/plural correto ("1 mensalidade pendente neste mês"). Dados de teste (Leandro + 2 mensalidades) mantidos no banco, mas contador reflete apenas mês atual.

---

### 1.0.4 -> 1.0.5 (18/08/2026)

1. **Pasta de backups em Documentos** - antes so era criada pelo instalador; agora o app
   cria `Documents\Cuidar-ERP\Backups` a cada abertura e antes de cada backup.
2. **Backup mensal de verdade** - o intervalo 720h ja existia, mas so rodava ao clicar em
   "Verificar Auto"; agora o app verifica sozinho 15s apos abrir (se `next_backup_at` venceu,
   executa o backup e agenda o proximo).
3. **Estrutura de pastas dos backups** - subpasta mensal `Documents\Cuidar-ERP\Backups\<AAAA-MM>`
   (antes diaria); nome do arquivo com data+horario legiveis: `backup_2026-08-18_14-30-00.db`.
4. **Backup por partes** - `backup.rs` ganhou BACKUP_PARTS (7 dominios: alunos, turmas,
   frequencias, ocorrencias, funcionarios, financeiro, configuracoes); cada parte e um
   arquivo .db criado via ATTACH (CREATE TABLE AS SELECT); comando `criar_backup_partes`.
   Nota em `database_backups.notes` = "parte: <nome>" (badge roxo na UI).
5. **Restauracao com 2 modos** - `restaurar_backup` agora recebe `mode` ("replace"|"merge"):
   substituir = DELETE + INSERT das tabelas do backup; acrescentar = INSERT por id com
   NOT EXISTS. Backup geral em modo substituir continua sendo copia de arquivo.
   Backup parcial/general e detectado por `schema_migrations` no arquivo (nao pela nota).
   Cache global e limpo apos restaurar.
6. **Numero de matricula** - migration 020 (`alunos.numero_matricula` + indice unico parcial);
   sequencial automatico desde "01" (MAX(CAST(...))+1 em criar_aluno), somente leitura na UI;
   exibido em listagem, cadastro, relatorios (PDF/Excel) e junto ao nome em Mensalidades
   e Financeiro-Alunos. Alunos existentes renumerados na ordem de criacao.
7. **Instalador (.rbf / Painel de Controle)** - suspeita: instalacao com o app aberto
   (exe bloqueado) -> rollback -> sem entrada no Painel de Controle + sobras .rbf.
   Medidas: `MsiLogging=voicewarmupx` no pacote + `/l*v C:\CuidarErp-Install.log` no
   instalador.exe (diagnostico na proxima tentativa); KillAppOnInstall (mesmo comando do
   uninstall) antes de InstallFiles; orientacao de limpar `D:\Config.Msi` antigos.

### 1.0.3 -> 1.0.4 (18/08/2026)

1. **Acentuação quebrada (mojibake)** - textos como "comeÃ§ar"/"VocÃª" em 4 telas
   (alunos, turmas, funcionarios, ocorrencias): texto duplamente codificado (UTF-8 lido
   como Latin-1). Corrigido em nível de bytes (77 substituicoes), varredura completa
   confirmou 0 restantes; demais arquivos ja estavam corretos.
2. **"% Folha/Receita"** - removido o "%" redundante do card (o icone Percent ja
   comunica); no PDF o "%" permanece.
3. **Caixinha do valor da mensalidade** - CurrencyInput de "Valor da Mensalidade
   (Opcional)" (novo/editar aluno) sem className (input sem borda); agora usa INPUT_CLASS.
4. **Cache** - vincular/desvincular servico e update_valor_acordado_servico nao
   invalidavam o cache; dashboard ficava defasado ate 1h. Agora invalidam "dashboard:".
5. **Taxa de matricula** - migration 019 (`mensalidades.taxa_matricula`); ao gerar
   mensalidades, alunos com `created_at` no mes da referencia recebem automaticamente
   a taxa configurada (creche.taxa_matricula) somada ao valor, so no mes do cadastro;
   comando `atualizar_taxa_matricula_mensalidade` (recalcula valor = valor - taxa_antiga
   + taxa_nova); UI: botao de lapis por linha -> dialogo com checkbox "Cobrar taxa de
   matricula" + campo de valor ao lado; listagem e dialogo de pagamento mostram
   "inclui taxa de matricula R$ X".

### 1.0.2 -> 1.0.3 (18/08/2026)

1. **Ocorrencias quebrava ("missing required key")** - causa raiz: o frontend enviava
   argumentos com chaves snake_case (data_inicio, uncionario_id) aos comandos Tauri,
   que exigem camelCase (dataInicio, uncionarioId); structs Rust usam snake_case das
   fields via chave (o, unc, etc.). Corrigido em 8 arquivos e validado via CDP no
   dev app (relatorio de ocorrencias carrega sem erro).
2. **Calendarios** - react-calendar 6.0.1 + componente CalendarioPicker (dia/mes/ano,
   navegador de anos, pt-BR) nas telas de frequencia (relatorio com picker por periodo:
   dia/semanal/mensal/semestral/anual) e frequencia de funcionarios.
3. **Edicao de frequencia** - historico da turma editavel (linha clicavel carrega o dia,
   destaque na data ativa) e salvamento por aluno com justificativa obrigatoria em "outros".
4. **Escala de trabalho** - 5 comandos Rust (listar/criar/get/update/delete, soft delete),
   pagina Funcionarios -> Escalas (filtros, modal, exclusao), campo no cadastro
   (novo/editar) e coluna na lista; FuncionarioComCargo ganhou escala_nome (LEFT JOIN).
5. **Turmas no novo funcionario** - checkboxes + vinculo automatico apos criar
   (dicionar_funcionario_turma com retorno do id).
6. **Relatorios por categoria** - filtro de turma no relatorio de alunos (store persistente)
   e filtros de cargo/status ativo-inativo no relatorio de funcionarios.
7. **Dados fora da pasta de instalacao** - banco/exportacoes/restauracoes em
   %ProgramData%\Cuidar-ERP-VDA\Data; migracao automatica dos dados legados na 1a execucao.
8. **Backups** - Documents\Cuidar-ERP\Backups\<AAAA-MM-DD> (subpasta por data).
9. **Instalacao (WiX)** - pasta Cuidar-ERP na raiz da instalacao (Backups/Relatorios/
   Documentos), pasta de backups em Documentos criada na instalacao, permissao de
   instalacao em outro HD/SSD (WixUI_InstallDir), desinstalacao limpa (app encerrado,
   dados preservados ou removidos por opcao do usuario).
10. **release.ps1** - comandos nativos agora via cmd /c "... 2>&1" (PS 5.1 +
    $ErrorActionPreference=Stop abortava com qualquer linha no stderr).

## 6. Estrutura de dados (SQLite)

- Tabelas principais: alunos, turmas, funcionarios, cargo, escala_trabalho, frequencias,
  frequencia_registros, mensalidades, matriculas, ocorrencias (com coluna `tipo`),
  pagamentos_salarios, gastos_fixos, company_revenues, company_expenses, servicos,
  aluno_servicos, creche, users, audit_log, schema_migrations
- Schema versionado: migrations 001..020 (migração 012 = índice único mensalidades;
  falha se houver duplicados; 019 = taxa de matrícula; 020 = número de matrícula —
  banco de produção validado com todas as 20 aplicadas)

## 7. Backup / rollback

Backups em `C:\projetos\backups\`:
- `cuidar-erp-vila-do-aprender_pre-1.0.2_20260817_185642/` (fontes)
- `cuidar-erp-vila-do-aprender_pre-1.0.2_20260817_185727/` (banco + dist 1.0.1 + instruções)
- Instruções de restauração: `LEIA-ME-RESTAURACAO.txt` dentro do backup

## 8. Scripts

- `release.ps1` (raiz do projeto): pipeline de release automatizado - lê a versão do
  `tauri.conf.json` (ou `-Version X.Y.Z`), valida consistência nos 5 arquivos, roda
  `npm run build` + `npx tauri build`, arquiva entregáveis antigos do `dist`, copia o MSI
  (`cuidarerp-latest.msi` + versionado), builda o instalador e valida o resultado
  (instalador > MSI, versão do exe). Criado em 18/08/2026; usado a partir da 1.0.2.

## 9. Regras de ouro (armadilhas conhecidas)

- **Em dash** "-" no nome do produto - sempre usar `-` (U+2014) em comandos/verificações
- **Nunca** usar colunas que não existem nos SQLs (verificar schema real antes)
- **Rotas dinâmicas `[id]` não funcionam** com Tauri + export estático - usar rotas estáticas `?id=`
- Versões em 4 arquivos devem estar sempre sincronizadas
- `dist/cuidarerp-latest.msi` deve existir antes de buildar o instalador (include_bytes falha sem ele)
- MSI antigo deve ser arquivado antes de sobrescrever `cuidarerp-latest.msi`
- Encoding dos arquivos de config: UTF-8 sem BOM (com em dash)
- PS 5.1: usar `[System.Text.Encoding]::GetEncoding(28591)` (Latin1 não existe no .NET Framework)