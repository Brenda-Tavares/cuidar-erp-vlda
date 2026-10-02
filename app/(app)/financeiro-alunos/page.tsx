'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DollarSign, Calendar, FileText, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { formatDataBR, formatMoeda } from '@/lib/utils/date-formatter'
import { exportarParaPasta } from '@/lib/utils/export-manager'

interface Mensalidade {
  id: number
  aluno_id: number
  vencimento: string
  valor: number
  pago: number
  data_pagamento: string | null
  forma_pagamento: string | null
}

interface Aluno {
  id: number
  nome: string
  numero_matricula?: string | null
}

export default function FinanceiroAlunosPage() {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [alunos, setAlunos] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pago' | 'pendente'>('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [mensalidadesData, alunosData] = await Promise.all([
        invoke<Mensalidade[]>('get_mensalidades'),
        invoke<Aluno[]>('listar_alunos'),
      ])

      setMensalidades(mensalidadesData || [])
      const alunoMap = new Map()
      alunosData?.forEach((a) => alunoMap.set(a.id, a.numero_matricula ? `${a.nome} (Mat. ${a.numero_matricula})` : a.nome))
      setAlunos(alunoMap)
    } catch (error) {
      addToast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getMensalidadeStatus = (m: Mensalidade) => {
    if (m.pago) return 'pago'
    const vencimento = new Date(m.vencimento)
    const hoje = new Date()
    return vencimento < hoje ? 'vencido' : 'pendente'
  }

  const filteredMensalidades = mensalidades.filter((m) => {
    const status = getMensalidadeStatus(m)
    const statusMatch = filtroStatus === 'todos' || status === filtroStatus
    const dataMatch = !dataInicio && !dataFim ? true : 
      ((!dataInicio || m.vencimento >= dataInicio) &&
       (!dataFim || m.vencimento <= dataFim))
    return statusMatch && dataMatch
  })

  const totalRecebido = filteredMensalidades
    .filter((m) => m.pago)
    .reduce((sum, m) => sum + m.valor, 0)

  const totalPendente = filteredMensalidades
    .filter((m) => !m.pago)
    .reduce((sum, m) => sum + m.valor, 0)

  const [exporting, setExporting] = useState(false)

  const exportPDF = async () => {
    if (filteredMensalidades.length === 0) {
      addToast('Nenhum registro para exportar', 'error')
      return
    }
    setExporting(true)
    try {
      const doc = await createDoc()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(14)
      doc.text('Relatório Financeiro - Alunos', 15, 20)
      doc.setFontSize(10)
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 15, 28)
      doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 15, 28, { align: 'right' })

      const tableData = filteredMensalidades.map((m) => [
        alunos.get(m.aluno_id) || '—',
        formatDataBR(m.vencimento),
        formatMoeda(m.valor),
        getMensalidadeStatus(m) === 'pago' ? 'Pago' : getMensalidadeStatus(m) === 'vencido' ? 'Vencido' : 'Pendente',
      ])

      await autoTable(doc, {
        startY: 37,
        head: [['Aluno', 'Vencimento', 'Valor', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [17, 24, 39] },
        foot: [['', 'Total', formatMoeda(totalRecebido + totalPendente), '']],
        footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { fontStyle: 'bold' },
          3: { fontStyle: 'bold' },
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

      const nomeArquivo = `financeiro-alunos_${new Date().toISOString().split('T')[0]}.pdf`
      const blob = doc.output('blob')
      const saved = await exportarParaPasta('relatorios_financeiros_alunos', nomeArquivo, blob)
      if (saved) addToast('PDF exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
      addToast('Erro ao exportar PDF', 'error')
    } finally {
      setExporting(false)
    }
  }

  const exportExcel = async () => {
    if (filteredMensalidades.length === 0) {
      addToast('Nenhum registro para exportar', 'error')
      return
    }
    setExporting(true)
    try {
      const header = 'Aluno;Vencimento;Valor;Status\n'
      const rows = filteredMensalidades.map((m) =>
        [
          `"${alunos.get(m.aluno_id) || '—'}"`,
          formatDataBR(m.vencimento),
          formatMoeda(m.valor),
          getMensalidadeStatus(m) === 'pago' ? 'Pago' : getMensalidadeStatus(m) === 'vencido' ? 'Vencido' : 'Pendente',
        ].join(';')
      ).join('\n')
      const csvContent = '\uFEFF' + header + rows
      const nomeArquivo = `financeiro-alunos_${new Date().toISOString().split('T')[0]}.csv`
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const saved = await exportarParaPasta('relatorios_financeiros_alunos', nomeArquivo, blob)
      if (saved) addToast('CSV exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar Excel:', error)
      addToast('Erro ao exportar Excel', 'error')
    } finally {
      setExporting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pago: 'default',
      pendente: 'secondary',
      vencido: 'destructive',
    }
    const labels: Record<string, string> = {
      pago: 'Pago',
      pendente: 'Pendente',
      vencido: 'Vencido',
    }
    return <Badge variant={variants[status] || 'secondary'}>{labels[status]}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro — Alunos</h1>
          <p className="text-sm text-muted-foreground">
            Relatório de mensalidades e receitas dos alunos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            disabled={exporting || filteredMensalidades.length === 0}
          >
            <FileText className="h-4 w-4 mr-1" />
            {exporting ? 'Exportando PDF...' : 'Exportar PDF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={exporting || filteredMensalidades.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(totalRecebido)}
            </div>
            <p className="text-xs text-muted-foreground">Mensalidades recebidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(totalPendente)}
            </div>
            <p className="text-xs text-muted-foreground">Mensalidades não recebidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente/Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-2 block">Data Início</label>
            <input autoComplete="off"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-2 block">Data Fim</label>
            <input autoComplete="off"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDataInicio('')
                setDataFim('')
                setFiltroStatus('todos')
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mensalidades</CardTitle>
          <CardDescription>
            {filteredMensalidades.length} registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : filteredMensalidades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma mensalidade encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Forma Pagamento</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMensalidades.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{alunos.get(m.aluno_id)}</TableCell>
                    <TableCell>{new Date(m.vencimento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(m.valor)}
                    </TableCell>
                    <TableCell>{getStatusBadge(getMensalidadeStatus(m))}</TableCell>
                    <TableCell>{m.forma_pagamento || '—'}</TableCell>
                    <TableCell>{m.data_pagamento ? new Date(m.data_pagamento).toLocaleDateString('pt-BR') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

