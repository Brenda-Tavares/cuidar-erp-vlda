describe('Mensalidades', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/mensalidades')
  })

  it('deve listar mensalidades', () => {
    cy.shouldHaveTableData(1)
    cy.contains(/pago|pendente/i).should('be.visible')
  })

  it('deve filtrar mensalidades por status', () => {
    cy.get('select[name="status"]').select('pendente')
    cy.waitForLoading()

    cy.get('table tbody tr').each(($row) => {
      cy.wrap($row).contains(/pendente/i)
    })
  })

  it('deve marcar mensalidade como paga', () => {
    cy.get('button[data-testid="pagar-mensalidade-2"], button:contains("Pagar")').first().click()

    cy.get('[data-testid="confirm-dialog"], .modal').should('be.visible')
    cy.get('input[name="data_pagamento"]').type('2024-01-15')
    cy.get('select[name="forma_pagamento"]').select('pix')
    cy.contains('Confirmar').click()

    cy.shouldShowSuccessToast(/mensalidade.*paga|sucesso/i)
  })
})
