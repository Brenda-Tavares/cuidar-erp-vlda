'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Briefcase, ArrowLeft } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { CargoModal } from '@/components/modals/CargoModal'
import { Cargo } from '@/lib/types/cargo'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  cargo: Cargo | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, cargo, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !cargo) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Deletar Cargo?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Tem certeza que deseja deletar o cargo <strong>{cargo.nome}</strong>?
            </p>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Se funcionários estiverem associados a este cargo, eles não poderão ser deletados. O cargo será marcado como inativo.
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

export default function CargosPage() {
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; cargo: Cargo | null; isLoading: boolean }>({
    isOpen: false,
    cargo: null,
    isLoading: false,
  })
  const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; cargo: Cargo | null }>({
    isOpen: false,
    mode: 'create',
    cargo: null,
  })
  const router = useRouter()
  const toast = useToast()

  const fetchCargos = async () => {
    try {
      setLoading(true)
      const result = await invoke<Cargo[]>('listar_cargos')
      setCargos(result || [])
    } catch (error) {
      console.error('Erro ao carregar cargos:', error)
      toast.addToast('Erro ao carregar cargos', 'error')
      setCargos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCargos()
  }, [])

  const filtrados = cargos
    .filter((c) => (filtro === 'todos' ? true : c.status === filtro))
    .filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()))

  const handleCreateClick = () => {
    setModalState({ isOpen: true, mode: 'create', cargo: null })
  }

  const handleEditClick = (cargo: Cargo) => {
    setModalState({ isOpen: true, mode: 'edit', cargo })
  }

  const handleDeleteClick = (cargo: Cargo) => {
    setDeleteDialog({ isOpen: true, cargo, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.cargo) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_cargo', { id: deleteDialog.cargo!.id })
      setCargos((prev) => prev.filter((c) => c.id !== deleteDialog.cargo!.id))
      setDeleteDialog({ isOpen: false, cargo: null, isLoading: false })
      toast.addToast('Cargo deletado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao deletar cargo:', error)
      const message = error instanceof Error ? error.message : 'Erro ao deletar. Tente novamente.'
      toast.addToast(message, 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, cargo: null, isLoading: false })
  }

  const handleModalClose = () => {
    setModalState({ isOpen: false, mode: 'create', cargo: null })
  }

  const handleModalSuccess = () => {
    fetchCargos()
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cargos</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (cargos.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cargos</h1>
      </div>

      <CargoModal isOpen={modalState.isOpen} mode={modalState.mode} cargo={modalState.cargo} onClose={handleModalClose} onSuccess={handleModalSuccess} />

      <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Briefcase className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhum cargo criado</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Comece criando um novo cargo</p>
          <button
            onClick={handleCreateClick}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar Cargo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <DeleteConfirmDialog isOpen={deleteDialog.isOpen} cargo={deleteDialog.cargo} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} isLoading={deleteDialog.isLoading} />

      <CargoModal isOpen={modalState.isOpen} mode={modalState.mode} cargo={modalState.cargo} onClose={handleModalClose} onSuccess={handleModalSuccess} />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cargos</h1>
        <button
          onClick={handleCreateClick}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Cargo
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <input autoComplete="off"
            type="text"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
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
            Ativos
          </button>
          <button
            onClick={() => setFiltro('inativo')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'inativo' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Inativos
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Salário Base</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((cargo) => (
              <TableRow key={cargo.id}>
                <TableCell className="font-medium">{cargo.nome}</TableCell>
                <TableCell>
                  {cargo.descricao ? cargo.descricao.substring(0, 50) + (cargo.descricao.length > 50 ? '...' : '') : '-'}
                </TableCell>
                <TableCell className="font-medium">
                  {cargo.salario_base ? `R$ ${cargo.salario_base.toFixed(2).replace('.', ',')}` : '-'}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      cargo.status === 'ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {cargo.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(cargo)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      aria-label={`Editar cargo ${cargo.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="text-xs font-medium hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(cargo)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      aria-label={`Deletar cargo ${cargo.nome}`}
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
          <p>Nenhum cargo encontrado com os filtros aplicados</p>
        </div>
      )}
    </div>
  )
}

