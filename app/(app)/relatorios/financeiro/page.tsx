'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { ArrowLeft, DollarSign, AlertCircle, FileDown, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportFinanceiroExcel } from '@/lib/utils/excel-exporter'
import { formatDataBR, formatDataExibicao, formatMoeda } from '@/lib/utils/date-formatter'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useFiltroDataRelatorio } from '@/lib/hooks/useFiltroDataRelatorio'
import { exportarParaPasta } from '@/lib/utils/export-manager'
import { useToast } from '@/lib/context/ToastContext'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

const PERIODOS = ['Dia', 'Semanal', 'Mensal', 'Semestral', 'Anual'] as const

async function exportarPDF(
  titulo: string,
  periodo: string,
  mensalidades: Mensalidade[],
  alunos: Aluno[],
  totalPago: number,
  totalPendente: number,
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  try {
    const doc = await createDoc()

    doc.setFontSize(14)
    doc.text(titulo, 15, 20)
    doc.setFontSize(10)
    doc.text(`Período: ${periodo}`, 15, 28)
    doc.text(new Date().toLocaleDateString('pt-BR'), 200, 28, { align: 'right' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMO', 15, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Total Recebido: ${totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 15, 46)
    doc.text(`Total Pendente: ${totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 15, 52)

    function getAlunoNome(alunoId: number): string {
      return alunos.find((a) => a.id === alunoId)?.nome ?? `Aluno #${alunoId}`
    }

    const body = mensalidades.map((m) => [
      getAlunoNome(m.aluno_id),
      formatDataBR(m.vencimento),
      formatMoeda(m.valor),
      m.pago === 1 ? 'Pago' : 'Pendente',
    ])

    await autoTable(doc, {
      startY: 60,
      head: [['Aluno', 'Vencimento', 'Valor', 'Status']],
      body,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 24, 39] },
      foot: [['', 'Total', formatMoeda(totalPago + totalPendente), '']],
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { fontStyle: 'bold' },
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
    const nomeArquivo = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`
    const path = await exportarParaPasta('relatorios_financeiros', nomeArquivo, blob)
    if (path) addToast?.('PDF exportado com sucesso!', 'success')
  } catch (error) {
    console.error('Error generating PDF:', error)
    addToast?.('Erro ao gerar relatório', 'error')
  }
}

interface Mensalidade {
  id: number
  aluno_id: number
  vencimento: string
  valor: number
  pago: number
}

interface Aluno {
  id: number
  nome: string
}

export default function RelatorioFinanceiroPage() {
  const router = useRouter()
  const filtro = useFiltroDataRelatorio('financeiro')
  const { addToast } = useToast()
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [periodo, setPeriodo] = useState<string>('Mensal')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [exportDropdown, setExportDropdown] = useState(false)

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const alunosData = await invoke<Aluno[]>('listar_alunos')
        setAlunos(alunosData)

        let mensalidadesData: Mensalidade[]
        if (filtro.usarFiltro && filtro.dataInicio && filtro.dataFim) {
          mensalidadesData = await invoke<Mensalidade[]>('get_mensalidades_periodo', {
            dataInicio: filtro.dataInicio,
            dataFim: filtro.dataFim,
          })
        } else {
          mensalidadesData = await invoke<Mensalidade[]>('get_mensalidades')
        }

        setMensalidades(mensalidadesData)
      } catch (error) {
        console.error(error)
        setMensalidades([])
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [filtro.usarFiltro, filtro.dataInicio, filtro.dataFim])

  const totalPago = mensalidades.filter((m) => m.pago === 1).reduce((acc, m) => acc + m.valor, 0)
  const totalPendente = mensalidades.filter((m) => m.pago === 0).reduce((acc, m) => acc + m.valor, 0)

  function getAlunoNome(alunoId: number): string {
    return alunos.find((a) => a.id === alunoId)?.nome ?? `Aluno #${alunoId}`
  }

  const chartData = mensalidades
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .reduce((acc: any[], m) => {
      const existingEntry = acc.find((entry) => entry.date === m.vencimento)
      if (existingEntry) {
        if (m.pago === 1) {
          existingEntry.pago += m.valor
        } else {
          existingEntry.pendente += m.valor
        }
      } else {
        acc.push({
          date: m.vencimento,
          pago: m.pago === 1 ? m.valor : 0,
          pendente: m.pago === 0 ? m.valor : 0,
        })
      }
      return acc
    }, [])

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/relatorios')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Relatórios
        </Button>
        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"
          >
            {PERIODOS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
           </select>
            <div className="relative">
             <Button 
               variant="outline" 
               size="sm" 
               onClick={() => setExportDropdown(!exportDropdown)}
               className="flex items-center gap-1"
             >
               <FileDown className="h-4 w-4" />
               Exportar
               <ChevronDown className="h-3 w-3" />
             </Button>
             {exportDropdown && (
               <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      exportarPDF('Relatório Financeiro', periodo, mensalidades, alunos, totalPago, totalPendente, addToast).catch(console.error)
                      setExportDropdown(false)
                    }}
                   className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
                 >
                   <FileDown className="h-4 w-4" />
                   Exportar PDF
                 </button>
                  <button
                    onClick={async () => {
                      await exportFinanceiroExcel(mensalidades, alunos, totalPago, totalPendente, periodo)
                      setExportDropdown(false)
                    }}
                   className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm border-t border-gray-200 dark:border-gray-600"
                 >
                   <FileDown className="h-4 w-4" />
                   Exportar Excel
                 </button>
               </div>
             )}
           </div>
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Relatório Financeiro</h1>
        <p className="text-sm text-muted-foreground">Resumo de receitas, mensalidades pendentes e histórico</p>
      </div>

       <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input autoComplete="off"
                type="checkbox"
                checked={filtro.usarFiltro}
                onChange={(e) => filtro.setUsarFiltro(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por período personalizado</span>
            </label>
            
            {filtro.usarFiltro && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">De:</label>
                  <input autoComplete="off"
                    type="date"
                    value={filtro.dataInicio}
                    onChange={(e) => filtro.setDataInicio(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Até:</label>
                  <input autoComplete="off"
                    type="date"
                    value={filtro.dataFim}
                    onChange={(e) => filtro.setDataFim(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </>
            )}
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2.5 text-green-600 dark:text-green-400"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Recebido</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatMoeda(totalPago)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2.5 text-red-600 dark:text-red-400"><AlertCircle className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Pendente</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatMoeda(totalPendente)}</p>
            </div>
          </div>
        </div>
      </div>

      {mensalidades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4"><DollarSign className="h-8 w-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-1">Nenhum registro encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Cadastre mensalidades para visualizar o relatório financeiro.</p>
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Evolução de Receitas e Pendências</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                   <XAxis 
                     dataKey="date" 
                     tickFormatter={(date) => formatDataExibicao(date)}
                   />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
                  />
                   <Tooltip 
                     formatter={(value) => typeof value === 'number' ? formatMoeda(value) : value}
                     labelFormatter={(date) => formatDataExibicao(date)}
                   />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="pago" 
                    stroke="#10b981" 
                    name="Pago"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pendente" 
                    stroke="#ef4444" 
                    name="Pendente"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensalidades.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">{getAlunoNome(m.aluno_id)}</TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">{formatDataExibicao(m.vencimento)}</TableCell>
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">{formatMoeda(m.valor)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${m.pago === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {m.pago === 1 ? 'Pago' : 'Pendente'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

