'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { useToast } from '@/lib/context/ToastContext'
import { UserPlus, Shield, Eye, EyeOff } from 'lucide-react'
import { branding } from '@/config/branding'

export default function SetupPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [isFirstAccess, setIsFirstAccess] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState({
    nomeCompleto: '',
    username: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    invoke<boolean>('verificar_primeiro_acesso').then((firstAccess) => {
      setIsFirstAccess(firstAccess)
      if (!firstAccess) {
        router.push('/login')
      }
    })
  }, [])

  const validatePassword = (password: string) => {
    const errors = []
    if (password.length < 8) errors.push('Mínimo 8 caracteres')
    if (!/[A-Z]/.test(password)) errors.push('Pelo menos uma letra maiúscula')
    if (!/[0-9]/.test(password)) errors.push('Pelo menos um número')
    if (!/[!@#$%^&*]/.test(password)) errors.push('Pelo menos um caractere especial (!@#$%^&*)')
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nomeCompleto.trim()) {
      addToast('Nome completo é obrigatório', 'error'); return
    }
    if (!formData.username.trim()) {
      addToast('Nome de usuário é obrigatório', 'error'); return
    }
    if (formData.username.length < 3) {
      addToast('Nome de usuário deve ter pelo menos 3 caracteres', 'error'); return
    }
    if (formData.password !== formData.confirmPassword) {
      addToast('Senhas não coincidem', 'error'); return
    }

    const passwordErrors = validatePassword(formData.password)
    if (passwordErrors.length > 0) {
      addToast(`Senha fraca: ${passwordErrors.join(', ')}`, 'error')
      return
    }

    setLoading(true)
    try {
      await invoke('criar_usuario_inicial', {
        username: formData.username,
        password: formData.password,
        nomeCompleto: formData.nomeCompleto
      })
      addToast('Usuário administrador criado com sucesso!', 'success')
      setTimeout(() => { router.push('/login') }, 1500)
    } catch (error) {
      addToast(`Erro ao criar usuário: ${error}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isFirstAccess) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuração Inicial
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Crie o usuário administrador para acessar o sistema
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome Completo
            </label>
            <input autoComplete="off"
              type="text"
              value={formData.nomeCompleto}
              onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="João da Silva"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome de Usuário
            </label>
            <input autoComplete="off"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="admin"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Senha
            </label>
            <div className="relative">
              <input autoComplete="off"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <input autoComplete="off"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {formData.password && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Requisitos da senha:
              </p>
              <ul className="text-xs space-y-1">
                <li className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}>
                  Mínimo 8 caracteres
                </li>
                <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
                  Pelo menos uma letra maiúscula
                </li>
                <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
                  Pelo menos um número
                </li>
                <li className={/[!@#$%^&*]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}>
                  Pelo menos um caractere especial
                </li>
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Criando usuário...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>Criar Usuário Administrador</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} · {branding.desenvolvedor}
          </p>
        </div>
      </div>
    </div>
  )
}

