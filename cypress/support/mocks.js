export const defaultMocks = {
  login: { success: true, user: { id: 1, username: 'admin', role: 'admin' } },
  logout: { success: true },

  listar_alunos: [
    { id: 1, nome: 'João Silva', cpf: '123.456.789-00', data_nascimento: '2020-01-15', turma_id: 1, status: 'ativo' },
    { id: 2, nome: 'Maria Santos', cpf: '987.654.321-00', data_nascimento: '2019-05-20', turma_id: 1, status: 'ativo' }
  ],
  criar_aluno: 3,
  get_aluno_by_id: { id: 1, nome: 'João Silva', cpf: '123.456.789-00', data_nascimento: '2020-01-15', turma_id: 1, status: 'ativo' },
  update_aluno: { success: true },
  delete_aluno: { success: true },

  listar_funcionarios: [
    { id: 1, nome: 'Ana Oliveira', cargo: 'Professor', salario: 3500, status: 'ativo' },
    { id: 2, nome: 'Carlos Souza', cargo: 'Auxiliar', salario: 2000, status: 'ativo' }
  ],
  criar_funcionario: 3,
  get_funcionario_by_id: { id: 1, nome: 'Ana Oliveira', cargo: 'Professor', salario: 3500, status: 'ativo' },
  update_funcionario: { success: true },
  delete_funcionario: { success: true },

  get_turmas: [
    { id: 1, nome: 'Turma A - Matutino', ano: 2024, status: 'ativa' },
    { id: 2, nome: 'Turma B - Vespertino', ano: 2024, status: 'ativa' }
  ],

  get_mensalidades: [
    { id: 1, aluno_id: 1, valor: 500, vencimento: '2024-01-10', pago: true },
    { id: 2, aluno_id: 2, valor: 500, vencimento: '2024-01-10', pago: false }
  ],

  get_relatorio_alunos: { total: 2, ativos: 2, inativos: 0 },
  get_relatorio_frequencia: { total: 100, presentes: 85, ausentes: 15 },
  get_relatorio_financeiro: { receitas: 10000, despesas: 3000, lucro: 7000 }
}

beforeEach(() => {
  cy.window().then((win) => {
    if (win.__TAURI__ && win.__TAURI__.invoke) {
      Object.keys(defaultMocks).forEach((command) => {
        win.__TAURI__.invoke.withArgs(command).resolves(defaultMocks[command])
      })
    }
  })
})
