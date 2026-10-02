describe('Deletar Aluno', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/alunos')
  })

  it('deve exibir modal de confirmação', () => {
    cy.get('button[data-testid="delete-aluno-1"], button:contains("Deletar")').first().click()

    cy.get('[data-testid="confirm-dialog"], .modal').should('be.visible')
    cy.contains(/tem certeza|confirma.*deleção/i).should('be.visible')
  })

  it('deve cancelar deleção', () => {
    cy.get('button[data-testid="delete-aluno-1"], button:contains("Deletar")').first().click()
    cy.contains('Cancelar').click()

    cy.get('[data-testid="confirm-dialog"], .modal').should('not.exist')
    cy.url().should('include', '/alunos')
  })

  it('deve confirmar deleção e remover da lista', () => {
    cy.get('button[data-testid="delete-aluno-1"], button:contains("Deletar")').first().click()
    cy.contains('Confirmar').click()

    cy.shouldShowSuccessToast(/aluno.*deletado|sucesso/i)
    cy.get('[data-testid="aluno-1"]').should('not.exist')
  })
})
