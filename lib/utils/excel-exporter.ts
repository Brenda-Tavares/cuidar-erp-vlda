import * as XLSX from 'xlsx'
import { formatDataBR, formatMoeda } from './date-formatter'
import { salvarXLSX } from './save-with-dialog'

interface FrequenciaExport {
  Aluno: string
  'Responsável': string
  Status: string
  'Última Frequência': string
  Presença: string
}

interface FinanceiroExport {
  Aluno: string
  Vencimento: string
  Valor: string
  Status: string
}

interface AlunosExport {
  Nome: string
  Nascimento: string
  Responsável: string
  Turma: string
  Turno: string
  Telefone: string
  Status: string
}

export async function exportFrequenciaExcel(
  alunos: Array<{ id: number; nome: string; nome_responsavel: string; status: string }>,
  frequencias: Map<number, { aluno_id: number; data: string; presente: boolean }>,
  periodo: string
) {
  const data: FrequenciaExport[] = alunos.map((aluno) => {
    const freq = frequencias.get(aluno.id)
    return {
      Aluno: aluno.nome,
      'Responsável': aluno.nome_responsavel,
      Status: aluno.status,
      'Última Frequência': freq ? formatDataBR(freq.data) : 'Sem registro',
      Presença: freq ? (freq.presente ? 'Presente' : 'Ausente') : '-',
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Frequência')

  const presentes = Array.from(frequencias.values()).filter((f) => f.presente).length
  const ausentes = Array.from(frequencias.values()).filter((f) => !f.presente).length

  const resumoData = [
    { Métrica: 'Total de Alunos', Quantidade: alunos.length },
    { Métrica: 'Presentes', Quantidade: presentes },
    { Métrica: 'Ausentes', Quantidade: ausentes },
    {
      Métrica: 'Taxa de Presença',
      Quantidade: frequencias.size > 0 ? ((presentes / frequencias.size) * 100).toFixed(2) + '%' : '0%',
    },
  ]

  const resumoSheet = XLSX.utils.json_to_sheet(resumoData)
  XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo')

  const nome = `Relatorio_Frequencia_${periodo}_${new Date().toISOString().split('T')[0]}.xlsx`
  const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  await salvarXLSX(new Uint8Array(buf), nome)
}

export async function exportFinanceiroExcel(
  mensalidades: Array<{ id?: number; aluno_id: number; vencimento: string; valor: number; pago?: number }>,
  alunos: Array<{ id: number; nome: string }>,
  totalPago: number,
  totalPendente: number,
  periodo: string
) {
  function getAlunoNome(alunoId: number): string {
    return alunos.find((a) => a.id === alunoId)?.nome ?? `Aluno #${alunoId}`
  }

  const data: FinanceiroExport[] = mensalidades.map((m) => ({
    Aluno: getAlunoNome(m.aluno_id),
    Vencimento: formatDataBR(m.vencimento),
    Valor: formatMoeda(m.valor),
    Status: m.pago === 1 ? 'Pago' : 'Pendente',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mensalidades')

  const resumoData = [
    { Métrica: 'Total de Mensalidades', Valor: `${mensalidades.length}` },
    {
      Métrica: 'Total Recebido',
      Valor: formatMoeda(totalPago),
    },
    {
      Métrica: 'Total Pendente',
      Valor: formatMoeda(totalPendente),
    },
    {
      Métrica: 'Total Geral',
      Valor: formatMoeda(totalPago + totalPendente),
    },
  ]

  const resumoSheet = XLSX.utils.json_to_sheet(resumoData)
  XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo')

  const nome = `Relatorio_Financeiro_${periodo}_${new Date().toISOString().split('T')[0]}.xlsx`
  const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  await salvarXLSX(new Uint8Array(buf), nome)
}

export async function exportAlunosExcel(
  alunos: Array<{ id: number; nome: string; data_nascimento: string; nome_responsavel: string; telefone_responsavel: string; status: string; turma_id?: number }>,
  turmas: Array<{ id: number; nome: string; turno?: string }>,
  periodo: string
) {
  function getTurmaInfo(turmaId?: number) {
    if (!turmaId) return { nome: '-', turno: '-' }
    const turma = turmas.find((t) => t.id === turmaId)
    return turma ? { nome: turma.nome, turno: turma.turno || '-' } : { nome: '-', turno: '-' }
  }

  const data: AlunosExport[] = alunos.map((aluno) => {
    const turmaInfo = getTurmaInfo(aluno.turma_id)
    return {
      Nome: aluno.nome,
      Nascimento: formatDataBR(aluno.data_nascimento),
      Responsável: aluno.nome_responsavel,
      Turma: turmaInfo.nome,
      Turno: turmaInfo.turno,
      Telefone: aluno.telefone_responsavel,
      Status: aluno.status,
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Alunos')

  const totalComTurma = alunos.filter((a) => a.turma_id).length
  const semTurma = alunos.filter((a) => !a.turma_id).length

  const resumoData = [
    { Métrica: 'Total de Alunos', Quantidade: alunos.length },
    { Métrica: 'Com Turma Atribuída', Quantidade: totalComTurma },
    { Métrica: 'Sem Turma', Quantidade: semTurma },
  ]

  const resumoSheet = XLSX.utils.json_to_sheet(resumoData)
  XLSX.utils.book_append_sheet(workbook, resumoSheet, 'Resumo')

  const nome = `Relatorio_Alunos_${periodo}_${new Date().toISOString().split('T')[0]}.xlsx`
  const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  await salvarXLSX(new Uint8Array(buf), nome)
}
