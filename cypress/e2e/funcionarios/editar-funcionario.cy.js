describe('Editar Funcionário', () => {
  beforeEach(() => {
    cy.login()

    cy.mockTauriInvoke('get_funcionario_by_id', {
      id: 1,
      nome: 'Ana Oliveira',
      cpf: '987.654.321-00',
      email: 'ana@email.com',
      cargo_id: 1,
      salario: 3500,
      status: 'ativo'
    })

    cy.navigateTo('/funcionarios/1')
  })

  it('deve carregar dados do funcionário', () => {
    cy.get('input[name="nome"]').should('have.value', 'Ana Oliveira')
    cy.get('input[name="cpf"]').should('have.value', '987.654.321-00')
  })

  it('deve atualizar nome do funcionário', () => {
    cy.get('input[name="nome"]').clear().type('Ana Oliveira Atualizada')
    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/funcionário.*atualizado|sucesso/i)
  })

  it('deve validar alterações inválidas', () => {
    cy.get('input[name="nome"]').clear().type('A')
    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/nome.*curto/i)
  })
})
