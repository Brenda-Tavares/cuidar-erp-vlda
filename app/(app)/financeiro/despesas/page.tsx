'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Plus, Edit2, Trash2, Check, Filter, X } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { parseCurrency, formatCurrency } from '@/lib/utils/currency'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

interface CompanyExpense {
  id?: number
  categoria: string
  descricao?: string
  valor: number
  data_despesa: string
  data_pagamento?: string
  forma_pagamento?: string
  funcionario_id?: number
  status?: string
  comprovante_path?: string
  notas?: string
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch { return dateStr }
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100'

const CATEGORIAS_PRESET = [
  'Aluguel', 'Energia', 'Água', 'Internet', 'Materiais', 'Alimentação',
  'Manutenção', 'Limpeza', 'Salários', 'Benefícios', 'Impostos', 'Outros',
]

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
]

const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pago: { variant: 'default', label: 'Pago' },
    pendente: { variant: 'secondary', label: 'Pendente' },
    cancelado: { variant: 'outline', label: 'Cancelado' },
  }
  const c = config[status || 'pendente'] || config.pendente
  return <Badge variant={c.variant}>{c.label}</Badge>
}

const defaultForm: CompanyExpense = {
  categoria: '', descricao: '', valor: 0,
  data_despesa: new Date().toISOString().split('T')[0],
  data_pagamento: '', forma_pagamento: 'pix', status: 'pendente', notas: '',
}

export default function DespesasPage() {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [payDialog, setPayDialog] = useState<number | null>(null)
  const [formData, setFormData] = useState<CompanyExpense>({ ...defaultForm })
  const [paymentData, setPaymentData] = useState({ data_pagamento: '', forma_pagamento: 'pix' })
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { addToast } = useToast()

  const loadExpenses = useCallback(async () => {
    try { setLoading(true); const data = await invoke<CompanyExpense[]>('listar_company_expenses'); setExpenses(data || []) }
    catch (error) { addToast('Erro ao carregar despesas', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  const filteredExpenses = expenses.filter((e) => {
    if (filterStatus !== 'todos' && e.status !== filterStatus) return false
    if (filterCategoria && e.categoria !== filterCategoria) return false
    if (filterDataInicio && e.data_despesa < filterDataInicio) return false
    if (filterDataFim && e.data_despesa > filterDataFim) return false
    return true
  })

  const uniqueCategorias = [...new Set(expenses.map((e) => e.categoria).filter(Boolean))].sort()

  const totalPending = filteredExpenses
    .filter((e) => e.status === 'pendente')
    .reduce((s, e) => s + e.valor, 0)

  const totalPaid = filteredExpenses
    .filter((e) => e.status === 'pago')
    .reduce((s, e) => s + e.valor, 0)

  const handleSave = async () => {
    if (!formData.categoria || formData.valor <= 0) { addToast('Categoria e valor são obrigatórios', 'error'); return }
    try {
      if (editingId) { await invoke('update_company_expense', { expense: { ...formData, id: editingId } }); addToast('Despesa atualizada', 'success') }
      else { await invoke('criar_company_expense', { expense: formData }); addToast('Despesa criada', 'success') }
      resetForm(); setShowDialog(false); loadExpenses()
    } catch (error: unknown) { addToast(error instanceof Error ? error.message : 'Erro ao salvar', 'error') }
  }

  const handlePay = async (id: number) => {
    try {
      await invoke('pagar_company_expense', { id, dataPagamento: paymentData.data_pagamento, formaPagamento: paymentData.forma_pagamento })
      addToast('Despesa marcada como paga', 'success'); setPayDialog(null); loadExpenses()
    } catch (error) { addToast('Erro ao marcar como pago', 'error') }
  }

  const handleDelete = async (id: number) => {
    try { await invoke('delete_company_expense', { id }); addToast('Despesa deletada', 'success'); setDeleteConfirm(null); loadExpenses() }
    catch (error) { addToast('Erro ao deletar', 'error') }
  }

  const handleEdit = (expense: CompanyExpense) => { setFormData({ ...expense }); setEditingId(expense.id || null); setShowDialog(true) }
  const resetForm = () => { setFormData({ ...defaultForm }); setEditingId(null) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Despesas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie as despesas operacionais da empresa</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Pagas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending + totalPaid)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{filteredExpenses.length} registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Button onClick={() => { resetForm(); setShowDialog(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Despesa
        </Button>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={INPUT_CLASS + ' w-36'}>
                  {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria</label>
                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className={INPUT_CLASS + ' w-44'}>
                  <option value="">Todas</option>
                  {uniqueCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data Início</label>
                <input autoComplete="off" type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} className={INPUT_CLASS + ' w-36'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data Fim</label>
                <input autoComplete="off" type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className={INPUT_CLASS + ' w-36'} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('todos'); setFilterCategoria(''); setFilterDataInicio(''); setFilterDataFim('') }} className="gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                <div className="flex gap-2 mt-1">
                  <input autoComplete="off" list="categorias-list" type="text" value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Ex: Aluguel" className={INPUT_CLASS} />
                  <datalist id="categorias-list">
                    {CATEGORIAS_PRESET.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor (R$)</label>
                <CurrencyInput
                  value={formData.valor}
                  onChange={(v) => setFormData({ ...formData, valor: v })}
                  className={INPUT_CLASS}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
              <textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes da despesa..." className={INPUT_CLASS} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data da Despesa</label>
                <input autoComplete="off" type="date" value={formData.data_despesa} onChange={(e) => setFormData({ ...formData, data_despesa: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de Pagamento</label>
                <select value={formData.forma_pagamento} onChange={(e) => setFormData({ ...formData, forma_pagamento: e.target.value })} className={INPUT_CLASS}>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notas</label>
              <textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Informações adicionais..." className={INPUT_CLASS} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Atualizar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data do Pagamento</label>
              <input autoComplete="off" type="date" value={paymentData.data_pagamento}
                onChange={(e) => setPaymentData({ ...paymentData, data_pagamento: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de Pagamento</label>
              <select value={paymentData.forma_pagamento}
                onChange={(e) => setPaymentData({ ...paymentData, forma_pagamento: e.target.value })} className={INPUT_CLASS}>
                {FORMAS_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={() => payDialog && handlePay(payDialog)} className="gap-2">
              <Check className="h-4 w-4" /> Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deletar Despesa?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">Esta ação não poderá ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas Registradas</CardTitle>
          <CardDescription>{filteredExpenses.length} registro{filteredExpenses.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">{expenses.length === 0 ? 'Nenhuma despesa registrada' : 'Nenhuma despesa encontrada com os filtros atuais'}</p>
              {expenses.length === 0 && (
                <Button onClick={() => { resetForm(); setShowDialog(true) }} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Primeira Despesa
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e) => (
                    <TableRow key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-medium">{e.categoria}</TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600 dark:text-gray-400">{e.descricao || '—'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(e.valor)}</TableCell>
                      <TableCell>{formatDate(e.data_despesa)}</TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {e.status === 'pendente' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                              onClick={() => { setPaymentData({ data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'pix' }); setPayDialog(e.id || 0) }}>
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </Button>
                          )}
                          {e.status === 'pendente' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(e)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteConfirm(e.id || 0)}>
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">Total</TableCell>
                    <TableCell />
                    <TableCell className="font-bold">{formatCurrency(filteredExpenses.reduce((s, e) => s + e.valor, 0))}</TableCell>
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

