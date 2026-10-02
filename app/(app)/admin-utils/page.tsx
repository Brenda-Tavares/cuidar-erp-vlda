'use client'

import { useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'

export default function AdminUtilsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleResetAdmin() {
    if (!confirm('Tem certeza? Isso vai redefinir a senha do administrador para a senha padrão do sistema.')) {
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await invoke('reset_admin_password')
      setMessage(result as string)
    } catch (err) {
      setError(`Erro: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetAll() {
    if (!confirm('AVISO: Isso vai DELETAR TODOS os dados da aplicação!\n\nDeseja continuar?')) {
      return
    }

    if (!confirm('Tem ABSOLUTA certeza? Esta ação não pode ser desfeita!')) {
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await invoke('reset_all_data_and_init')
      setMessage(result as string)
      
      localStorage.clear()
      sessionStorage.clear()
      
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (err) {
      setError(`Erro: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Utilidades de Administrador</h1>
        <p className="text-muted-foreground">Ferramentas de manutenção e reset do sistema</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">Erro</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Sucesso</h3>
              <p className="text-sm text-green-700 mt-1 font-mono">{message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-50 rounded-lg p-3 flex-shrink-0">
              <RotateCcw className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Redefinir Senha do Administrador</h3>
              <p className="text-sm text-gray-600 mb-4">
                Redefine a senha do usuário administrador para a senha padrão do sistema
              </p>
              <Button 
                onClick={handleResetAdmin}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Processando...' : 'Redefinir Senha do Administrador'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-50 rounded-lg p-3 flex-shrink-0">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Redefinição Completa do Sistema</h3>
              <p className="text-sm text-gray-600 mb-4">
                <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" />AVISO: Exclui TODOS os dados (alunos, turmas, mensalidades, etc.) e reinicializa o administrador
              </p>
              <Button 
                onClick={handleResetAll}
                disabled={loading}
                variant="destructive"
              >
                {loading ? 'Processando...' : 'Redefinição Completa do Sistema'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-900">Nota</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Estas operações são irreversíveis. Certifique-se de fazer backup dos dados importantes antes de executar qualquer reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
