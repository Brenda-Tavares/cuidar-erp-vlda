describe('Logout', () => {
  beforeEach(() => {
    cy.login()
  })

  it('deve fazer logout e redirecionar para login', () => {
    cy.get('[data-testid="user-menu"], .user-menu').click()
    cy.contains('Sair').click()

    cy.url().should('include', '/login')
    cy.shouldShowSuccessToast(/logout|desconectado/i)
  })

  it('deve limpar dados de sessão após logout', () => {
    cy.get('[data-testid="user-menu"], .user-menu').click()
    cy.contains('Sair').click()

    cy.window().then((win) => {
      expect(win.localStorage.getItem('access_token')).to.be.null
      expect(win.localStorage.getItem('refresh_token')).to.be.null
    })
  })
})
