describe('Relatório Financeiro', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/relatorios/financeiro')
  })

  it('deve exibir cards de resumo', () => {
    cy.contains(/receitas|despesas|lucro|saldo/i).should('be.visible')
  })

  it('deve exibir tabela de dados', () => {
    cy.shouldHaveTableData(1)
  })

  it('deve exportar relatório em PDF', () => {
    cy.contains('Exportar PDF').click()
    cy.shouldShowSuccessToast(/pdf.*exportado|sucesso/i)
  })

  it('deve exportar relatório em CSV', () => {
    cy.contains('Exportar CSV').click()
    cy.shouldShowSuccessToast(/csv.*exportado|sucesso/i)
  })
})
