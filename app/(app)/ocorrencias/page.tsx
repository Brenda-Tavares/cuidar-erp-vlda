'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/context/ToastContext'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface Aluno {
  id: number
  nome: string
}

interface Ocorrencia {
  id: number
  aluno_id: number
  data: string
  descricao: string
  tipo?: string
  aluno?: Aluno
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const [date, time] = dateStr.split(' ')
    const parts = date.split('-')
    if (parts.length === 3 && time) {
      return `${parts[2]}/${parts[1]}/${parts[0]} ${time.substring(0, 5)}`
    }
    return dateStr
  } catch {
    return dateStr
  }
}

interface DeleteConfirmDialogProps {
  isOpen: boolean
  ocorrencia: Ocorrencia | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, ocorrencia, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !ocorrencia) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Ocorrência?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Tem certeza que deseja deletar esta ocorrência de <strong>{ocorrencia.aluno?.nome || 'desconhecido'}</strong>? Esta ação não poderá ser desfeita.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Deletando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Deletar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroAlunoId, setFiltroAlunoId] = useState<number | 'todos'>('todos')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; ocorrencia: Ocorrencia | null; isLoading: boolean }>({
    isOpen: false,
    ocorrencia: null,
    isLoading: false,
  })
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ocorrenciasData, alunosData] = await Promise.all([
          invoke<Ocorrencia[]>('get_ocorrencias'),
          invoke<Aluno[]>('listar_alunos'),
        ])

        const enrichedOcorrencias = (ocorrenciasData ?? []).map((o) => ({
          ...o,
          aluno: (alunosData ?? []).find((a) => a.id === o.aluno_id),
        }))
        
        setOcorrencias(enrichedOcorrencias)
        setAlunos(alunosData)
      } catch (error) {
        console.error('Erro ao carregar ocorrências:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const filtradas = filtroAlunoId === 'todos' ? ocorrencias : ocorrencias.filter((o) => o.aluno_id === filtroAlunoId)

  const handleDeleteClick = (ocorrencia: Ocorrencia) => {
    setDeleteDialog({ isOpen: true, ocorrencia, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.ocorrencia) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_ocorrencia', { id: deleteDialog.ocorrencia!.id })
      setOcorrencias((prev) => prev.filter((o) => o.id !== deleteDialog.ocorrencia!.id))
      setDeleteDialog({ isOpen: false, ocorrencia: null, isLoading: false })
      toast.addToast('Ocorrência deletada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao deletar ocorrência:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, ocorrencia: null, isLoading: false })
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ocorrências</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        ocorrencia={deleteDialog.ocorrencia}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ocorrências</h1>
        <button
          onClick={() => router.push('/ocorrencias/novo')}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Ocorrência
        </button>
      </div>

      <div className="mb-4">
        <select
          value={filtroAlunoId}
          onChange={(e) => setFiltroAlunoId(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="todos">Todos os Alunos</option>
          {alunos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Nenhuma ocorrência encontrada"
          description="Registre a primeira ocorrência para manter o histórico dos alunos."
          action={
            <Button onClick={() => router.push('/ocorrencias/novo')}>
              <Plus className="mr-2 h-4 w-4" />Nova Ocorrência
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((ocorrencia) => (
                <TableRow key={ocorrencia.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">{ocorrencia.aluno?.nome || 'Desconhecido'}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{formatDateTime(ocorrencia.data)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        ocorrencia.tipo === 'Positiva'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : ocorrencia.tipo === 'Negativa'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {ocorrencia.tipo || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400 max-w-xs truncate">{ocorrencia.descricao}</TableCell>
                  <TableCell className="flex gap-3">
                    <button
                      onClick={() => router.push(`/ocorrencias/editar?id=${ocorrencia.id}`)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(ocorrencia)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
