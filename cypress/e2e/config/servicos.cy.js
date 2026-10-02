describe('Serviços', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/configuracoes/servicos')
  })

  it('deve listar serviços cadastrados', () => {
    cy.shouldHaveTableData(1)
    cy.contains(/ativo|inativo/i).should('be.visible')
  })

  it('deve criar novo serviço', () => {
    cy.contains('Novo Serviço').click()

    cy.get('input[name="nome"]').type('Teste Cypress Serviço')
    cy.get('input[name="valor_padrao"]').type('150')

    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/serviço.*criado|sucesso/i)
  })

  it('deve validar valor negativo', () => {
    cy.contains('Novo Serviço').click()

    cy.get('input[name="nome"]').type('Serviço Inválido')
    cy.get('input[name="valor_padrao"]').type('-100')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/valor.*positivo/i)
  })
})
