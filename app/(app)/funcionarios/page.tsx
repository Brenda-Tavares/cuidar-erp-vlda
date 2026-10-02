'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Users, Lock, ArrowRight } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { formatCPF, formatPhone } from '@/lib/utils/validation'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface Funcionario {
  id: number
  nome_completo: string
  nome_social: string | null
  cpf: string | null
  email: string
  telefone: string
  cargo_nome: string
  salario: number
  cargo_id: number
  escala_trabalho_id: number | null
  escala_nome: string | null
  status: string
}

interface Cargo {
  id: number
  nome: string
}

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  funcionario: Funcionario | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, funcionario, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !funcionario) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Deletar Funcionário?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Tem certeza que deseja deletar o funcionário <strong>{funcionario.nome_completo}</strong>? Esta ação não poderá ser desfeita.
            </p>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Todos os registros relacionados (turmas, frequências, etc) também serão deletados.
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

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; funcionario: Funcionario | null; isLoading: boolean }>({
    isOpen: false,
    funcionario: null,
    isLoading: false,
  })
  const router = useRouter()
  const toast = useToast()

  const fetchData = async () => {
    try {
      setLoading(true)
      const [funcs, crgs] = await Promise.all([
        invoke<Funcionario[]>('listar_funcionarios').catch(() => []),
        invoke<Cargo[]>('listar_cargos').catch(() => []),
      ])
      setFuncionarios(funcs || [])
      setCargos(crgs || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filtrados = funcionarios
    .filter((f) => (filtro === 'todos' ? true : f.status === filtro))
    .filter((f) => f.nome_completo.toLowerCase().includes(busca.toLowerCase()))

  const handleDeleteClick = (funcionario: Funcionario) => {
    setDeleteDialog({ isOpen: true, funcionario, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.funcionario) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_funcionario', { id: deleteDialog.funcionario!.id })
      setFuncionarios((prev) => prev.filter((f) => f.id !== deleteDialog.funcionario!.id))
      setDeleteDialog({ isOpen: false, funcionario: null, isLoading: false })
      toast.addToast('Funcionário deletado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao deletar funcionário:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, funcionario: null, isLoading: false })
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funcionários</h1>
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funcionários</h1>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg cursor-not-allowed opacity-50"
            title="Crie um cargo primeiro"
          >
            <Lock className="h-5 w-5" />
            Novo Funcionário
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Nenhum cargo criado</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Você precisa criar pelo menos um cargo antes de adicionar funcionários.</p>
            <button
              onClick={() => router.push('/funcionarios/cargos')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mt-2 flex items-center gap-1"
            >
              Criar cargo aqui <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhum funcionário cadastrado</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Comece criando um cargo e depois um funcionário</p>
          <button
            onClick={() => router.push('/funcionarios/cargos')}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar Cargo
          </button>
        </div>
      </div>
    )
  }

  if (funcionarios.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funcionários</h1>
          <button
            onClick={() => router.push('/funcionarios/novo')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            Novo Funcionário
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhum funcionário cadastrado</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Comece criando um novo funcionário</p>
          <button
            onClick={() => router.push('/funcionarios/novo')}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Criar Funcionário
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        funcionario={deleteDialog.funcionario}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funcionários</h1>
        <div className="relative group">
          <button
            onClick={() => router.push('/funcionarios/novo')}
            disabled={cargos.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              cargos.length === 0
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed opacity-50'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
            }`}
            title={cargos.length === 0 ? 'Crie um cargo primeiro' : ''}
          >
            <Plus className="h-5 w-5" />
            Novo Funcionário
          </button>
          {cargos.length === 0 && (
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
              Crie um cargo primeiro
            </div>
          )}
        </div>
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
              filtro === 'todos'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltro('ativo')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'ativo'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setFiltro('inativo')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filtro === 'inativo'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
              <TableHead>CPF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Escala</TableHead>
              <TableHead>Salário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((funcionario) => (
              <TableRow key={funcionario.id}>
                <TableCell className="font-medium">{funcionario.nome_completo}</TableCell>
                <TableCell className="font-mono">{formatCPF(funcionario.cpf ?? '')}</TableCell>
                <TableCell>{funcionario.email}</TableCell>
                <TableCell>{funcionario.cargo_nome}</TableCell>
                <TableCell>{funcionario.escala_nome || '-'}</TableCell>
                <TableCell className="font-medium">
                  R$ {funcionario.salario.toFixed(2).replace('.', ',')}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      funcionario.status === 'ativo'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {funcionario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/funcionarios/editar?id=${funcionario.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="text-xs font-medium hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(funcionario)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
          <p>Nenhum funcionário encontrado com os filtros aplicados</p>
        </div>
      )}
    </div>
  )
}

