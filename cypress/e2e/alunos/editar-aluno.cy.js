describe('Editar Aluno', () => {
  beforeEach(() => {
    cy.login()

    cy.mockTauriInvoke('get_aluno_by_id', {
      id: 1,
      nome: 'João Silva',
      cpf: '123.456.789-00',
      data_nascimento: '2020-01-15',
      turma_id: 1,
      status: 'ativo'
    })

    cy.navigateTo('/alunos/1')
  })

  it('deve carregar dados do aluno', () => {
    cy.get('input[name="nome"]').should('have.value', 'João Silva')
    cy.get('input[name="cpf"]').should('have.value', '123.456.789-00')
  })

  it('deve atualizar nome do aluno', () => {
    cy.get('input[name="nome"]').clear().type('João Silva Atualizado')
    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/aluno.*atualizado|sucesso/i)
  })

  it('deve validar alterações inválidas', () => {
    cy.get('input[name="nome"]').clear().type('A')
    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/nome.*curto/i)
  })
})
