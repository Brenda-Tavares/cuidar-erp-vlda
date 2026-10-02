# Testes End-to-End (E2E) com Cypress

## Visão Geral

Este projeto utiliza Cypress para testes de integração end-to-end, validando fluxos completos do sistema Cuidar-ERP.

## Pré-requisitos

1. Node.js instalado (versão 18+)
2. Aplicação rodando em modo desenvolvimento (`npm run dev`)
3. Banco de dados inicializado com dados de teste

## Instalação

```bash
npm install
```

## Executando Testes

### Modo Interativo (com interface gráfica)

```bash
npm run cypress:open
```

Isso abrirá o Cypress Test Runner onde você pode:
- Selecionar quais testes executar
- Ver execução em tempo real
- Debugar falhas facilmente

### Modo Headless (CI/CD)

```bash
npm run cypress:run
```

Executa todos os testes sem interface gráfica, ideal para pipelines de CI/CD.

### Com Navegador Específico

```bash
npm run cypress:run:chrome
npm run cypress:run:firefox
```

### Iniciar Servidor Automaticamente

```bash
npm run test:e2e:dev
```

Este comando inicia o servidor Next.js automaticamente antes de abrir o Cypress.

## Estrutura dos Testes

```
cypress/
├── e2e/              # Testes organizados por funcionalidade
│   ├── auth/         # Login, logout, autenticação
│   ├── alunos/       # CRUD de alunos
│   ├── funcionarios/ # CRUD de funcionários
│   ├── financeiro/   # Mensalidades, despesas, receitas
│   ├── relatorios/   # Geração e exportação de relatórios
│   └── config/       # Configurações do sistema
├── support/          # Comandos customizados e configurações
├── fixtures/         # Dados de teste (JSON)
└── plugins/          # Plugins do Cypress
```

## Escrevendo Novos Testes

### Estrutura Básica

```javascript
describe('Nome do Feature', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/caminho-da-pagina')
  })

  it('deve fazer algo específico', () => {
    cy.get('input[name="campo"]').type('valor')
    cy.get('button[type="submit"]').click()
    cy.shouldShowSuccessToast(/mensagem.*sucesso/i)
  })
})
```

### Comandos Customizados

- `cy.login(username, password)` - Faz login automaticamente
- `cy.navigateTo(path)` - Navega para uma página
- `cy.mockTauriInvoke(command, response)` - Mocka resposta do Tauri
- `cy.fillAlunoForm(data)` - Preenche formulário de aluno
- `cy.shouldShowSuccessToast(message)` - Valida toast de sucesso
- `cy.shouldShowErrorToast(message)` - Valida toast de erro
- `cy.waitForLoading()` - Aguarda loading desaparecer
- `cy.shouldHaveTableData(minRows)` - Valida que tabela tem dados

### Mockando Chamadas Tauri

Como o Cypress testa a interface web, é necessário mockar as chamadas Tauri:

```javascript
cy.mockTauriInvoke('listar_alunos', [
  { id: 1, nome: 'João', status: 'ativo' },
  { id: 2, nome: 'Maria', status: 'ativo' }
])
```

## Boas Práticas

1. **Teste comportamentos, não implementação**: Foque no que o usuário vê e faz
2. **Use data-testid**: Adicione atributos `data-testid` em elementos importantes
3. **Mantenha testes independentes**: Cada teste deve funcionar isoladamente
4. **Limpe estado entre testes**: Use `beforeEach` para resetar estado
5. **Use fixtures para dados**: Armazene dados de teste em arquivos JSON
6. **Teste casos de erro**: Valide que o sistema lida bem com erros
7. **Evite testes frágeis**: Não dependa de timings específicos

## Debugando Testes Falhos

1. **Screenshots automáticos**: Cypress tira screenshot automaticamente em falhas
2. **Vídeos**: Habilite vídeos em `cypress.config.js` para ver execução completa
3. **Console do navegador**: Use `cy.pause()` para inspecionar estado
4. **Time travel**: No modo interativo, clique em comandos para ver snapshots

## Integração com CI/CD

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:e2e
```

## Cobertura Atual

- ✅ Autenticação (login, logout, bloqueio)
- ✅ CRUD de Alunos
- ✅ CRUD de Funcionários
- ✅ Operações Financeiras
- ✅ Geração de Relatórios
- ✅ Configurações (Serviços, Backups)

## Próximos Passos

1. Adicionar testes para fluxos complexos (frequência, ocorrências)
2. Implementar testes de performance
3. Adicionar testes de acessibilidade
4. Integrar com cobertura de código
