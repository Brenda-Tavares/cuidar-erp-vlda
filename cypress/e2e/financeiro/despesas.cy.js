describe('Despesas', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/financeiro/despesas')
  })

  it('deve listar despesas', () => {
    cy.shouldHaveTableData(1)
  })

  it('deve criar nova despesa', () => {
    cy.contains('Nova Despesa').click()

    cy.get('input[name="categoria"]').type('Material de Escritório')
    cy.get('input[name="descricao"]').type('Compra de papel A4')
    cy.get('input[name="valor"]').type('150')
    cy.get('input[name="data_despesa"]').type('2024-01-20')

    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/despesa.*criada|sucesso/i)
  })

  it('deve validar valor negativo', () => {
    cy.contains('Nova Despesa').click()

    cy.get('input[name="categoria"]').type('Teste')
    cy.get('input[name="valor"]').type('-100')
    cy.get('input[name="data_despesa"]').type('2024-01-20')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/valor.*positivo/i)
  })
})
