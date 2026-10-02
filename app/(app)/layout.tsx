'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { invoke } from '@/lib/tauri-invoke'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Calendar,
  Briefcase,
  DollarSign,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { Footer } from '@/components/layout/Footer'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { ShortcutsHelp } from '@/components/layout/ShortcutsHelp'
import { GuidedTour } from '@/components/layout/GuidedTour'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icon: Users },
  { href: '/turmas', label: 'Turmas', icon: BookOpen },
  { href: '/frequencia', label: 'Frequência', icon: Calendar },
  { href: '/mensalidades', label: 'Mensalidades', icon: CreditCard },
  {
    href: '/funcionarios',
    label: 'Funcionários',
    icon: Briefcase,
    submenu: [
      { href: '/funcionarios', label: 'Lista' },
      { href: '/funcionarios/cargos', label: 'Cargos' },
      { href: '/funcionarios/escalas', label: 'Escalas' },
      { href: '/funcionarios/frequencia', label: 'Frequência' },
    ]
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    submenu: [
      { href: '/financeiro-alunos', label: 'Alunos' },
      { href: '/financeiro', label: 'Empresa' },
    ]
  },
  {
    href: '/relatorios',
    label: 'Relatórios',
    icon: FileText,
    submenu: [
      { href: '/relatorios/alunos', label: 'Alunos' },
      { href: '/relatorios/frequencia', label: 'Frequência' },
      { href: '/relatorios/financeiro', label: 'Financeiro' },
      { href: '/relatorios/funcionarios', label: 'Funcionários' },
      { href: '/relatorios/ocorrencias', label: 'Ocorrências' },
    ]
  },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    submenu: [
      { href: '/configuracoes/creche', label: 'Instituição' },
      { href: '/configuracoes/servicos', label: 'Serviços' },
      { href: '/configuracoes/gastos-fixos', label: 'Gastos Fixos' },
      { href: '/admin-utils/audit-log', label: 'Log do Sistema' },
      { href: '/configuracoes/seguranca', label: 'Segurança' },
      { href: '/configuracoes/backups', label: 'Backups' },
    ]
  },
]

function isCrecheConfigurada(creche: { nome?: string | null; email?: string | null } | null): boolean {
  if (!creche) return false
  const nome = creche.nome?.trim() ?? ''
  return nome.length > 0 && nome !== 'Nome da Instituição'
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, init, creche, logoBase64 } = useAuthStore()
  const [ready, setReady] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/configuracoes')) {
      if (!expandedMenus.includes('configuracoes')) {
        setExpandedMenus(prev => [...prev, 'configuracoes'])
      }
    }
  }, [pathname])

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    )
  }

  const isMenuExpanded = (menuId: string) => expandedMenus.includes(menuId)

  useKeyboardShortcuts([
    {
      key: '?',
      description: 'Abrir ajuda de atalhos',
      handler: () => setShowShortcuts(true),
    },
    {
      key: 'n',
      ctrl: true,
      description: 'Novo registro',
      handler: () => {
        const map: Record<string, string> = {
          '/alunos': '/alunos/novo',
          '/funcionarios': '/funcionarios/novo',
          '/turmas': '/turmas/novo',
          '/ocorrencias': '/ocorrencias/novo',
          '/mensalidades': '/mensalidades/novo',
        }
        const base = Object.keys(map).find((k) => pathname?.startsWith(k))
        if (base) router.push(map[base])
      },
    },
    {
      key: 's',
      ctrl: true,
      description: 'Salvar formulário',
      handler: () => {
        const form = document.querySelector('form')
        form?.requestSubmit()
      },
    },
  ], [pathname, router])

  useEffect(() => {
    init().then(() => setReady(true))
  }, [init])

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (ready && user) {
      invoke<boolean>('verificar_onboarding').catch(() => false)
    }
  }, [ready, user])

  useEffect(() => {
    if (ready && user) {
      invoke('inicializar_estrutura_pastas').catch(() => {})
    }
  }, [ready, user])

  useEffect(() => {
    if (ready && user && !redirecting) {
      const configurada = isCrecheConfigurada(creche)
      if (!configurada && pathname !== '/configuracao') {
        setRedirecting(true)
        router.replace('/configuracao')
      }
    }
  }, [ready, user, creche, pathname, router, redirecting])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (!ready || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center">
            {logoBase64 ? (
              <img src={logoBase64} alt="Logo" className="max-h-16 w-auto object-contain" />
            ) : (
              <img src="/logo-vila-do-aprender.png" alt="Vila do Aprender" className="max-h-16 w-auto object-contain" />
            )}
          </div>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full animate-progress rounded-full bg-indigo-600" />
          </div>
          <p className="text-sm font-medium text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  const configurada = isCrecheConfigurada(creche)

  if (!configurada) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">Redirecionando...</p>
      </div>
    )
  }

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`)

  const isSubActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`)

  function renderNavItem(item: any) {
    const Icon = item.icon
    const active = isActive(item.href)
    const expanded = isMenuExpanded(item.label)

    if (item.submenu) {
      return (
        <li key={item.href}>
          <button
            onClick={() => toggleMenu(item.label)}
            className={`relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <ul className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                {item.submenu.map((subitem: any) => {
                  const subActive = isSubActive(subitem.href)
                  return (
                    <li key={subitem.href}>
                      <Link
                        href={subitem.href}
                        className={`relative flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                          subActive
                            ? 'text-indigo-700'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {subActive && (
                          <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
                        )}
                        {subitem.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </li>
      )
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
            active
              ? 'bg-gradient-to-r from-indigo-50 to-transparent text-indigo-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
          )}
          <Icon className="h-5 w-5 shrink-0" />
          {item.label}
        </Link>
      </li>
    )
  }

  function renderMobileNavItem(item: any) {
    const Icon = item.icon
    const active = isActive(item.href)

    if (item.submenu) {
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleMenu(`mobile-${item.label}`)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              {item.label}
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isMenuExpanded(`mobile-${item.label}`) ? 'rotate-180' : ''}`} />
          </button>
          {isMenuExpanded(`mobile-${item.label}`) && (
            <ul className="ml-9 mt-1 space-y-1 border-l border-gray-200 pl-3">
              {item.submenu.map((sub: any) => (
                <li key={sub.href}>
                  <Link
                    href={sub.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded px-3 py-1.5 text-xs font-medium ${
                      isSubActive(sub.href) ? 'text-indigo-700' : 'text-gray-600'
                    }`}
                  >
                    {sub.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <Icon className="h-5 w-5" />
        {item.label}
      </Link>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200/60">
        <div className="flex items-center justify-center h-20 px-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-transparent">
          {logoBase64 ? (
            <div className="flex items-center justify-center w-full max-w-[180px]">
              <img src={logoBase64} alt="Logo" className="max-h-14 w-auto object-contain" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full max-w-[180px]">
              <img src="/logo-vila-do-aprender.png" alt="Vila do Aprender" className="max-h-14 w-auto object-contain" />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-3">
            {navItems.map(renderNavItem)}
          </ul>
        </nav>

        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-[10px] font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-gray-100 py-2.5 px-4">
          <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase">Powered by ShipClaw</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          {logoBase64 ? (
            <div className="flex items-center justify-center max-w-[140px]">
              <img src={logoBase64} alt="Logo" className="max-h-8 w-auto object-contain" />
            </div>
          ) : (
            <img src="/logo-vila-do-aprender.png" alt="Vila do Aprender" className="h-8 w-auto object-contain" />
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-900">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="overflow-y-auto h-[calc(100vh-4rem)] p-4">
                <ul className="space-y-1">
                  {navItems.map(renderMobileNavItem)}
                </ul>
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.username}</span>
                  </div>
                </div>
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <GuidedTour />
    </div>
  )
}
