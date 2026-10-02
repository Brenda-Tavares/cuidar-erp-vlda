'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { ArrowLeft, Users, FileDown, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportAlunosExcel } from '@/lib/utils/excel-exporter'
import { formatDataBR } from '@/lib/utils/date-formatter'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useRelatoriosStore } from '@/lib/store/relatorios-store'
import { exportarParaPasta } from '@/lib/utils/export-manager'
import { useToast } from '@/lib/context/ToastContext'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

const PERIODOS = ['Dia', 'Semanal', 'Mensal', 'Semestral', 'Anual'] as const

async function exportarPDF(titulo: string, periodo: string, alunos: Aluno[], turmas: Turma[], addToast?: (msg: string, type: 'success' | 'error' | 'info') => void) {
  try {
    const doc = await createDoc()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    function getTurmaInfo(turmaId?: number) {
      if (!turmaId) return { nome: '', turno: '' }
      const turma = turmas.find((t) => t.id === turmaId)
      return turma ? { nome: turma.nome, turno: turma.turno || '' } : { nome: '', turno: '' }
    }

    doc.setFontSize(14)
    doc.text(titulo, 15, 20)
    doc.setFontSize(10)
    doc.text(`Período: ${periodo}`, 15, 28)
    doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 15, 28, { align: 'right' })

    const body = alunos.map((aluno) => {
      const turmaInfo = getTurmaInfo(aluno.turma_id)
      return [
        aluno.numero_matricula || '-',
        aluno.nome,
        formatDataBR(aluno.data_nascimento),
        aluno.nome_responsavel,
        turmaInfo.nome,
        turmaInfo.turno,
        aluno.status,
      ]
    })

    await autoTable(doc, {
      startY: 35,
      head: [['Matrícula', 'Nome', 'Nascimento', 'Responsável', 'Turma', 'Turno', 'Status']],
      body,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: {
        0: { fontStyle: 'bold' },
      },
    })

    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `© ${new Date().getFullYear()} · Cuidar ERP™ by ShipClaw`,
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' }
    )
    doc.text('Todos os direitos reservados.', pageWidth / 2, pageHeight - 10, { align: 'center' })

    const blob = doc.output('blob')
    const nomeArquivo = `relatorio_alunos_${new Date().toISOString().split('T')[0]}.pdf`
    const path = await exportarParaPasta('relatorios_alunos', nomeArquivo, blob)
    if (path) addToast?.('PDF exportado com sucesso!', 'success')
  } catch (error) {
    console.error('Error generating PDF:', error)
    addToast?.('Erro ao gerar relatório', 'error')
  }
}

interface Aluno {
  id: number
  nome: string
  data_nascimento: string
  nome_responsavel: string
  telefone_responsavel: string
  status: string
  turma_id?: number
  numero_matricula?: string | null
}

interface Turma {
  id: number
  nome: string
  turno?: string
}

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

export default function RelatorioAlunosPage() {
  const router = useRouter()
  const store = useRelatoriosStore()
  const { addToast } = useToast()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [periodo, setPeriodo] = useState<string>('Mensal')
  const [loading, setLoading] = useState(true)
  const [exportDropdown, setExportDropdown] = useState(false)

  const filtroStatus = store.filtros.alunos.filtroStatus
  const filtroTurma = store.filtros.alunos.filtroTurma

  useEffect(() => {
    Promise.all([
      invoke<Aluno[]>('listar_alunos'),
      invoke<Turma[]>('get_turmas'),
    ])
      .then(([alunos, turmas]) => {
        setAlunos(alunos)
        setTurmas(turmas)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function formatDate(dateStr: string): string {
    return formatDataBR(dateStr)
  }

  function getTurmaInfo(turmaId?: number) {
    if (!turmaId) return { nome: '', turno: '' }
    const turma = turmas.find((t) => t.id === turmaId)
    return turma ? { nome: turma.nome, turno: turma.turno || '' } : { nome: '', turno: '' }
  }

  const alunosFiltrados = alunos.filter((a) => {
    if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false
    if (filtroTurma !== 'todas' && a.turma_id !== filtroTurma) return false
    return true
  })

  const distribuicaoTurma = turmas.map((turma) => ({
    name: turma.nome,
    alunos: alunos.filter((a) => a.turma_id === turma.id).length,
    turno: turma.turno || 'S/turno',
  }))

  const totalComTurma = alunos.filter((a) => a.turma_id).length
  const semTurma = alunos.filter((a) => !a.turma_id).length

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
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
               <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      exportarPDF('Relatório de Alunos', periodo, alunosFiltrados, turmas, addToast).catch(console.error)
                      setExportDropdown(false)
                    }}
                   className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                 >
                   <FileDown className="h-4 w-4" />
                   Exportar PDF
                 </button>
                  <button
                    onClick={async () => {
                      await exportAlunosExcel(alunos, turmas, periodo)
                      setExportDropdown(false)
                    }}
                   className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm border-t border-gray-200 dark:border-gray-700"
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
        <h1 className="text-2xl font-bold tracking-tight">Relatório de Alunos</h1>
        <p className="text-sm text-muted-foreground">Dados cadastrais e distribuição por turma</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filtroTurma === 'todas' ? '' : String(filtroTurma)}
          onChange={(e) => store.setAlunosFiltroTurma(e.target.value ? parseInt(e.target.value) : 'todas')}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas as turmas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        {(['todos', 'ativo', 'inativo'] as const).map((key) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1)
          return (
            <button
              key={key}
               onClick={() => store.setAlunosFiltroStatus(key as any)}
               className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroStatus === key
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {alunos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4"><Users className="h-8 w-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-1">Nenhum registro encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Cadastre alunos para visualizar o relatório.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Distribuição de Alunos por Turma</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={distribuicaoTurma}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="alunos" fill="#4f46e5" name="Quantidade de Alunos" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total de Alunos</p>
                  <p className="text-3xl font-bold text-indigo-600">{alunos.length}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Com Turma</p>
                  <p className="text-3xl font-bold text-green-600">{totalComTurma}</p>
                </div>
              </div>
              {semTurma > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Sem Turma</p>
                    <p className="text-3xl font-bold text-orange-600">{semTurma}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {alunosFiltrados.map((aluno) => {
                    const turmaInfo = getTurmaInfo(aluno.turma_id)
                    return (
                      <TableRow key={aluno.id}>
                        <TableCell className="font-mono text-xs text-gray-500 dark:text-gray-400">{aluno.numero_matricula || '-'}</TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">{aluno.nome}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{formatDate(aluno.data_nascimento)}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{aluno.nome_responsavel}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{turmaInfo.nome || '-'}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{turmaInfo.turno || '-'}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{aluno.telefone_responsavel}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${aluno.status === 'ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                            {aluno.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
               </TableBody>
             </Table>
            </div>
          </>
        )}
     </div>
  )
}
