'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { createDoc, autoTable } from '@/lib/utils/pdf-generator'
import { ArrowLeft, BarChart3, FileDown, ChevronDown, Download, Users, TrendingUp, TrendingDown, DollarSign, Percent, Search } from 'lucide-react'
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

interface RelatorioFuncionario {
  id: number
  nome: string
  cargo: string
  salario: number
  turmas_alocadas: string
  total_alunos_atendidos: number
  receita_gerada: number
  custo: number
  saldo: number
  status: string
}

interface ResumoRelatorioFuncionarios {
  total_folha: number
  total_receita_alunos: number
  total_receita_servicos: number
  total_despesas: number
  saldo_operacional: number
  percentual_folha: number
  total_funcionarios: number
  funcionarios_por_cargo: [string, number, number][]
}

function fmt(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type SortKey = 'nome' | 'saldo' | 'custo' | 'salario' | 'receita_gerada'
type SortDir = 'asc' | 'desc'

export default function RelatorioFuncionariosPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [mes, setMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [relatorios, setRelatorios] = useState<RelatorioFuncionario[]>([])
  const [resumo, setResumo] = useState<ResumoRelatorioFuncionarios | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportDropdown, setExportDropdown] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [cargoFilter, setCargoFilter] = useState('todos')
  const [statusFinanceiro, setStatusFinanceiro] = useState('todos')
  const [statusFuncionario, setStatusFuncionario] = useState('todos')
  const [sortKey, setSortKey] = useState<SortKey>('saldo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [rel, res] = await Promise.all([
        invoke<RelatorioFuncionario[]>('get_relatorio_funcionarios', { mes }),
        invoke<ResumoRelatorioFuncionarios>('get_resumo_relatorio_funcionarios', { mes }),
      ])
      setRelatorios(rel)
      setResumo(res)
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [mes])

  const cargosDisponiveis = useMemo(() => {
    const set = new Set(relatorios.map((r) => r.cargo).filter(Boolean))
    return Array.from(set).sort()
  }, [relatorios])

  const relatoriosFiltrados = useMemo(() => {
    let items = [...relatorios]
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      items = items.filter((r) => r.nome.toLowerCase().includes(q) || r.cargo.toLowerCase().includes(q))
    }
    if (cargoFilter !== 'todos') {
      items = items.filter((r) => r.cargo === cargoFilter)
    }
    if (statusFinanceiro === 'positivo') {
      items = items.filter((r) => r.saldo >= 0)
    } else if (statusFinanceiro === 'negativo') {
      items = items.filter((r) => r.saldo < 0)
    }
    if (statusFuncionario !== 'todos') {
      items = items.filter((r) => r.status === statusFuncionario)
    }
    items.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return items
  }, [relatorios, searchTerm, cargoFilter, statusFinanceiro, statusFuncionario, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const getPercentualCargo = (totalSalarial: number): string => {
    if (!resumo || resumo.total_folha === 0) return '0%'
    return `${((totalSalarial / resumo.total_folha) * 100).toFixed(1)}%`
  }

  const getCargoPercentBg = (pct: string): string => {
    const num = parseFloat(pct)
    if (num > 50) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    if (num > 25) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  async function exportarPDF() {
    try {
      const doc = await createDoc()
      doc.setFontSize(14)
      doc.text(`Relatório de Funcionários - ${mes}`, 15, 20)
      doc.setFontSize(10)
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 200, 28, { align: 'right' })

      if (resumo) {
        doc.setFontSize(11)
        doc.text(`Total da Folha: ${fmt(resumo.total_folha)}`, 15, 36)
        doc.text(`Receita Total: ${fmt(resumo.total_receita_alunos + resumo.total_receita_servicos)}`, 15, 43)
        doc.text(`Despesas: ${fmt(resumo.total_despesas)}`, 15, 50)
        doc.text(`Saldo Operacional: ${fmt(resumo.saldo_operacional)}`, 15, 57)
        doc.text(`% Folha/Receita: ${resumo.percentual_folha.toFixed(1)}%`, 15, 64)
        doc.text(`Funcionários Ativos: ${resumo.total_funcionarios}`, 15, 71)
      }

      const startY = resumo ? 80 : 36

      const body = relatoriosFiltrados.map((r) => [
        r.nome,
        r.cargo,
        fmt(r.salario),
        r.turmas_alocadas,
        String(r.total_alunos_atendidos),
        fmt(r.receita_gerada),
        fmt(r.custo),
        fmt(r.saldo),
        r.status === 'ativo' ? 'Ativo' : 'Inativo',
      ])

      await autoTable(doc, {
        startY,
        head: [['Nome', 'Cargo', 'Salário', 'Turmas', 'Alunos', 'Receita', 'Custo', 'Saldo', 'Status']],
        body,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [17, 24, 39] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { fontStyle: 'bold' },
          5: { fontStyle: 'bold' },
          6: { fontStyle: 'bold' },
          7: { fontStyle: 'bold' },
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
      const nomeArquivo = `relatorio_funcionarios_${mes}.pdf`
      const path = await exportarParaPasta('relatorios_funcionarios', nomeArquivo, blob)
      if (path) addToast(`PDF salvo em: ${path}`, 'success')
    } catch (error) {
      console.error('Error generating PDF:', error)
    }
  }

  async function exportarCSV() {
    const BOM = '\uFEFF'
    const header = 'Nome;Cargo;Salário;Turmas;Alunos;Receita Gerada;Custo;Saldo;Status\n'
    const rows = relatoriosFiltrados.map((r) =>
      `${r.nome};${r.cargo};${fmt(r.salario)};"${r.turmas_alocadas}";${r.total_alunos_atendidos};${fmt(r.receita_gerada)};${fmt(r.custo)};${fmt(r.saldo)};${r.status === 'ativo' ? 'Ativo' : 'Inativo'}`
    ).join('\n')
    const csv = BOM + header + rows
    const nome = `relatorio_funcionarios_${mes}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const path = await exportarParaPasta('relatorios_funcionarios', nome, blob)
    if (path) addToast(`CSV salvo em: ${path}`, 'success')
  }

  const mesLabel = (() => {
    const [anoStr, mesStr] = mes.split('-')
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    return `${meses[parseInt(mesStr) - 1]}/${anoStr}`
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/relatorios')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        {relatorios.length > 0 && (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setExportDropdown(!exportDropdown)} className="flex items-center gap-1">
              <FileDown className="h-4 w-4" />
              Exportar <ChevronDown className="h-3 w-3" />
            </Button>
            {exportDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <button onClick={() => { setExportDropdown(false); exportarPDF().catch(console.error) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4" /> Exportar PDF
                </button>
                <button onClick={() => { setExportDropdown(false); exportarCSV() }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-sm border-t border-gray-200 dark:border-gray-700">
                  <Download className="h-4 w-4" /> Exportar CSV
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatório de Funcionários</h1>
        <p className="text-sm text-muted-foreground">Custo vs Geração de Valor</p>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mês</label>
              <input autoComplete="off" type="month" value={mes} onChange={(e) => setMes(e.target.value)}
                className="h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <Button onClick={carregarDados} disabled={loading}>
              {loading ? 'Carregando...' : 'Gerar Relatório'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
      )}

      {!loading && resumo && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><Users className="h-3 w-3" /> Total Folha</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-blue-600">{fmt(resumo.total_folha)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Receita Total</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-green-600">{fmt(resumo.total_receita_alunos + resumo.total_receita_servicos)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Despesas</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-red-600">{fmt(resumo.total_despesas)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Saldo Operacional</CardTitle></CardHeader>
              <CardContent><p className={`text-xl font-bold ${resumo.saldo_operacional >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resumo.saldo_operacional)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><Percent className="h-3 w-3" /> Folha/Receita</CardTitle></CardHeader>
              <CardContent><p className={`text-xl font-bold ${resumo.percentual_folha > 50 ? 'text-yellow-600' : 'text-green-600'}`}>{resumo.percentual_folha.toFixed(1)}%</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1"><Users className="h-3 w-3" /> Ativos</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-gray-900 dark:text-gray-100">{resumo.total_funcionarios}</p></CardContent>
            </Card>
          </div>

          {/* Distribution by Cargo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Cargo</CardTitle>
              <CardDescription>{mesLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Total Salarial</TableHead>
                    <TableHead className="text-right">% da Folha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.funcionarios_por_cargo.map(([cargo, qtd, totalSalarial], idx) => {
                    const pct = getPercentualCargo(totalSalarial)
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-gray-900 dark:text-gray-100">{cargo || 'Sem cargo'}</TableCell>
                        <TableCell className="text-center text-gray-700 dark:text-gray-300">{qtd}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(totalSalarial)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={getCargoPercentBg(pct)}>{pct}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Detalhamento por Funcionário</CardTitle>
                  <CardDescription>{relatoriosFiltrados.length} funcionário(s) · {mesLabel}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
<div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <input autoComplete="off" type="text" placeholder="Buscar nome/cargo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 w-48 pl-8 pr-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <Select value={cargoFilter} onValueChange={setCargoFilter}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Todos cargos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos cargos</SelectItem>
                      {cargosDisponiveis.map((c) => <SelectItem key={c} value={c}>{c || 'Sem cargo'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFinanceiro} onValueChange={setStatusFinanceiro}>
                    <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status financeiro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="positivo">Saldo Positivo</SelectItem>
                      <SelectItem value="negativo">Saldo Negativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFuncionario} onValueChange={setStatusFuncionario}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="ativo">Ativos</SelectItem>
                      <SelectItem value="inativo">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {relatoriosFiltrados.length === 0 ? (
                <div className="py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>
                        Nome {sortKey === 'nome' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('salario')}>
                        Salário {sortKey === 'salario' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Turmas</TableHead>
                      <TableHead className="text-center">Alunos</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('receita_gerada')}>
                        Receita {sortKey === 'receita_gerada' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('custo')}>
                        Custo {sortKey === 'custo' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('saldo')}>
                        Saldo {sortKey === 'saldo' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatoriosFiltrados.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-gray-900 dark:text-gray-100">{r.nome}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{r.cargo || '-'}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(r.salario)}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{r.turmas_alocadas || '-'}</TableCell>
                        <TableCell className="text-center text-gray-700 dark:text-gray-300">{r.total_alunos_atendidos}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{fmt(r.receita_gerada)}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">{fmt(r.custo)}</TableCell>
                        <TableCell className={`text-right font-bold ${r.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.saldo)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${r.status === 'ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {r.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!loading && !resumo && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum funcionário cadastrado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

