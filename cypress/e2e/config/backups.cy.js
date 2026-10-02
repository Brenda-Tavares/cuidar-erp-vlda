describe('Backups', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/configuracoes/backups')
  })

  it('deve exibir página de backups', () => {
    cy.contains(/backup/i).should('be.visible')
    cy.contains('Criar Backup Manual').should('be.visible')
  })

  it('deve criar backup manual', () => {
    cy.contains('Criar Backup Manual').click()
    cy.shouldShowSuccessToast(/backup.*criado|sucesso/i)
  })

  it('deve exibir configurações', () => {
    cy.contains('Configurações').click()
    cy.contains('Backup Automático').should('be.visible')
    cy.contains('Intervalo').should('be.visible')
    cy.contains('Retenção').should('be.visible')
  })

  it('deve listar backups existentes', () => {
    cy.get('table').should('be.visible')
    cy.contains(/arquivo|tipo|tamanho|data|validação/i).should('be.visible')
  })
})
