'use client'

import { useState } from 'react'
import { branding } from '@/config/branding'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { useAuthStore } from '@/lib/store/auth-store'
import { Building2 } from 'lucide-react'

function validarEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function mascararCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function mascararTelefone(v: string): string {
  const digitos = v.replace(/\D/g, '').slice(0, 11)
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export default function ConfiguracaoPage() {
  const router = useRouter()
  const { setCreche } = useAuthStore()

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)

  const errors: Record<string, string> = {}
  if (touched.telefone && !telefone.trim()) errors.telefone = 'Campo obrigatório'
  if (touched.email && !email.trim()) errors.email = 'Campo obrigatório'
  if (touched.email && email.trim() && !validarEmail(email.trim())) errors.email = 'E-mail inválido'

  const valido = nome.trim() && endereco.trim() && telefone.trim() && email.trim() && validarEmail(email.trim())

  const handleBlur = (campo: string) => {
    setTouched((prev) => ({ ...prev, [campo]: true }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ nome: true, endereco: true, telefone: true, email: true })
    if (!valido) return
    setSaving(true)
    setError('')
    try {
      const senha_admin = novaSenha.length >= 8 ? novaSenha : null
      await invoke('salvar_creche', {
        creche: {
          id: null,
          nome: nome.trim(),
          cnpj: cnpj || null,
          endereco: endereco.trim(),
          numero: null,
          bairro: null,
          cidade: '',
          estado: '',
          telefone: telefone.replace(/\D/g, ''),
          email: email.trim(),
          senha_admin,
          onboarding_completo: true,
        },
      })
      if (senha_admin) {
        await invoke('atualizar_senha_admin', { novaSenha: senha_admin }).catch(() => {})
      }
      setCreche({
        id: 1,
        nome: nome.trim(),
        cnpj: cnpj || null,
        endereco: endereco.trim(),
        numero: null,
        bairro: null,
        cidade: '',
        estado: '',
        telefone: telefone.replace(/\D/g, ''),
        email: email.trim(),
        senha_admin,
        onboarding_completo: true,
      })
      router.replace('/dashboard')
    } catch {
      setError('Erro ao salvar. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
            <Building2 className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Configurar Instituição</h1>
          <p className="mt-1 text-sm text-gray-500">
            Preencha os dados da instituição para começar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Nome da Instituição *</label>
            <input autoComplete="off"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Instituição Educacional Vila do Aprender"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">CNPJ</label>
            <input autoComplete="off"
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(mascararCNPJ(e.target.value))}
              maxLength={18}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Endereço *</label>
            <input autoComplete="off"
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Rua, número, bairro"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Telefone *</label>
              <input autoComplete="off"
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                onBlur={() => handleBlur('telefone')}
                maxLength={15}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.telefone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="(99) 99999-9999"
              />
              {errors.telefone && (
                <p className="text-sm text-red-600">{errors.telefone}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">E-mail *</label>
              <input autoComplete="off"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="contato@instituicao.com.br"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {showSenha ? 'Ocultar' : 'Alterar senha (opcional)'}
            </button>

            {showSenha && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Nova senha</label>
                  <input autoComplete="off"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Confirmar senha</label>
                  <input autoComplete="off"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      confirmarSenha && novaSenha !== confirmarSenha ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Repita a senha"
                  />
                  {confirmarSenha && novaSenha !== confirmarSenha && (
                    <p className="text-sm text-red-600">Senhas não conferem</p>
                  )}
                </div>
                {novaSenha && novaSenha.length < 8 && (
                  <p className="text-sm text-red-600">Mínimo de 8 caracteres</p>
                )}
                <p className="text-xs text-gray-400">Deixe em branco para manter a senha padrão</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!valido || saving}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar e Começar'}
          </button>
        </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} · {branding.desenvolvedor}
          </p>
      </div>
    </div>
  )
}

