Cypress.Commands.add('login', (username = 'admin', password = 'admin123') => {
  cy.visit('/login')
  cy.get('input[name="username"]').type(username)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('navigateTo', (path) => {
  cy.visit(path)
  cy.url().should('include', path)
})

Cypress.Commands.add('mockTauriInvoke', (command, response, delay = 0) => {
  cy.get('@tauriInvoke').then((invoke) => {
    invoke.withArgs(command).callsFake(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(response), delay)
      })
    })
  })
})

Cypress.Commands.add('fillAlunoForm', (alunoData) => {
  if (alunoData.nome) {
    cy.get('input[name="nome"]').clear().type(alunoData.nome)
  }
  if (alunoData.cpf) {
    cy.get('input[name="cpf"]').clear().type(alunoData.cpf)
  }
  if (alunoData.data_nascimento) {
    cy.get('input[name="data_nascimento"]').clear().type(alunoData.data_nascimento)
  }
  if (alunoData.turma_id) {
    cy.get('select[name="turma_id"]').select(alunoData.turma_id)
  }
})

Cypress.Commands.add('shouldShowSuccessToast', (message) => {
  cy.contains(message || /sucesso|success/i).should('be.visible')
})

Cypress.Commands.add('shouldShowErrorToast', (message) => {
  cy.contains(message || /erro|error/i).should('be.visible')
})

Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-testid="loading"], .loading, .skeleton').should('not.exist')
})

Cypress.Commands.add('shouldHaveTableData', (minRows = 1) => {
  cy.get('table tbody tr').should('have.length.at.least', minRows)
})
