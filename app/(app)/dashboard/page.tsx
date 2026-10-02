'use client'

import { useEffect, useState, useMemo } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, BookOpen, Briefcase, CreditCard, DollarSign, Landmark, Plus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { cn } from '@/lib/utils'

interface DashboardStatsCompleto {
  total_alunos: number
  total_turmas: number
  mensalidades_aberto: number
  aniversariantes: string[]
  total_receitas_alunos: number
  total_pendente_alunos: number
  total_despesas: number
  total_gastos_fixos: number
  lucro_liquido: number
  total_funcionarios: number
  funcionarios_ativos: number
  funcionarios_inativos: number
  total_salarios: number
  alertas: string[]
}

interface CompanyExpense {
  id: number
  categoria: string
  descricao: string | null
  valor: number
  data_despesa: string
  data_pagamento: string | null
  forma_pagamento: string | null
  funcionario_id: number | null
  status: string | null
  comprovante_path: string | null
  notas: string | null
}

interface CardConfig {
  href: string
  label: string
  value: string | number
  icon: typeof Users
  gradient: string
  iconBg: string
  iconColor: string
  valueColor?: string
  subtitle?: string
  linkLabel: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatsCompleto | null>(null)
  const [despesasRecentes, setDespesasRecentes] = useState<CompanyExpense[]>([])
  const { creche, logoBase64 } = useAuthStore()

  useEffect(() => {
    invoke<DashboardStatsCompleto>('get_dashboard_stats_completo')
      .then(setStats)
      .catch(console.error)
  }, [])

  useEffect(() => {
    invoke<CompanyExpense[]>('listar_company_expenses')
      .then((items) => {
        const ordenadas = [...(items || [])].sort((a, b) =>
          (b.data_despesa || '').localeCompare(a.data_despesa || '')
        )
        setDespesasRecentes(ordenadas.slice(0, 5))
      })
      .catch(console.error)
  }, [])

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const isEmpty = stats && stats.total_alunos === 0 && stats.total_turmas === 0 && stats.mensalidades_aberto === 0

  const cards = useMemo((): CardConfig[] => {
    if (!stats) return []
    return [
      {
        href: '/alunos',
        label: 'Total Alunos',
        value: stats.total_alunos,
        icon: Users,
        gradient: 'from-indigo-50 to-white',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        linkLabel: 'Ver todos',
      },
      {
        href: '/turmas',
        label: 'Turmas Ativas',
        value: stats.total_turmas,
        icon: BookOpen,
        gradient: 'from-violet-50 to-white',
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        linkLabel: 'Ver todas',
      },
      {
        href: '/mensalidades',
        label: 'Mensalidades Pendentes',
        value: stats.mensalidades_aberto,
        icon: CreditCard,
        gradient: 'from-blue-50 to-white',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        linkLabel: 'Ver mensalidades',
      },
      {
        href: '/financeiro',
        label: 'Receita do Mês',
        value: formatCurrency(stats.total_receitas_alunos),
        icon: TrendingUp,
        gradient: 'from-emerald-50 to-white',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        valueColor: 'text-emerald-600',
        linkLabel: stats.total_receitas_alunos === 0 ? 'Sem registros' : 'Ver receitas',
      },
      {
        href: '/financeiro/despesas',
        label: 'Despesas do Mês',
        value: formatCurrency(stats.total_despesas),
        icon: DollarSign,
        gradient: 'from-amber-50 to-white',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        valueColor: 'text-amber-600',
        linkLabel: 'Ver despesas',
      },
      {
        href: '/configuracoes/gastos-fixos',
        label: 'Gastos Fixos (Mês)',
        value: formatCurrency(stats.total_gastos_fixos),
        icon: Landmark,
        gradient: 'from-orange-50 to-white',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        valueColor: 'text-orange-600',
        linkLabel: 'Ver gastos',
      },
      {
        href: '/financeiro',
        label: 'Saldo Estimado',
        value: formatCurrency(stats.lucro_liquido),
        icon: stats.lucro_liquido >= 0 ? TrendingUp : TrendingDown,
        gradient: stats.lucro_liquido >= 0 ? 'from-emerald-50 to-white' : 'from-red-50 to-white',
        iconBg: stats.lucro_liquido >= 0 ? 'bg-emerald-100' : 'bg-red-100',
        iconColor: stats.lucro_liquido >= 0 ? 'text-emerald-600' : 'text-red-600',
        valueColor: stats.lucro_liquido >= 0 ? 'text-emerald-600' : 'text-red-600',
        subtitle: 'Receitas - Despesas - Gastos Fixos',
        linkLabel: 'Ver financeiro',
      },
      {
        href: '/funcionarios',
        label: 'Funcionários Ativos',
        value: stats.funcionarios_ativos,
        icon: Briefcase,
        gradient: 'from-sky-50 to-white',
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600',
        subtitle: `${stats.funcionarios_inativos} inativos • ${stats.total_funcionarios} total`,
        linkLabel: 'Ver funcionários',
      },
      {
        href: '/financeiro',
        label: 'Total Salários',
        value: formatCurrency(stats.total_salarios),
        icon: DollarSign,
        gradient: 'from-purple-50 to-white',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        valueColor: 'text-purple-600',
        subtitle: 'Folha de pagamento mensal',
        linkLabel: 'Ver salários',
      },
      {
        href: '/financeiro-alunos',
        label: 'Pendentes (Alunos)',
        value: formatCurrency(stats.total_pendente_alunos),
        icon: CreditCard,
        gradient: 'from-rose-50 to-white',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        valueColor: 'text-rose-600',
        linkLabel: 'Ver financeiro',
      },
    ]
  }, [stats])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da {creche?.nome ?? 'instituição educacional'}</p>
      </div>

      {!stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          {logoBase64 ? (
            <div className="mb-6 flex items-center justify-center">
              <img src={logoBase64} alt="Logo" className="max-h-32 w-auto object-contain" />
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-center">
              <img src="/logo-vila-do-aprender.png" alt="Vila do Aprender" className="h-36 w-36 object-contain" />
            </div>
          )}
          <h3 className="text-xl font-semibold text-foreground">Bem-vindo ao Cuidar ERP</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Comece cadastrando sua primeira turma e alunos para ver as métricas aqui.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/turmas/novo"><Button variant="outline">Nova Turma</Button></Link>
            <Link href="/alunos/novo"><Button>Novo Aluno</Button></Link>
          </div>
        </div>
      )}

      {stats && (
        <>
          {stats.alertas.length > 0 && (
            <div className="animate-fade-in rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Alertas</p>
                <ul className="mt-1 space-y-0.5">
                  {stats.alertas.map((a, i) => (
                    <li key={i} className="text-sm text-amber-700">• {a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className={cn(
                    'group animate-fade-in-up',
                    `animation-delay-${(i % 4) * 100}`,
                  )}
                  style={{ animationDelay: `${(i % 4) * 100}ms` }}
                >
                  <Card className={cn(
                    'h-full cursor-pointer border-0 bg-gradient-to-br transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden',
                    card.gradient,
                    'relative',
                  )}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/40 to-transparent" />
                    <CardContent className="p-5 relative">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                          <p className={cn('text-2xl font-bold', card.valueColor)}>{card.value}</p>
                          {card.subtitle && (
                            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                          )}
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.iconBg)}>
                          <Icon className={cn('h-5 w-5', card.iconColor)} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {card.linkLabel} <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          <div className="animate-fade-in rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold tracking-tight">Despesas da Empresa</h2>
              </div>
              <Link href="/financeiro/despesas">
                <Button variant="outline" size="sm">Ver despesas</Button>
              </Link>
            </div>
            {despesasRecentes.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhuma despesa registrada ainda.
              </p>
            ) : (
              <div className="mt-4 divide-y">
                {despesasRecentes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {d.categoria}
                        {d.descricao ? ` — ${d.descricao}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.data_despesa ? new Date(d.data_despesa + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                        {d.status === 'pago' ? ' • Paga' : ' • Pendente'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">
                      {d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
