'use client'

import { useState, useEffect } from 'react'
import { branding } from '@/config/branding'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { useAuthStore } from '@/lib/store/auth-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showResetToast, setShowResetToast] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showEmergencyMessage, setShowEmergencyMessage] = useState('')
  const router = useRouter()
  const { login, isLoading, user, setUser, resetAll, resetAuth } = useAuthStore()

  useEffect(() => {
    const wasReset = sessionStorage.getItem('cuidar_erp_reset')
    if (wasReset) {
      sessionStorage.removeItem('cuidar_erp_reset')
      setShowResetToast(true)
      setTimeout(() => setShowResetToast(false), 4000)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let ativo = true
    invoke<boolean>('verificar_onboarding')
      .then((completo) => {
        if (!ativo) return
        router.replace(completo ? '/dashboard' : '/onboarding')
      })
      .catch((e) => {
        if (!ativo) return
        const msg = String(e)
        if (msg.includes('Não autenticado')) resetAuth()
        else router.replace('/dashboard')
      })
    return () => { ativo = false }
  }, [user, router, resetAuth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const success = await login(username, password)
      if (success) {
        navigateAfterLogin()
      }
    } catch (err) {
      setError(String(err))
    }
  }

  function navigateAfterLogin() {
    invoke<boolean>('verificar_onboarding')
      .then((completo) => router.push(completo ? '/dashboard' : '/onboarding'))
      .catch(() => router.push('/onboarding'))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {showResetToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          Sistema limpo com sucesso
        </div>
      )}
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="Cuidar ERP"
            className="w-40 h-40 object-contain"
          />
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            Entrar
          </h2>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Usuário
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center space-y-2">
          <button
            onClick={() => setShowResetDialog(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
Redefinir sistema
          </button>
          <div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const resultado = await invoke<string>('garantir_admin_login');
                  setShowEmergencyMessage('✓ ' + resultado + '\n\nTente logar com usuário administrador e a senha padrão do sistema.');
                  setUsername('admin')
                  setTimeout(() => setShowEmergencyMessage(''), 8000)
                } catch (e) {
                  setShowEmergencyMessage('✗ Erro: ' + String(e))
                  setTimeout(() => setShowEmergencyMessage(''), 5000)
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-2"
              title="Em caso de perda de acesso ao administrador, este botão recria a conta administrador com a senha padrão do sistema."
            >
              Botão de emergência
            </button>
          </div>
          {showEmergencyMessage && (
            <div className="rounded-md bg-indigo-50 border border-indigo-200 p-4">
              <p className="text-sm text-indigo-800 whitespace-pre-wrap leading-relaxed">
                {showEmergencyMessage}
              </p>
            </div>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} · {branding.desenvolvedor}</p>
          <p className="text-xs text-gray-400 mt-0.5">Todos os direitos reservados</p>
        </div>
      </div>

      <div className="fixed bottom-3 right-4 text-[10px] text-gray-300 select-none pointer-events-none">
        POWERED BY <span className="font-semibold tracking-wider">SHIPCLAW</span>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Resetar sistema</DialogTitle>
            <DialogDescription>
              Remove todos os dados do sistema permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { resetAll(); setShowResetDialog(false) }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}