'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { X, ChevronLeft, ChevronRight, Check, Hand, BarChart3, UserRound, Calendar, DollarSign, Users, FileText, Settings } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'

const ICON_MAP: Record<string, React.ReactNode> = {
  welcome: <Hand className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  dashboard: <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  alunos: <UserRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  frequencia: <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  financeiro: <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  funcionarios: <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  relatorios: <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  configuracoes: <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  completo: <Check className="w-5 h-5 text-green-600 dark:text-green-400" />,
}

interface Step {
  title: string
  description: string
  route?: string
  iconKey: string
}

const STORAGE_KEY = 'cuidar-tour-complete'

const STEPS: Step[] = [
  {
    title: 'Bem-vindo ao Cuidar ERP',
    description: 'Vamos fazer um tour rápido pelas principais funcionalidades do sistema para você começar a usar.',
    iconKey: 'welcome',
  },
  {
    title: 'Dashboard',
    description: 'Aqui você vê um resumo de tudo: total de alunos, mensalidades, frequência e gráficos rápidos.',
    route: '/dashboard',
    iconKey: 'dashboard',
  },
  {
    title: 'Alunos',
    description: 'Cadastre e gerencie alunos, com fotos, documentos, histórico de mensalidades e ocorrências.',
    route: '/alunos',
    iconKey: 'alunos',
  },
  {
    title: 'Frequência',
    description: 'Registre a presença dos alunos diariamente e acompanhe relatórios por período e turma.',
    route: '/frequencia',
    iconKey: 'frequencia',
  },
  {
    title: 'Financeiro',
    description: 'Controle mensalidades, receitas, despesas e tenha uma visão clara do fluxo de caixa.',
    route: '/financeiro',
    iconKey: 'financeiro',
  },
  {
    title: 'Gerar Mensalidades',
    description: 'Após cadastrar alunos, acesse Mensalidades > "Gerar Mensalidades do Mês" para criar as cobranças. Alunos novos não geram mensalidades automaticamente.',
    route: '/mensalidades',
    iconKey: 'financeiro',
  },
  {
    title: 'Funcionários',
    description: 'Gerencie sua equipe, cargos, salários e análise de custo vs receita por funcionário.',
    route: '/funcionarios',
    iconKey: 'funcionarios',
  },
  {
    title: 'Relatórios',
    description: 'Exporte relatórios detalhados em PDF/Excel de alunos, frequência, financeiro e mais.',
    route: '/relatorios',
    iconKey: 'relatorios',
  },
  {
    title: 'Configurações',
    description: 'Ajuste dados da creche, serviços, gastos fixos, segurança, backups e muito mais.',
    route: '/configuracoes/creche',
    iconKey: 'configuracoes',
  },
  {
    title: 'Tour Completo!',
    description: 'Agora você já conhece o básico. Explore o sistema à vontade.',
    iconKey: 'completo',
  },
]

export function GuidedTour() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!user) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (done === 'true') return

    invoke<boolean>('verificar_onboarding').then((completo) => {
      if (completo) {
        const timer = setTimeout(() => setOpen(true), 600)
        return () => clearTimeout(timer)
      }
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!open) return
    const current = STEPS[step]
    if (current.route) {
      router.push(current.route)
    }
  }, [step, open, router])

  function finish() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setOpen(false)
  }

  function skip() {
    finish()
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      finish()
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={skip} />
      <div className="relative z-10 w-full max-w-lg mx-4 mb-8 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? 'w-6 bg-gray-900 dark:bg-gray-400'
                      : i < step
                        ? 'w-1.5 bg-gray-300 dark:bg-gray-600'
                        : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={skip}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              {ICON_MAP[current.iconKey]}
              {current.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{current.description}</p>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={skip}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Pular tour
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors"
              >
                {isLast ? (
                  <>
                    Concluir
                    <Check className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
