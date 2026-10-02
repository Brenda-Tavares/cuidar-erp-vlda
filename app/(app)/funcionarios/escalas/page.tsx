'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Clock, ArrowLeft } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { EscalaTrabalhoModal } from '@/components/modals/EscalaTrabalhoModal'
import { EscalaTrabalho } from '@/lib/types/escala'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

const DIAS_LABEL: Record<string, string> = {
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
  domingo: 'Dom',
}

function formatDias(diasSemana: string): string {
  try {
    const dias = JSON.parse(diasSemana)
    if (!Array.isArray(dias) || dias.length === 0) return '-'
    return dias.map((d: string) => DIAS_LABEL[d] || d).join(', ')
  } catch {
    return diasSemana || '-'
  }
}

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  escala: EscalaTrabalho | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, escala, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !escala) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Deletar Escala de Trabalho?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Tem certeza que deseja deletar a escala <strong>{escala.nome}</strong>?
            </p>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Funcionários vinculados a esta escala ficarão sem escala definida.
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

export default function EscalasPage() {
  const [escalas, setEscalas] = useState<EscalaTrabalho[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; escala: EscalaTrabalho | null; isLoading: boolean }>({
    isOpen: false,
    escala: null,
    isLoading: false,
  })
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; escala: EscalaTrabalho | null }>({
    isOpen: false,
    mode: 'create',
    escala: null,
  })
  const router = useRouter()
  const toast = useToast()

  const fetchEscalas = async () => {
    try {
      setLoading(true)
      const result = await invoke<EscalaTrabalho[]>('listar_escalas_trabalho')
      setEscalas(result || [])
    } catch (error) {
      console.error('Erro ao carregar escalas:', error)
      toast.addToast('Erro ao carregar escalas', 'error')
      setEscalas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEscalas()
  }, [])

  const filtrados = escalas
    .filter((e) => (filtro === 'todos' ? true : e.status === filtro))
    .filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()))

  const handleDeleteConfirm = async () => {
    const escala = deleteDialog.escala
    if (!escala) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))
    try {
      await invoke('delete_escala_trabalho', { id: escala.id })
      setEscalas((prev) => prev.filter((e) => e.id !== escala.id))
      setDeleteDialog({ isOpen: false, escala: null, isLoading: false })
      toast.addToast('Escala deletada com sucesso!', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao deletar. Tente novamente.'
      toast.addToast(message, 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Escalas de Trabalho</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (escalas.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Escalas de Trabalho</h1>
        </div>

        <EscalaTrabalhoModal isOpen={modalState.isOpen} mode={modalState.mode} escala={modalState.escala} onClose={() => setModalState({ isOpen: false, mode: 'create', escala: null })} onSuccess={fetchEscalas} />

        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhuma escala criada</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Comece criando uma escala de trabalho</p>
          <button
            onClick={() => setModalState({ isOpen: true, mode: 'create', escala: null })}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar Escala
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <DeleteConfirmDialog isOpen={deleteDialog.isOpen} escala={deleteDialog.escala} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteDialog({ isOpen: false, escala: null, isLoading: false })} isLoading={deleteDialog.isLoading} />

      <EscalaTrabalhoModal isOpen={modalState.isOpen} mode={modalState.mode} escala={modalState.escala} onClose={() => setModalState({ isOpen: false, mode: 'create', escala: null })} onSuccess={fetchEscalas} />

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Escalas de Trabalho</h1>
        <button
          onClick={() => setModalState({ isOpen: true, mode: 'create', escala: null })}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nova Escala
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <input autoComplete="off"
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'todos' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltro('ativo')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'ativo' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Ativas
          </button>
          <button
            onClick={() => setFiltro('inativo')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'inativo' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Inativas
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((escala) => (
              <TableRow key={escala.id}>
                <TableCell className="font-medium">{escala.nome}</TableCell>
                <TableCell className="text-sm">{formatDias(escala.dias_semana)}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {escala.hora_entrada} – {escala.hora_saida}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {escala.descricao ? escala.descricao.substring(0, 50) + (escala.descricao.length > 50 ? '...' : '') : '-'}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      escala.status === 'ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {escala.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalState({ isOpen: true, mode: 'edit', escala })}
                      className="inline-flex items-center gap-1 px-3 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      aria-label={`Editar escala ${escala.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="text-xs font-medium hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => setDeleteDialog({ isOpen: true, escala, isLoading: false })}
                      className="inline-flex items-center gap-1 px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      aria-label={`Deletar escala ${escala.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-xs font-medium hidden sm:inline">Deletar</span>
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtrados.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>Nenhuma escala encontrada com os filtros aplicados</p>
        </div>
      )}
    </div>
  )
}