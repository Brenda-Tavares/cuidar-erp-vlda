import { create } from 'zustand'

interface FiltrosRelatorios {
  frequencia: { dataInicio: string; dataFim: string; usarFiltro: boolean }
  financeiro: { dataInicio: string; dataFim: string; usarFiltro: boolean }
  alunos: { filtroStatus: 'todos' | 'ativo' | 'inativo'; filtroTurma: number | 'todas' }
}

interface RelatoriosState {
  filtros: FiltrosRelatorios
  setFrequenciaDataInicio: (data: string) => void
  setFrequenciaDataFim: (data: string) => void
  setFrequenciaUsarFiltro: (usar: boolean) => void
  setFrequenciaFiltros: (dataInicio: string, dataFim: string, usarFiltro: boolean) => void
  setFinanceiroDataInicio: (data: string) => void
  setFinanceiroDataFim: (data: string) => void
  setFinanceiroUsarFiltro: (usar: boolean) => void
  setFinanceiroFiltros: (dataInicio: string, dataFim: string, usarFiltro: boolean) => void
  setAlunosFiltroStatus: (status: 'todos' | 'ativo' | 'inativo') => void
  setAlunosFiltroTurma: (turma: number | 'todas') => void
  resetFiltros: () => void
}

function getFiltrosDefault(): FiltrosRelatorios {
  const hoje = new Date()
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    frequencia: { dataInicio: trintaDiasAtras.toISOString().split('T')[0], dataFim: hoje.toISOString().split('T')[0], usarFiltro: false },
    financeiro: { dataInicio: trintaDiasAtras.toISOString().split('T')[0], dataFim: hoje.toISOString().split('T')[0], usarFiltro: false },
    alunos: { filtroStatus: 'todos', filtroTurma: 'todas' },
  }
}

export const useRelatoriosStore = create<RelatoriosState>((set) => ({
  filtros: getFiltrosDefault(),

  setFrequenciaDataInicio: (data) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, frequencia: { ...state.filtros.frequencia, dataInicio: data } } })),
  setFrequenciaDataFim: (data) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, frequencia: { ...state.filtros.frequencia, dataFim: data } } })),
  setFrequenciaUsarFiltro: (usar) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, frequencia: { ...state.filtros.frequencia, usarFiltro: usar } } })),
  setFrequenciaFiltros: (dataInicio, dataFim, usarFiltro) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, frequencia: { dataInicio, dataFim, usarFiltro } } })),

  setFinanceiroDataInicio: (data) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, financeiro: { ...state.filtros.financeiro, dataInicio: data } } })),
  setFinanceiroDataFim: (data) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, financeiro: { ...state.filtros.financeiro, dataFim: data } } })),
  setFinanceiroUsarFiltro: (usar) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, financeiro: { ...state.filtros.financeiro, usarFiltro: usar } } })),
  setFinanceiroFiltros: (dataInicio, dataFim, usarFiltro) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, financeiro: { dataInicio, dataFim, usarFiltro } } })),

  setAlunosFiltroStatus: (status) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, alunos: { ...state.filtros.alunos, filtroStatus: status } } })),

  setAlunosFiltroTurma: (turma) =>
    set((state) => ({ ...state, filtros: { ...state.filtros, alunos: { ...state.filtros.alunos, filtroTurma: turma } } })),

  resetFiltros: () => set({ filtros: getFiltrosDefault() }),
}))
