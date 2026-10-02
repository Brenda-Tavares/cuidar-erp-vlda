'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/lib/context/ToastContext'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface Aluno {
  id: number
  nome: string
  data_nascimento: string
  nome_responsavel: string
  telefone_responsavel: string
  status: string
  turma_id: number | null
  numero_matricula?: string | null
}

interface PaginacaoResponse<T> {
  dados: T[]
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}

type FiltroStatus = 'todos' | 'ativo' | 'inativo'

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

interface DeleteConfirmDialogProps {
  isOpen: boolean
  aluno: Aluno | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, aluno, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !aluno) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Aluno?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Tem certeza que deseja deletar o aluno <strong>{aluno.nome}</strong>? Esta ação não poderá ser desfeita.
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Todos os registros relacionados (frequências, mensalidades, ocorrências) também serão deletados.
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

export default function AlunosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; aluno: Aluno | null; isLoading: boolean }>({
    isOpen: false,
    aluno: null,
    isLoading: false,
  })
  const router = useRouter()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const recarregar = async () => {
    setLoading(true)
    try {
      const result = await invoke<PaginacaoResponse<Aluno>>('listar_alunos_paginado', {
        paginacao: {
          pagina,
          por_pagina: porPagina,
          ordenacao: 'nome',
          direcao: 'asc',
        },
        filtros: {
          status: filtro,
        },
      })
      setAlunos(result.dados)
      setTotal(result.total)
      setTotalPaginas(result.total_paginas)
    } catch (error) {
      console.error(error)
      toastRef.current.addToast('Erro ao carregar alunos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    recarregar()
  }, [pagina, porPagina, filtro])

  const handleDeleteClick = (aluno: Aluno) => {
    setDeleteDialog({ isOpen: true, aluno, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.aluno) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_aluno', { id: deleteDialog.aluno!.id })
      setDeleteDialog({ isOpen: false, aluno: null, isLoading: false })
      toast.addToast('Aluno deletado com sucesso!', 'success')
      recarregar()
    } catch (error) {
      console.error('Erro ao deletar aluno:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, aluno: null, isLoading: false })
  }

  return (
    <div>
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        aluno={deleteDialog.aluno}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Alunos</h1>
        <button
          onClick={() => router.push('/alunos/novo')}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Aluno
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {([['todos', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']] as [FiltroStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFiltro(key); setPagina(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === key
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : alunos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum aluno encontrado"
          description="Cadastre o primeiro aluno para começar a gerenciar sua turma."
          action={
            <Button onClick={() => router.push('/alunos/novo')}>
              <Plus className="mr-2 h-4 w-4" />Novo Aluno
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data Nascimento</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunos.map((aluno) => (
                <TableRow key={aluno.id}>
                  <TableCell className="font-mono text-xs text-gray-500 dark:text-gray-400">{aluno.numero_matricula || '-'}</TableCell>
                  <TableCell className="font-medium">{aluno.nome}</TableCell>
                  <TableCell>{formatDate(aluno.data_nascimento)}</TableCell>
                  <TableCell>{aluno.nome_responsavel}</TableCell>
                  <TableCell>{aluno.telefone_responsavel}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${aluno.status === 'ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {aluno.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      <button onClick={() => router.push(`/alunos/editar?id=${aluno.id}`)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteClick(aluno)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors" title="Deletar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Mostrando {alunos.length} de {total} registros
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="flex items-center gap-1 px-3 py-1.5 border dark:border-gray-600 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                {pagina} de {totalPaginas}
              </span>

              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="flex items-center gap-1 px-3 py-1.5 border dark:border-gray-600 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>

              <select
                value={porPagina}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value))
                  setPagina(1)
                }}
                className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={10}>10/pág</option>
                <option value={20}>20/pág</option>
                <option value={50}>50/pág</option>
                <option value={100}>100/pág</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
