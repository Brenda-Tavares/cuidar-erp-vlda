describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('deve exibir formulário de login', () => {
    cy.get('input[name="username"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('deve fazer login com credenciais válidas', () => {
    cy.get('input[name="username"]').type('admin')
    cy.get('input[name="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/dashboard')
    cy.shouldShowSuccessToast(/login.*sucesso|bem-vindo/i)
  })

  it('deve exibir erro com credenciais inválidas', () => {
    cy.get('input[name="username"]').type('admin')
    cy.get('input[name="password"]').type('senhaerrada')
    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/login')
    cy.shouldShowErrorToast(/credenciais.*inválidas|senha.*incorreta/i)
  })

  it('deve validar campos obrigatórios', () => {
    cy.get('button[type="submit"]').click()

    cy.get('input[name="username"]:invalid').should('exist')
    cy.get('input[name="password"]:invalid').should('exist')
  })

  it('deve bloquear após 5 tentativas falhas', () => {
    for (let i = 0; i < 5; i++) {
      cy.get('input[name="username"]').clear().type('admin')
      cy.get('input[name="password"]').clear().type('senhaerrada')
      cy.get('button[type="submit"]').click()
      cy.shouldShowErrorToast()
    }

    cy.get('input[name="username"]').clear().type('admin')
    cy.get('input[name="password"]').clear().type('senhaerrada')
    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/bloqueado|tente.*novamente.*após/i)
  })
})
