'use client'

import { useEffect } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    try {
      invoke('log_frontend_error', {
        message: `[error.tsx] ${error.message}`,
        stack: error.stack ? String(error.stack) : undefined,
      }).catch(() => {})
    } catch {
    }
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Erro na Página</h1>
        <p className="text-gray-600 text-center mb-4">
          Desculpe, ocorreu um erro ao carregar esta página. Por favor, tente novamente.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-gray-100 rounded text-sm">
            <p className="font-semibold text-gray-900 mb-2">Detalhes do Erro (Dev):</p>
            <pre className="text-xs text-gray-700 overflow-auto max-h-40">
              {error.message}
            </pre>
          </div>
        )}

        <button
          onClick={() => reset()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar Novamente
        </button>
      </div>
    </div>
  )
}
