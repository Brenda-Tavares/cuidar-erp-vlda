import './commands'
import './mocks'

Cypress.on('uncaught:exception', (err, runnable) => {
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  return false
})

beforeEach(() => {
  cy.clearLocalStorage()
  cy.window().then((win) => {
    win.__TAURI__ = {
      invoke: cy.stub().as('tauriInvoke')
    }
  })
})
