'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { parseCurrency, formatCurrency } from '@/lib/utils/currency'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

interface Servico {
  id?: number
  nome: string
  descricao?: string
  valor_padrao: number
  tipo?: string
  status?: string
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const defaultForm: Servico = { nome: '', descricao: '', valor_padrao: 0, tipo: 'creche', status: 'ativo' }

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [formData, setFormData] = useState<Servico>({ ...defaultForm })
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
  const [inlineValue, setInlineValue] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const inlineRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  const loadServicos = useCallback(async () => {
    try { setLoading(true);       const data = await invoke<Servico[]>('listar_servicos', { tipo: filtroTipo === 'todos' ? null : filtroTipo }); setServicos(data || []) }
    catch { addToast('Erro ao carregar serviços', 'error') }
    finally { setLoading(false) }
  }, [addToast, filtroTipo])

  useEffect(() => { loadServicos() }, [loadServicos])

  useEffect(() => {
    if (inlineEditingId && inlineRef.current) inlineRef.current.focus()
  }, [inlineEditingId])

  const handleSave = async () => {
    if (!formData.nome.trim()) { addToast('Nome é obrigatório', 'error'); return }
    if (formData.valor_padrao <= 0) { addToast('Valor deve ser positivo', 'error'); return }
    try {
      if (editingId) { await invoke('update_servico', { servico: { ...formData, id: editingId } }); addToast('Serviço atualizado', 'success') }
      else { await invoke('criar_servico', { servico: formData }); addToast('Serviço criado', 'success') }
      resetForm(); setShowDialog(false); loadServicos()
    } catch (err: unknown) { addToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error') }
  }

  const handleDelete = async (id: number) => {
    try { await invoke('delete_servico', { id }); addToast('Serviço deletado', 'success'); setDeleteConfirm(null); loadServicos() }
    catch { addToast('Erro ao deletar', 'error') }
  }

  const handleEdit = (s: Servico) => { setFormData({ nome: s.nome, descricao: s.descricao, valor_padrao: s.valor_padrao, tipo: s.tipo || 'creche', status: s.status }); setEditingId(s.id || null); setShowDialog(true) }
  const resetForm = () => { setFormData({ ...defaultForm }); setEditingId(null) }

  const startInlineEdit = (servico: Servico) => {
    if (editingId) return
    setInlineEditingId(servico.id || null)
    setInlineValue(String(servico.valor_padrao))
    setInlineError(null)
  }

  const confirmInlineEdit = async () => {
    if (inlineEditingId === null) return
    const val = parseCurrency(inlineValue)
    if (isNaN(val) || val <= 0) { setInlineError('Valor deve ser positivo'); return }
    setInlineError(null)
    const servico = servicos.find((s) => s.id === inlineEditingId)
    if (!servico) { setInlineError('Serviço não encontrado'); return }
    try {
      await invoke('update_servico', { servico: { id: inlineEditingId, nome: servico.nome, descricao: servico.descricao || '', valor_padrao: val, tipo: servico.tipo || 'creche', status: servico.status || '' } })
      addToast('Valor atualizado', 'success')
      setInlineEditingId(null)
      loadServicos()
    } catch { addToast('Erro ao atualizar', 'error') }
  }

  const cancelInlineEdit = () => { setInlineEditingId(null); setInlineValue(''); setInlineError(null) }

  const totalServicos = servicos.filter((s) => s.status !== 'inativo').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Serviços Prestados</h1>
        <p className="text-sm text-gray-500">Catálogo de serviços com valores padrão</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Serviços</CardTitle>
          <CardDescription>{totalServicos} serviço(s) ativo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { resetForm(); setShowDialog(true) }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Serviço
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-600 dark:text-gray-400">Filtrar:</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="todos">Todos</option>
              <option value="creche">Instituição Educacional</option>
              <option value="interno">Interno</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
          ) : servicos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhum serviço cadastrado</p>
              <Button onClick={() => { resetForm(); setShowDialog(true) }} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Primeiro Serviço
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor Padrão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicos.map((s) => (
                    <TableRow key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <TableCell className="font-medium">{s.nome}</TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400 max-w-xs truncate">{s.descricao || '—'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          s.tipo === 'creche'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {s.tipo === 'creche' ? 'Instituição Educacional' : 'Interno'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {inlineEditingId === s.id ? (
                          <div className="flex items-center gap-1">
                            <input autoComplete="off"
                              ref={inlineRef}
                              type="text"
                              inputMode="decimal"
                              value={inlineValue}
                              onChange={(e) => { setInlineValue(e.target.value); setInlineError(null) }}
                              onKeyDown={(e) => { if (e.key === 'Enter') confirmInlineEdit(); if (e.key === 'Escape') cancelInlineEdit() }}
                              className="w-24 px-2 py-1 border border-indigo-500 dark:border-indigo-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"
                            />
                            <button onClick={confirmInlineEdit} className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check className="h-4 w-4" /></button>
                            <button onClick={cancelInlineEdit} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startInlineEdit(s)}
                            className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
                            title="Clique para editar"
                          >
                            {formatCurrency(s.valor_padrao)}
                          </button>
                        )}
                        {inlineError && inlineEditingId === s.id && <p className="text-xs text-red-500 mt-1">{inlineError}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'ativo' ? 'default' : 'outline'}>
                          {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(s)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteConfirm(s.id || 0)}>
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Serviço</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                <input autoComplete="off" type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Reforço Escolar" className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                <textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição do serviço..." className={INPUT_CLASS} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Padrão (R$)</label>
                <CurrencyInput
                  value={formData.valor_padrao}
                  onChange={(v) => setFormData({ ...formData, valor_padrao: v })}
                  className={INPUT_CLASS}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="creche">Instituição Educacional (para alunos)</option>
                  <option value="interno">Interno (empresa)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={INPUT_CLASS}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Atualizar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deletar Serviço?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">Esta ação não poderá ser desfeita. Se houver alunos vinculados a este serviço, a exclusão será bloqueada.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

