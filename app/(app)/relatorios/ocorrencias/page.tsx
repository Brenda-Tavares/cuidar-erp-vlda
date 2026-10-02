'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Download, FileText, Filter, AlertCircle } from 'lucide-react'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { useFiltroDataRelatorio } from '@/lib/hooks/useFiltroDataRelatorio'
import { useToast } from '@/lib/context/ToastContext'
import { exportarParaPasta } from '@/lib/utils/export-manager'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface Ocorrencia {
  id: number
  aluno_id: number
  data: string
  descricao: string
  tipo?: string
}

interface Aluno {
  id: number
  nome: string
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getTypeColor(tipo?: string): string {
  switch (tipo) {
    case 'Positiva':
      return 'bg-green-100 text-green-800'
    case 'Negativa':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-yellow-100 text-yellow-800'
  }
}

export default function OcorrenciasReportPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [alunos, setAlunos] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const { dataInicio, dataFim, setDataInicio, setDataFim } =
    useFiltroDataRelatorio('ocorrencias')
  const [filterType, setFilterType] = useState<string>('todos')
  const [filterAluno, setFilterAluno] = useState<string>('todos')
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [dataInicio, dataFim])

  const loadData = async () => {
    setLoading(true)
    try {
      const alunosList = await invoke<Aluno[]>('listar_alunos')
      const alunosMap = new Map(alunosList.map((a) => [a.id, a.nome]))
      setAlunos(alunosMap)

      const ocorrenciasData = await invoke<Ocorrencia[]>('get_ocorrencias_periodo', {
        dataInicio: dataInicio,
        dataFim: dataFim,
      })
      setOcorrencias(ocorrenciasData || [])
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error)
      toast.addToast('Erro ao carregar ocorrências', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredOcorrencias = ocorrencias.filter((o) => {
    const typeMatch = filterType === 'todos' || o.tipo === filterType
    const alunoMatch = filterAluno === 'todos' || o.aluno_id.toString() === filterAluno
    return typeMatch && alunoMatch
  })

  const stats = {
    total: filteredOcorrencias.length,
    positivas: filteredOcorrencias.filter((o) => o.tipo === 'Positiva').length,
    negativas: filteredOcorrencias.filter((o) => o.tipo === 'Negativa').length,
    neutras: filteredOcorrencias.filter((o) => !o.tipo || o.tipo === 'Neutra').length,
    unique_alunos: new Set(filteredOcorrencias.map((o) => o.aluno_id)).size,
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const doc = await createDoc()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPosition = 15

      doc.setFontSize(14)
      yPosition += 8
      doc.text('Relatório de Ocorrências', 15, yPosition)
      yPosition += 10

      doc.setFontSize(9)
      doc.text(`Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}`, 15, yPosition)
      doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 15, yPosition, { align: 'right' })
      yPosition += 5
      if (filterType !== 'todos') {
        doc.text(`Filtro Tipo: ${filterType}`, 15, yPosition)
        yPosition += 5
      }
      if (filterAluno !== 'todos') {
        doc.text(`Filtro Aluno: ${alunos.get(parseInt(filterAluno)) || 'N/A'}`, 15, yPosition)
        yPosition += 5
      }
      yPosition += 3

      doc.setFontSize(9)
      doc.setFillColor(245, 245, 245)
      doc.rect(15, yPosition, pageWidth - 30, 20, 'F')
      doc.text(`Total: ${stats.total} | Positivas: ${stats.positivas} | Negativas: ${stats.negativas} | Neutras: ${stats.neutras} | Alunos únicos: ${stats.unique_alunos}`, 15, yPosition + 5)
      yPosition += 25

      doc.setFontSize(9)
      const columns = ['Data', 'Aluno', 'Tipo', 'Descrição']
      const rows = filteredOcorrencias.map((o) => [
        formatDate(o.data),
        alunos.get(o.aluno_id) || 'N/A',
        o.tipo || 'Neutra',
        o.descricao.substring(0, 40) + (o.descricao.length > 40 ? '...' : ''),
      ])

      await autoTable(doc, {
        head: [columns],
        body: rows,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },
          1: { cellWidth: 45, fontStyle: 'bold' },
          3: { cellWidth: 50 },
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

      const nomeArquivo = `ocorrencias_${dataInicio}_${dataFim}.pdf`
      const blob = doc.output('blob')
      const saved = await exportarParaPasta('relatorios_ocorrencias', nomeArquivo, blob)
      if (saved) toast.addToast('PDF exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      toast.addToast('Erro ao exportar PDF', 'error')
    } finally {
      setExporting(false)
    }
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      const headers = ['Data', 'Aluno', 'Tipo', 'Descrição']
      const rows = filteredOcorrencias.map((o) => [
        formatDate(o.data),
        alunos.get(o.aluno_id) || 'N/A',
        o.tipo || 'Neutra',
        o.descricao,
      ])
      const csvContent = [
        '\uFEFF' + headers.join(';'),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
      ].join('\n')
      const nomeArquivo = `ocorrencias_${dataInicio}_${dataFim}.csv`
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const saved = await exportarParaPasta('relatorios_ocorrencias', nomeArquivo, blob)
      if (saved) toast.addToast('CSV exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar Excel:', error)
      toast.addToast('Erro ao exportar Excel', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatório de Ocorrências</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatório de Ocorrências</h1>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input autoComplete="off"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input autoComplete="off"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="todos">Todos</option>
              <option value="Positiva">Positiva</option>
              <option value="Negativa">Negativa</option>
              <option value="Neutra">Neutra</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
            <select
              value={filterAluno}
              onChange={(e) => setFilterAluno(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm max-w-xs"
            >
              <option value="todos">Todos</option>
              {Array.from(alunos.values())
                .sort()
                .map((nome, idx) => {
                  const alunoId = Array.from(alunos.entries()).find((e) => e[1] === nome)?.[0]
                  return (
                    <option key={alunoId} value={alunoId}>
                      {nome}
                    </option>
                  )
                })}
            </select>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={exportPDF}
          disabled={exporting || filteredOcorrencias.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <FileText className="h-4 w-4" />
          {exporting ? 'Exportando PDF...' : 'Exportar PDF'}
        </button>
        <button
          onClick={exportExcel}
          disabled={exporting || filteredOcorrencias.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-green-600 uppercase tracking-wide font-medium">Positivas</div>
          <div className="text-2xl font-bold text-green-600">{stats.positivas}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-red-600 uppercase tracking-wide font-medium">Negativas</div>
          <div className="text-2xl font-bold text-red-600">{stats.negativas}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-yellow-600 uppercase tracking-wide font-medium">Neutras</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.neutras}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-indigo-600 uppercase tracking-wide font-medium">Alunos</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.unique_alunos}</div>
        </div>
      </div>

      {/* Results Table */}
      {filteredOcorrencias.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhuma ocorrência encontrada com os filtros aplicados</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOcorrencias.map((ocorrencia) => (
                <TableRow key={ocorrencia.id}>
                  <TableCell className="text-gray-900">{formatDate(ocorrencia.data)}</TableCell>
                  <TableCell className="text-gray-900">{alunos.get(ocorrencia.aluno_id) || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(ocorrencia.tipo)}`}>
                      {ocorrencia.tipo || 'Neutra'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600 max-w-md truncate">{ocorrencia.descricao}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

