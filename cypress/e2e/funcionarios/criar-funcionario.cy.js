describe('Criar Funcionário', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/funcionarios/novo')
  })

  it('deve exibir formulário de criação', () => {
    cy.get('input[name="nome"]').should('be.visible')
    cy.get('input[name="cpf"]').should('be.visible')
    cy.get('input[name="salario"]').should('be.visible')
    cy.get('select[name="cargo_id"]').should('be.visible')
  })

  it('deve criar funcionário com dados válidos', () => {
    cy.get('input[name="nome"]').type('Teste Cypress Funcionário')
    cy.get('input[name="cpf"]').type('987.654.321-00')
    cy.get('input[name="salario"]').type('3500')
    cy.get('select[name="cargo_id"]').select('1')
    cy.get('input[name="data_admissao"]').type('2024-01-15')

    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/funcionário.*criado|sucesso/i)
    cy.url().should('include', '/funcionarios')
  })

  it('deve validar salário negativo', () => {
    cy.get('input[name="nome"]').type('Teste Funcionário')
    cy.get('input[name="cpf"]').type('987.654.321-00')
    cy.get('input[name="salario"]').type('-1000')
    cy.get('select[name="cargo_id"]').select('1')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/salário.*positivo|valor.*inválido/i)
  })

  it('deve validar email inválido', () => {
    cy.get('input[name="nome"]').type('Teste Funcionário')
    cy.get('input[name="cpf"]').type('987.654.321-00')
    cy.get('input[name="email"]').type('email-invalido')
    cy.get('input[name="salario"]').type('3500')
    cy.get('select[name="cargo_id"]').select('1')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/email.*inválido/i)
  })
})
