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

interface GastoFixo {
  id?: number
  nome: string
  valor_padrao: number
  valor_atual: number
  mes: string
  descricao?: string
  status?: string
  editavel?: boolean
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS =
  'w-full px-3 py-2 border border-red-500 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500'

export default function GastosFixosPage() {
  const [gastos, setGastos] = useState<GastoFixo[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
  const [inlineValue, setInlineValue] = useState<string>('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [savingInline, setSavingInline] = useState(false)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  const [formData, setFormData] = useState<GastoFixo>({
    nome: '',
    valor_padrao: 0,
    valor_atual: 0,
    mes: new Date().toISOString().split('T')[0].substring(0, 7),
    descricao: '',
    status: 'ativo',
    editavel: true,
  })

  const loadGastos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await invoke<GastoFixo[]>('listar_gastos_fixos')
      setGastos(data || [])
    } catch (error) {
      addToast('Erro ao carregar gastos fixos', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadGastos()
  }, [loadGastos])

  const startInlineEdit = (gasto: GastoFixo) => {
    if (gasto.editavel === false) return
    setInlineEditingId(gasto.id || null)
    setInlineValue(gasto.valor_atual.toString())
    setInlineError(null)
    setTimeout(() => inlineInputRef.current?.focus(), 50)
  }

  const parseCurrency = (val: string): number => parseFloat(val.replace(',', '.'))

  const validateInlineValue = (val: string): boolean => {
    const num = parseCurrency(val)
    if (isNaN(num) || num <= 0) {
      setInlineError('Valor deve ser positivo')
      return false
    }
    setInlineError(null)
    return true
  }

  const saveInlineEdit = async () => {
    if (inlineEditingId === null || !validateInlineValue(inlineValue)) return

    const numValue = parseCurrency(inlineValue)
    const gasto = gastos.find((g) => g.id === inlineEditingId)
    if (!gasto) return

    setSavingInline(true)
    try {
      await invoke('update_gasto_fixo', {
        gasto: {
          ...gasto,
          valor_atual: numValue,
        },
      })
      addToast('Valor atualizado com sucesso', 'success')
      setInlineEditingId(null)
      loadGastos()
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Erro ao atualizar valor', 'error')
    } finally {
      setSavingInline(false)
    }
  }

  const cancelInlineEdit = () => {
    setInlineEditingId(null)
    setInlineValue('')
    setInlineError(null)
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveInlineEdit()
    } else if (e.key === 'Escape') {
      cancelInlineEdit()
    }
  }

  const handleSave = async () => {
    if (!formData.nome || formData.nome.trim() === '') {
      addToast('Nome é obrigatório', 'error')
      return
    }
    if (formData.valor_padrao <= 0 || formData.valor_atual <= 0) {
      addToast('Valores devem ser positivos', 'error')
      return
    }

    try {
      if (editingId) {
        await invoke('update_gasto_fixo', {
          gasto: { ...formData, id: editingId },
        })
        addToast('Gasto fixo atualizado com sucesso', 'success')
      } else {
        await invoke('criar_gasto_fixo', { gasto: formData })
        addToast('Gasto fixo criado com sucesso', 'success')
      }
      resetForm()
      setShowDialog(false)
      loadGastos()
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Erro ao salvar gasto fixo', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_gasto_fixo', { id })
      addToast('Gasto fixo deletado', 'success')
      setDeleteConfirm(null)
      loadGastos()
    } catch (error) {
      addToast('Erro ao deletar gasto fixo', 'error')
    }
  }

  const handleEdit = (gasto: GastoFixo) => {
    setFormData(gasto)
    setEditingId(gasto.id || null)
    setShowDialog(true)
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      valor_padrao: 0,
      valor_atual: 0,
      mes: new Date().toISOString().split('T')[0].substring(0, 7),
      descricao: '',
      status: 'ativo',
      editavel: true,
    })
    setEditingId(null)
  }

  const totalValorAtual = gastos.reduce((sum, g) => sum + g.valor_atual, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gastos Fixos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
          Gerencie os gastos fixos da empresa (aluguel, energia, água, etc.)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalValorAtual)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {gastos.filter((g) => g.status === 'ativo').length} gastos ativos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Média por Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {gastos.length > 0
                ? formatCurrency(totalValorAtual / gastos.length)
                : formatCurrency(0)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{gastos.length} registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Mês Referência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {new Date().toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Período atual</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-between items-center">
        <div />
        <Button
          onClick={() => {
            resetForm()
            setShowDialog(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar Gasto Fixo
        </Button>
      </div>

      {/* Dialog for Create/Edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Gasto Fixo</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                <input autoComplete="off"
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Aluguel, Água, Energia..."
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Padrão</label>
                  <CurrencyInput
                    value={formData.valor_padrao}
                    onChange={(v) => setFormData({ ...formData, valor_padrao: v, valor_atual: editingId ? formData.valor_atual : v })}
                    className={INPUT_CLASS}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Atual</label>
                  <CurrencyInput
                    value={formData.valor_atual}
                    onChange={(v) => setFormData({ ...formData, valor_atual: v })}
                    className={INPUT_CLASS}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês</label>
                <input autoComplete="off"
                  type="month"
                  value={formData.mes}
                  onChange={(e) => setFormData({ ...formData, mes: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Notas adicionais..."
                  className={INPUT_CLASS}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingId ? 'Atualizar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Gasto Fixo?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Tem certeza que deseja deletar este gasto fixo? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                Deletar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos Cadastrados</CardTitle>
          <CardDescription>
            {gastos.length} registro{gastos.length !== 1 ? 's' : ''} — Clique no Valor Atual para editar diretamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : gastos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Nenhum gasto fixo cadastrado</p>
              <Button
                onClick={() => {
                  resetForm()
                  setShowDialog(true)
                }}
                variant="outline"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Gasto Fixo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor Padrão</TableHead>
                    <TableHead>Valor Atual</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => (
                    <TableRow key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">{g.nome}</TableCell>
                      <TableCell className="text-gray-900 dark:text-gray-100">{formatCurrency(g.valor_padrao)}</TableCell>
                      <TableCell>
                        {inlineEditingId === g.id ? (
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <input autoComplete="off"
                                ref={inlineInputRef}
                                type="text"
                                inputMode="decimal"
                                value={inlineValue}
                                onChange={(e) => {
                                  setInlineValue(e.target.value)
                                  setInlineError(null)
                                }}
                                onKeyDown={handleInlineKeyDown}
                                className={
                                  inlineError
                                    ? INPUT_ERROR_CLASS + ' w-32'
                                    : INPUT_CLASS + ' w-32'
                                }
                                disabled={savingInline}
                              />
                              {inlineError && (
                                <p className="text-xs text-red-500 mt-0.5">{inlineError}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveInlineEdit}
                              disabled={savingInline || !!inlineError}
                              className="h-8 w-8 p-0 text-green-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelInlineEdit}
                              disabled={savingInline}
                              className="h-8 w-8 p-0 text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startInlineEdit(g)}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors flex items-center gap-1 group"
                            title="Clique para editar"
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(g.valor_atual)}</span>
                            <Edit2 className="h-3 w-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-900 dark:text-gray-100">{g.mes}</TableCell>
                      <TableCell>
                        <Badge variant={g.status === 'ativo' ? 'default' : 'secondary'}>
                          {g.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(g)}
                            disabled={g.editavel === false}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(g.id || 0)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">Total</TableCell>
                    <TableCell className="text-gray-900 dark:text-gray-100">{formatCurrency(gastos.reduce((s, g) => s + g.valor_padrao, 0))}</TableCell>
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(totalValorAtual)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

