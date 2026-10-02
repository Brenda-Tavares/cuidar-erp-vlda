describe('Criar Aluno', () => {
  beforeEach(() => {
    cy.login()
    cy.navigateTo('/alunos/novo')
  })

  it('deve exibir formulário de criação', () => {
    cy.get('input[name="nome"]').should('be.visible')
    cy.get('input[name="cpf"]').should('be.visible')
    cy.get('input[name="data_nascimento"]').should('be.visible')
    cy.get('select[name="turma_id"]').should('be.visible')
  })

  it('deve criar aluno com dados válidos', () => {
    const alunoData = {
      nome: 'Teste Cypress Aluno',
      cpf: '123.456.789-00',
      data_nascimento: '2020-01-15',
      turma_id: '1'
    }

    cy.fillAlunoForm(alunoData)
    cy.get('button[type="submit"]').click()

    cy.shouldShowSuccessToast(/aluno.*criado|sucesso/i)
    cy.url().should('include', '/alunos')
  })

  it('deve validar CPF inválido', () => {
    cy.get('input[name="nome"]').type('Teste Aluno')
    cy.get('input[name="cpf"]').type('111.111.111-11')
    cy.get('input[name="data_nascimento"]').type('2020-01-15')
    cy.get('select[name="turma_id"]').select('1')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/cpf.*inválido/i)
  })

  it('deve validar nome muito curto', () => {
    cy.get('input[name="nome"]').type('A')
    cy.get('input[name="cpf"]').type('123.456.789-00')
    cy.get('input[name="data_nascimento"]').type('2020-01-15')
    cy.get('select[name="turma_id"]').select('1')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/nome.*curto|mínimo.*2/i)
  })

  it('deve validar data de nascimento futura', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    cy.get('input[name="nome"]').type('Teste Aluno')
    cy.get('input[name="cpf"]').type('123.456.789-00')
    cy.get('input[name="data_nascimento"]').type(futureDateStr)
    cy.get('select[name="turma_id"]').select('1')

    cy.get('button[type="submit"]').click()

    cy.shouldShowErrorToast(/data.*futura/i)
  })
})
