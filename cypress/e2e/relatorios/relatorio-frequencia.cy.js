describe('Relatório de Frequência', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/relatorios/frequencia')
  })

  it('deve exibir seletor de período', () => {
    cy.get('select[name="periodo"]').should('be.visible')
    cy.get('input[type="month"], input[type="date"]').should('be.visible')
  })

  it('deve gerar relatório', () => {
    cy.get('button[type="submit"], button:contains("Gerar")').click()
    cy.waitForLoading()
    cy.shouldHaveTableData(1)
  })

  it('deve exportar relatório', () => {
    cy.get('button[type="submit"], button:contains("Gerar")').click()
    cy.waitForLoading()
    cy.contains('Exportar PDF').click()
    cy.shouldShowSuccessToast(/pdf.*exportado|sucesso/i)
  })
})
