'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { ArrowLeft, BarChart3, Calendar, FileDown, ChevronDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { exportarParaPasta } from '@/lib/utils/export-manager'
import { useToast } from '@/lib/context/ToastContext'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import CalendarioPicker from '@/components/frequencia/CalendarioPicker'

const PERIODOS = ['Dia', 'Semanal', 'Mensal', 'Semestral', 'Anual'] as const
type Periodo = typeof PERIODOS[number]

interface Turma {
  id: number
  nome: string
  ano: number | null
  turno: string | null
}

interface FrequenciaAlunoPeriodo {
  aluno_id: number
  aluno_nome: string
  presentes: number
  ausencias: number
  total_registros: number
  percentual_presenca: number
}

interface FrequenciaPeriodoResponse {
  total_alunos: number
  total_presencas: number
  total_ausencias: number
  percentual_presenca_geral: number
  percentual_ausencia_geral: number
  alunos: FrequenciaAlunoPeriodo[]
  periodo_inicio: string
  periodo_fim: string
}

function formatDateBR(dateStr: string): string {
  try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') } catch { return dateStr }
}

function getWeekRange(dateStr: string): { inicio: string; fim: string } {
  const dt = new Date(dateStr + 'T00:00:00')
  const day = dt.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(dt)
  monday.setDate(dt.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    inicio: monday.toISOString().split('T')[0],
    fim: sunday.toISOString().split('T')[0],
  }
}

function getPercentColor(pct: number): string {
  if (pct >= 75) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function getPercentBg(pct: number): string {
  if (pct >= 75) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  if (pct >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

function parseDateBR(value: string): Date {
  try {
    const dt = new Date(value.length <= 7 ? `${value}-01T00:00:00` : `${value}T00:00:00`)
    return isNaN(dt.getTime()) ? new Date() : dt
  } catch {
    return new Date()
  }
}

async function exportarPDF(
  titulo: string,
  response: FrequenciaPeriodoResponse,
  turmaNome: string,
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  try {
    const doc = await createDoc()
    doc.setFontSize(14)
    doc.text(titulo, 15, 20)
    doc.setFontSize(10)
    doc.text(`Turma: ${turmaNome}`, 15, 28)
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 200, 28, { align: 'right' })

    const body = response.alunos.map((a) => [
      a.aluno_nome,
      String(a.presentes),
      String(a.ausencias),
      `${a.percentual_presenca.toFixed(1)}%`,
    ])

    await autoTable(doc, {
      startY: 36,
      head: [['Aluno', 'Presenças', 'Ausências', '% Presença']],
      body,
      foot: [[
        { content: `Total: ${response.total_alunos} alunos`, colSpan: 2, styles: { fontStyle: 'bold' } },
        { content: `${response.total_presencas} pres / ${response.total_ausencias} aus`, colSpan: 1 },
        { content: `${response.percentual_presenca_geral.toFixed(1)}%`, styles: { fontStyle: 'bold' } },
      ]],
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { fontStyle: 'bold' },
      },
    })

    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `© ${new Date().getFullYear()} · Cuidar ERP™ by ShipClaw`,
      pw / 2,
      ph - 15,
      { align: 'center' }
    )
    doc.text('Todos os direitos reservados.', pw / 2, ph - 10, { align: 'center' })

    const blob = doc.output('blob')
    const nomeArquivo = `relatorio-frequencia-${new Date().toISOString().split('T')[0]}.pdf`
    const path = await exportarParaPasta('relatorios_frequencia', nomeArquivo, blob)
    if (path) addToast?.(`PDF salvo em: ${path}`, 'success')
  } catch (error) {
    console.error('Error generating PDF:', error)
  }
}

async function exportarExcel(response: FrequenciaPeriodoResponse, addToast?: (msg: string, type: 'success' | 'error' | 'info') => void) {
  const BOM = '\uFEFF'
  const header = 'Aluno;Presenças;Ausências;Total;% Presença\n'
  const rows = response.alunos.map((a) =>
    `${a.aluno_nome};${a.presentes};${a.ausencias};${a.total_registros};${a.percentual_presenca.toFixed(1)}%`
  ).join('\n')
  const footer = `\nResumo;${response.total_presencas} pres;${response.total_ausencias} aus;;${response.percentual_presenca_geral.toFixed(1)}%`
  const csv = BOM + header + rows + footer
  const nome = `relatorio-frequencia-${new Date().toISOString().split('T')[0]}.csv`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const path = await exportarParaPasta('relatorios_frequencia', nome, blob)
  if (path) addToast?.(`CSV salvo em: ${path}`, 'success')
}

export default function RelatorioFrequenciaPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('Mensal')
  const [response, setResponse] = useState<FrequenciaPeriodoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportDropdown, setExportDropdown] = useState(false)

  const [dataDia, setDataDia] = useState(new Date().toISOString().split('T')[0])
  const [dataSemana, setDataSemana] = useState(new Date().toISOString().split('T')[0])
  const [mesMensal, setMesMensal] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [semestreSemestral, setSemestreSemestral] = useState('1')
  const [anoSemestral, setAnoSemestral] = useState(String(new Date().getFullYear()))
  const [anoAnual, setAnoAnual] = useState(String(new Date().getFullYear()))

  const [error, setError] = useState('')

  useEffect(() => {
    invoke<Turma[]>('get_turmas')
      .then(setTurmas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const carregarDados = async () => {
    if (!turmaId) return
    const tid = parseInt(turmaId)
    setLoading(true)
    setError('')

    try {
      let res: FrequenciaPeriodoResponse | null = null

      switch (periodo) {
        case 'Dia':
          res = await invoke<FrequenciaPeriodoResponse>('get_frequencia_diaria', { turmaId: tid, data: dataDia })
          break
        case 'Semanal': {
          const { inicio, fim } = getWeekRange(dataSemana)
          res = await invoke<FrequenciaPeriodoResponse>('get_frequencia_semanal', { turmaId: tid, data: inicio })
          break
        }
        case 'Mensal': {
          const [anoStr, mesStr] = mesMensal.split('-')
          res = await invoke<FrequenciaPeriodoResponse>('get_frequencia_mensal', { turmaId: tid, mes: parseInt(mesStr), ano: parseInt(anoStr) })
          break
        }
        case 'Semestral':
          res = await invoke<FrequenciaPeriodoResponse>('get_frequencia_semestral', { turmaId: tid, semestre: parseInt(semestreSemestral), ano: parseInt(anoSemestral) })
          break
        case 'Anual':
          res = await invoke<FrequenciaPeriodoResponse>('get_frequencia_anual', { turmaId: tid, ano: parseInt(anoAnual) })
          break
      }

      setResponse(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setResponse(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (turmaId) carregarDados()
  }, [turmaId, periodo, dataDia, dataSemana, mesMensal, semestreSemestral, anoSemestral, anoAnual])

  const handlePeriodChange = (novoPeriodo: string) => {
    setPeriodo(novoPeriodo as Periodo)
    setResponse(null)
    setExportDropdown(false)
  }

  const getTituloDinamico = (): string => {
    if (!response) return 'Relatório de Frequência'
    const turmaNome = turmas.find((t) => String(t.id) === turmaId)?.nome || ''
    switch (periodo) {
      case 'Dia': return `Relatório de Frequência Diário - ${formatDateBR(dataDia)}`
      case 'Semanal': {
        const { inicio, fim } = getWeekRange(dataSemana)
        return `Relatório de Frequência Semanal - ${formatDateBR(inicio)} a ${formatDateBR(fim)}`
      }
      case 'Mensal': {
        const [anoStr, mesStr] = mesMensal.split('-')
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
        return `Relatório de Frequência Mensal - ${meses[parseInt(mesStr) - 1]}/${anoStr}`
      }
      case 'Semestral': return `Relatório de Frequência Semestral - ${semestreSemestral}º Semestre/${anoSemestral}`
      case 'Anual': return `Relatório de Frequência Anual - ${anoAnual}`
    }
  }

  if (loading && !turmaId) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/relatorios')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        {response && (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setExportDropdown(!exportDropdown)} className="flex items-center gap-1">
              <FileDown className="h-4 w-4" />
              Exportar <ChevronDown className="h-3 w-3" />
            </Button>
            {exportDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <button onClick={() => { setExportDropdown(false); exportarPDF(getTituloDinamico(), response!, turmas.find((t) => String(t.id) === turmaId)?.nome || '', addToast).catch(console.error) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4" /> Exportar PDF
                </button>
                <button onClick={async () => { setExportDropdown(false); await exportarExcel(response!, addToast) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm border-t border-gray-200 dark:border-gray-700">
                  <Download className="h-4 w-4" /> Exportar CSV
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatório de Frequência</h1>
        <p className="text-sm text-muted-foreground">Frequência dos alunos por período e turma</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Turma</label>
              <Select value={turmaId} onValueChange={setTurmaId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Período</label>
              <Select value={periodo} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {periodo === 'Dia' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data</label>
                <CalendarioPicker mode="date" value={parseDateBR(dataDia)} onChange={(d) => setDataDia(d.toISOString().split('T')[0])} />
              </div>
            )}

            {periodo === 'Semanal' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qualquer dia da semana</label>
                <CalendarioPicker mode="date" value={parseDateBR(dataSemana)} onChange={(d) => setDataSemana(d.toISOString().split('T')[0])} />
              </div>
            )}

            {periodo === 'Mensal' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mês</label>
                <CalendarioPicker
                  mode="month"
                  value={parseDateBR(mesMensal)}
                  onChange={(d) => setMesMensal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)}
                />
              </div>
            )}

            {periodo === 'Semestral' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Semestre</label>
                  <div className="flex gap-2 h-10 items-center">
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input autoComplete="off" type="radio" name="semestre" value="1" checked={semestreSemestral === '1'}
                        onChange={(e) => setSemestreSemestral(e.target.value)} className="text-indigo-600" /> 1º
                    </label>
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input autoComplete="off" type="radio" name="semestre" value="2" checked={semestreSemestral === '2'}
                        onChange={(e) => setSemestreSemestral(e.target.value)} className="text-indigo-600" /> 2º
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ano</label>
                  <CalendarioPicker mode="year" value={parseDateBR(`${anoSemestral}-01`)} onChange={(d) => setAnoSemestral(String(d.getFullYear()))} />
                </div>
              </>
            )}

            {periodo === 'Anual' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ano</label>
                <CalendarioPicker mode="year" value={parseDateBR(`${anoAnual}-01`)} onChange={(d) => setAnoAnual(String(d.getFullYear()))} />
              </div>
            )}

            <Button onClick={carregarDados} disabled={!turmaId || loading}>
              <Calendar className="h-4 w-4 mr-2" />
              {loading ? 'Carregando...' : 'Gerar Relatório'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!turmaId && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Selecione uma turma para gerar o relatório</p></CardContent></Card>
      )}

      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"><CardContent className="py-4"><p className="text-sm text-red-600 dark:text-red-400">{error}</p></CardContent></Card>
      )}

      {loading && turmaId && (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
      )}

      {response && !loading && (
        <>
          {/* Dynamic Title */}
          <Card>
            <CardContent className="py-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{getTituloDinamico()}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Turma: {turmas.find((t) => String(t.id) === turmaId)?.nome} &mdash; 
                Período: {formatDateBR(response.periodo_inicio)} a {formatDateBR(response.periodo_fim)}
              </p>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Alunos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{response.total_alunos}</p></CardContent></Card>
            <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400">Presenças</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{response.total_presencas}</p></CardContent></Card>
            <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400">Ausências</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{response.total_ausencias}</p></CardContent></Card>
            <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400">% Presença</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${getPercentColor(response.percentual_presenca_geral)}`}>{response.percentual_presenca_geral.toFixed(1)}%</p></CardContent></Card>
            <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400">% Ausência</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${getPercentColor(100 - response.percentual_ausencia_geral)}`}>{response.percentual_ausencia_geral.toFixed(1)}%</p></CardContent></Card>
          </div>

          {/* Aluno Table */}
          {response.alunos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum registro de frequência encontrado no período</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Frequência por Aluno</CardTitle>
                <CardDescription>{response.alunos.length} aluno(s) no período</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-center">Ausências</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">% Presença</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {response.alunos.map((aluno) => (
                      <TableRow key={aluno.aluno_id}>
                        <TableCell className="font-bold text-gray-900 dark:text-gray-100">{aluno.aluno_nome}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">{aluno.presentes}</TableCell>
                        <TableCell className="text-center font-semibold text-red-600">{aluno.ausencias}</TableCell>
                        <TableCell className="text-center text-gray-600 dark:text-gray-400">{aluno.total_registros}</TableCell>
                        <TableCell className={`text-center font-bold ${getPercentColor(aluno.percentual_presenca)}`}>
                          {aluno.percentual_presenca.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getPercentBg(aluno.percentual_presenca)}>
                            {aluno.percentual_presenca >= 75 ? 'Regular' : aluno.percentual_presenca >= 50 ? 'Atenção' : 'Crítico'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow>
                      <TableCell className="font-bold text-gray-900 dark:text-gray-100">Total</TableCell>
                      <TableCell className="text-center font-bold text-green-600">{response.total_presencas}</TableCell>
                      <TableCell className="text-center font-bold text-red-600">{response.total_ausencias}</TableCell>
                      <TableCell className="text-center font-bold">{response.total_presencas + response.total_ausencias}</TableCell>
                      <TableCell className={`text-center font-bold ${getPercentColor(response.percentual_presenca_geral)}`}>
                        {response.percentual_presenca_geral.toFixed(1)}%
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </tfoot>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Week Range Info */}
          {periodo === 'Semanal' && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Semana de <strong>{formatDateBR(getWeekRange(dataSemana).inicio)}</strong> a <strong>{formatDateBR(getWeekRange(dataSemana).fim)}</strong>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

