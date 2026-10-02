'use client'

import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Wallet, TrendingUp, TrendingDown, PiggyBank, CheckCheck, Plus, ChevronLeft, ChevronRight, Briefcase, Home } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import Link from 'next/link'

interface SalarioRegistro {
  id: number
  funcionario_id: number
  funcionario_nome: string
  mes: string
  valor: number
  pago: number
  data_pagamento?: string
}

interface CompanyExpense {
  id?: number
  categoria: string
  descricao?: string
  valor: number
  data_despesa: string
  data_pagamento?: string
  forma_pagamento?: string
  status?: string
}

interface CompanyRevenue {
  id?: number
  categoria: string
  descricao?: string
  valor: number
  data_receita: string
  data_recebimento?: string
  forma_recebimento?: string
  status?: string
}

interface GastoFixo {
  id?: number
  nome: string
  valor_padrao?: number
  valor_atual: number
  mes: string
  descricao?: string
  status?: string
  editavel?: boolean
}

interface FinancialOverview {
  total_alunos_ativos: number
  total_funcionarios_ativos: number
  mensalidades_pagas: number
  mensalidades_pendentes: number
  mensalidades_pagas_count: number
  mensalidades_pendentes_count: number
  receitas_manuais_recebidas: number
  receitas_manuais_pendentes: number
  salarios_pagos: number
  salarios_pendentes: number
  gastos_fixos_mes: number
  despesas_manuais_pagas: number
  despesas_manuais_pendentes: number
  receitas_total_previsto: number
  despesas_total_previsto: number
  receita_real: number
  despesas_pagas: number
  saldo_estimado: number
  resultado_real: number
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function formatMes(mes: string) {
  const [ano, m] = mes.split('-')
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${meses[parseInt(m, 10) - 1] || m} de ${ano}`
}

export default function FinanceiroPage() {
  const [overview, setOverview] = useState<FinancialOverview | null>(null)
  const [salarios, setSalarios] = useState<SalarioRegistro[]>([])
  const [gastosFixos, setGastosFixos] = useState<GastoFixo[]>([])
  const [expenses, setExpenses] = useState<CompanyExpense[]>([])
  const [revenues, setRevenues] = useState<CompanyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<number | null>(null)
  const [mes, setMes] = useState(new Date().toISOString().split('T')[0].substring(0, 7))
  const { addToast } = useToast()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [overviewData, salariosData, gastosData, expensesData, revenuesData] = await Promise.all([
        invoke<FinancialOverview>('get_financial_overview', { mes }),
        invoke<SalarioRegistro[]>('listar_pagamentos_salarios', { mes }),
        invoke<GastoFixo[]>('get_gastos_fixos_mes', { mes }),
        invoke<CompanyExpense[]>('listar_company_expenses'),
        invoke<CompanyRevenue[]>('listar_company_revenues'),
      ])

      setOverview(overviewData)
      setSalarios(salariosData || [])
      setGastosFixos((gastosData || []).filter(g => g.status !== 'inativo'))
      setExpenses((expensesData || []).filter(e => e.data_despesa?.startsWith(mes)))
      setRevenues((revenuesData || []).filter(r => r.data_receita?.startsWith(mes)))
    } catch (error) {
      console.error(error)
      addToast('Erro ao carregar dados financeiros', 'error')
    } finally {
      setLoading(false)
    }
  }, [mes, addToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const changeMonth = (delta: number) => {
    const [ano, m] = mes.split('-').map(Number)
    const d = new Date(ano, m - 1 + delta, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const marcarSalarioPago = async (pagamento: SalarioRegistro) => {
    try {
      setPaying(pagamento.id)
      const hoje = new Date().toISOString().split('T')[0]
      await invoke('pagar_salario', { id: pagamento.id, dataPagamento: hoje })
      addToast(`Salário de ${pagamento.funcionario_nome} marcado como pago`, 'success')
      await loadData()
    } catch (error) {
      console.error(error)
      addToast('Erro ao marcar salário como pago', 'error')
    } finally {
      setPaying(null)
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculando o financeiro de {formatMes(mes)}...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro — Empresa</h1>
          <p className="text-sm text-muted-foreground">
            {overview?.total_alunos_ativos} alunos ativos · {overview?.total_funcionarios_ativos} funcionários ativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input autoComplete="off"
            type="month"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Saldo Estimado</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overview!.saldo_estimado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {brl(overview!.saldo_estimado)}
            </div>
            <p className="text-xs text-muted-foreground">Receitas previstas − despesas previstas (inclui pendências)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Real</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{brl(overview!.receita_real)}</div>
            <p className="text-xs text-muted-foreground">O que entrou de fato no mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado de Fato</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overview!.resultado_real >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {brl(overview!.resultado_real)}
            </div>
            <p className="text-xs text-muted-foreground">Receita real − despesas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{brl(overview!.despesas_total_previsto)}</div>
            <p className="text-xs text-muted-foreground">Salários + gastos fixos + despesas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Mensalidades dos Alunos
              </CardTitle>
              <CardDescription>Pagamentos do mês</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Pagas</p>
                <p className="text-xs text-muted-foreground">{overview!.mensalidades_pagas_count} alunos</p>
              </div>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{brl(overview!.mensalidades_pagas)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3">
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Pendentes</p>
                <p className="text-xs text-muted-foreground">{overview!.mensalidades_pendentes_count} alunos</p>
              </div>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{brl(overview!.mensalidades_pendentes)}</span>
            </div>
            <Link href="/mensalidades" className="block w-full">
              <Button variant="outline" className="w-full gap-2">
                <CheckCheck className="h-4 w-4" />
                Registrar Pagamentos
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                Salários da Equipe
              </CardTitle>
              <CardDescription>{salarios.length} registros de salário</CardDescription>
            </div>
            {overview!.salarios_pagos > 0 && overview!.salarios_pendentes === 0 && (
              <Badge className="bg-emerald-100 text-emerald-700">Tudo pago ✓</Badge>
            )}
          </CardHeader>
          <CardContent>
            {salarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum salário para este mês
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarios.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.funcionario_nome}</TableCell>
                      <TableCell>{brl(s.valor)}</TableCell>
                      <TableCell>
                        <Badge variant={s.pago ? 'default' : 'secondary'}>
                          {s.pago ? 'Pago' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!s.pago && (
                          <Button size="sm" variant="outline" onClick={() => marcarSalarioPago(s)} disabled={paying === s.id}>
                            {paying === s.id ? '...' : 'Marcar pago'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {salarios.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Salários para este mês são gerados automaticamente. Veja a página Salários para gerenciar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-orange-600" />
              Gastos Fixos (Aluguéis, Contas, etc.)
            </CardTitle>
            <CardDescription>Despesas recorrentes de {formatMes(mes)}</CardDescription>
          </div>
          <span className="text-xl font-bold">{brl(overview!.gastos_fixos_mes)}</span>
        </CardHeader>
        <CardContent>
          {gastosFixos.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">Nenhum gasto fixo para este mês</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gastosFixos.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div>
                    <p className="text-sm font-medium">{g.nome}</p>
                    {g.descricao && <p className="text-xs text-muted-foreground">{g.descricao}</p>}
                  </div>
                  <span className="text-sm font-semibold">{brl(g.valor_atual)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/financeiro/despesas">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Despesa
          </Button>
        </Link>
        <Link href="/financeiro/receitas">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Receita
          </Button>
        </Link>
        <Link href="/configuracoes/gastos-fixos">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Gastos Fixos
          </Button>
        </Link>
        <Link href="/funcionarios">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Salários
          </Button>
        </Link>
      </div>

      {(expenses.length > 0 || revenues.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {expenses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outras Despesas ({expenses.length})</CardTitle>
                <CardDescription>
                  Pago: {brl(expenses.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0))} · Pendente:{' '}
                  {brl(expenses.filter(e => e.status !== 'pago').reduce((s, e) => s + e.valor, 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.categoria}</TableCell>
                        <TableCell>{e.descricao || '—'}</TableCell>
                        <TableCell>{brl(e.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === 'pago' ? 'default' : 'secondary'}>
                            {e.status === 'pago' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {revenues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outras Receitas ({revenues.length})</CardTitle>
                <CardDescription>
                  Recebido: {brl(revenues.filter(r => r.status === 'recebido').reduce((s, r) => s + r.valor, 0))} · Pendente:{' '}
                  {brl(revenues.filter(r => r.status !== 'recebido').reduce((s, r) => s + r.valor, 0))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.categoria}</TableCell>
                        <TableCell>{r.descricao || '—'}</TableCell>
                        <TableCell>{brl(r.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'recebido' ? 'default' : 'secondary'}>
                            {r.status === 'recebido' ? 'Recebido' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}