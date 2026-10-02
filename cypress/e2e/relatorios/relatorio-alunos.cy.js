describe('Relatório de Alunos', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/relatorios/alunos')
  })

  it('deve exibir estatísticas', () => {
    cy.contains(/total.*alunos/i).should('be.visible')
    cy.contains(/ativos/i).should('be.visible')
    cy.contains(/inativos/i).should('be.visible')
  })

  it('deve exportar relatório em PDF', () => {
    cy.contains('Exportar PDF').click()
    cy.shouldShowSuccessToast(/pdf.*exportado|sucesso/i)
  })

  it('deve exportar relatório em Excel', () => {
    cy.contains('Exportar Excel').click()
    cy.shouldShowSuccessToast(/excel.*exportado|sucesso/i)
  })

  it('deve filtrar por status', () => {
    cy.get('select[name="status"]').select('ativos')
    cy.waitForLoading()
    cy.get('table tbody tr').should('have.length.at.least', 1)
  })
})
