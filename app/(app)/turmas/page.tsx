'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/lib/context/ToastContext'

interface Turma {
  id: number
  nome: string
  ano: number | null
  turno: string | null
  vagas: number | null
  status: string | null
  responsaveis: string | null
}

type FiltroStatus = 'todas' | 'ativa' | 'inativa'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  turma: Turma | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, turma, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !turma) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Turma?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Tem certeza que deseja deletar a turma <strong>{turma.nome}</strong>? Esta ação não poderá ser desfeita.
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Todos os alunos vinculados e seus registros de frequência também serão afetados.
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

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; turma: Turma | null; isLoading: boolean }>({
    isOpen: false,
    turma: null,
    isLoading: false,
  })
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    invoke<Turma[]>('get_turmas')
      .then(setTurmas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtradas = filtro === 'todas' ? turmas : turmas.filter((t) => t.status === filtro)

  const handleDeleteClick = (turma: Turma) => {
    setDeleteDialog({ isOpen: true, turma, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.turma) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_turma', { id: deleteDialog.turma!.id })
      setTurmas((prev) => prev.filter((t) => t.id !== deleteDialog.turma!.id))
      setDeleteDialog({ isOpen: false, turma: null, isLoading: false })
      toast.addToast('Turma deletada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao deletar turma:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, turma: null, isLoading: false })
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        turma={deleteDialog.turma}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Turmas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as turmas da instituição educacional</p>
        </div>
        <Button onClick={() => router.push('/turmas/novo')}>
          <Plus className="mr-2 h-4 w-4" />Nova Turma
        </Button>
      </div>

      <div className="flex gap-2">
        {([['todas', 'Todas'], ['ativa', 'Ativas'], ['inativa', 'Inativas']] as [FiltroStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === key ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Todas as Turmas</CardTitle>
          <CardDescription>{filtradas.length} turma{filtradas.length !== 1 ? 's' : ''} encontrada{filtradas.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtradas.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhuma turma encontrada"
              description="Crie sua primeira turma para começar a organizar os alunos por faixa etária e período."
              action={
                <Button onClick={() => router.push('/turmas/novo')}>
                  <Plus className="mr-2 h-4 w-4" />Nova Turma
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsaveis</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((turma) => {
                  const responsaveis = turma.responsaveis ? JSON.parse(turma.responsaveis) as string[] : []
                  return (
                    <TableRow key={turma.id} className="cursor-pointer" onClick={() => router.push(`/turmas/editar?id=${turma.id}`)}>
                      <TableCell className="font-medium">{turma.nome}</TableCell>
                      <TableCell>{turma.ano ?? '-'}</TableCell>
                      <TableCell>{turma.turno ?? '-'}</TableCell>
                      <TableCell><Badge variant={turma.status === 'ativa' ? 'default' : 'secondary'}>{turma.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{responsaveis.length > 0 ? responsaveis.join(', ') : '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button onClick={() => router.push(`/turmas/editar?id=${turma.id}`)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteClick(turma)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors" title="Deletar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
