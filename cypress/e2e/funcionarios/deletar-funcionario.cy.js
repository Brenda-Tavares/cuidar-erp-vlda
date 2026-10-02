describe('Deletar Funcionário', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/funcionarios')
  })

  it('deve exibir modal de confirmação', () => {
    cy.get('button[data-testid="delete-funcionario-1"], button:contains("Deletar")').first().click()

    cy.get('[data-testid="confirm-dialog"], .modal').should('be.visible')
    cy.contains(/tem certeza|confirma.*deleção/i).should('be.visible')
  })

  it('deve cancelar deleção', () => {
    cy.get('button[data-testid="delete-funcionario-1"], button:contains("Deletar")').first().click()
    cy.contains('Cancelar').click()

    cy.get('[data-testid="confirm-dialog"], .modal').should('not.exist')
    cy.url().should('include', '/funcionarios')
  })

  it('deve confirmar deleção e remover da lista', () => {
    cy.get('button[data-testid="delete-funcionario-1"], button:contains("Deletar")').first().click()
    cy.contains('Confirmar').click()

    cy.shouldShowSuccessToast(/funcionário.*deletado|sucesso/i)
    cy.get('[data-testid="funcionario-1"]').should('not.exist')
  })
})
