describe('Receitas', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/financeiro/receitas')
  })

  it('deve listar receitas', () => {
    cy.shouldHaveTableData(1)
  })

  it('deve criar nova receita', () => {
    cy.contains('Nova Receita').click()

    cy.get('input[name="categoria"]').type('Mensalidade')
    cy.get('input[name="descricao"]').type('Recebimento mensalidade João')
    cy.get('input[name="valor"]').type('500')
    cy.get('input[name="data_receita"]').type('2024-01-20')

    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/receita.*criada|sucesso/i)
  })

  it('deve validar valor negativo', () => {
    cy.contains('Nova Receita').click()

    cy.get('input[name="categoria"]').type('Teste')
    cy.get('input[name="valor"]').type('-50')
    cy.get('input[name="data_receita"]').type('2024-01-20')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/valor.*positivo/i)
  })
})
