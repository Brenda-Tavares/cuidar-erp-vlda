'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { CheckCircle, XCircle, Beaker, AlertTriangle } from 'lucide-react'

export default function TestDataPage() {
  const [status, setStatus] = useState<string>('Carregando...')
  const [loading, setLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    const createTestData = async () => {
      try {
        setStatus('Criando dados de teste...')
        const result = await invoke<string>('criar_dados_teste')
        setStatus(result)
        setIsSuccess(true)
      } catch (error) {
        setStatus('Erro: ' + String(error))
        setIsError(true)
      } finally {
        setLoading(false)
      }
    }

    createTestData()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <Beaker className="h-6 w-6 text-indigo-600 inline mr-2" />
          <h1 className="text-3xl font-bold inline">Criar Dados de Teste</h1>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            {isSuccess ? (
              <p className="text-blue-800 whitespace-pre-wrap font-mono flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                {status}
              </p>
            ) : isError ? (
              <p className="text-red-800 whitespace-pre-wrap font-mono flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                {status}
              </p>
            ) : (
              <p className="text-blue-800 whitespace-pre-wrap font-mono">
                {status}
              </p>
            )}
          </div>

          {!loading && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">Após criar os dados, você pode:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Ir para <strong>Frequência</strong> para ver o aluno "João Silva Teste"</li>
                <li>Ir para <strong>Mensalidades</strong> para ver as mensalidades criadas</li>
                <li>Ir para <strong>Relatórios → Frequência</strong> para verificar se a última frequência aparece</li>
                <li>Ir para <strong>Relatórios → Financeiro</strong> para ver as mensalidades (paga em verde, pendente em vermelho)</li>
              </ul>
              
              <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800"><AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /><strong> Nota:</strong> Os dados de teste foram criados com:</p>
                <ul className="list-disc list-inside mt-2 text-sm text-yellow-700">
                  <li>Frequência de hoje: Presente</li>
                  <li>Frequência de ontem: Ausente</li>
                  <li>Mensalidade pendente de hoje: R$ 500,00</li>
                  <li>Mensalidade paga do mês passado: R$ 500,00</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
