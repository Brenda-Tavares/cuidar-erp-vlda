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

interface CompanyRevenue {
  id?: number
  categoria: string
  descricao?: string
  valor: number
  data_receita: string
  data_recebimento?: string
  forma_recebimento?: string
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
  'Mensalidades', 'Matrículas', 'Eventos', 'Projetos', 'Doações',
  'Parcerias', 'Subvenções', 'Outros',
]

const FORMAS_RECEBIMENTO = [
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
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    recebido: { variant: 'default', label: 'Recebido' },
    pendente: { variant: 'secondary', label: 'Pendente' },
    cancelado: { variant: 'outline', label: 'Cancelado' },
  }
  const c = config[status || 'pendente'] || config.pendente
  return <Badge variant={c.variant}>{c.label}</Badge>
}

const defaultForm: CompanyRevenue = {
  categoria: '', descricao: '', valor: 0,
  data_receita: new Date().toISOString().split('T')[0],
  data_recebimento: '', forma_recebimento: 'pix', status: 'pendente', notas: '',
}

export default function ReceitasPage() {
  const [revenues, setRevenues] = useState<CompanyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [receiveDialog, setReceiveDialog] = useState<number | null>(null)
  const [formData, setFormData] = useState<CompanyRevenue>({ ...defaultForm })
  const [receiveData, setReceiveData] = useState({ data_recebimento: '', forma_recebimento: 'pix' })
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { addToast } = useToast()

  const loadRevenues = useCallback(async () => {
    try { setLoading(true); const data = await invoke<CompanyRevenue[]>('listar_company_revenues'); setRevenues(data || []) }
    catch (error) { addToast('Erro ao carregar receitas', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { loadRevenues() }, [loadRevenues])

  const filteredRevenues = revenues.filter((r) => {
    if (filterStatus !== 'todos' && r.status !== filterStatus) return false
    if (filterCategoria && r.categoria !== filterCategoria) return false
    if (filterDataInicio && r.data_receita < filterDataInicio) return false
    if (filterDataFim && r.data_receita > filterDataFim) return false
    return true
  })

  const uniqueCategorias = [...new Set(revenues.map((r) => r.categoria).filter(Boolean))].sort()

  const totalPending = filteredRevenues
    .filter((r) => r.status === 'pendente')
    .reduce((s, r) => s + r.valor, 0)

  const totalReceived = filteredRevenues
    .filter((r) => r.status === 'recebido')
    .reduce((s, r) => s + r.valor, 0)

  const handleSave = async () => {
    if (!formData.categoria || formData.valor <= 0) { addToast('Categoria e valor são obrigatórios', 'error'); return }
    try {
      if (editingId) { await invoke('update_company_revenue', { revenue: { ...formData, id: editingId } }); addToast('Receita atualizada', 'success') }
      else { await invoke('criar_company_revenue', { revenue: formData }); addToast('Receita criada', 'success') }
      resetForm(); setShowDialog(false); loadRevenues()
    } catch (error: unknown) { addToast(error instanceof Error ? error.message : 'Erro ao salvar', 'error') }
  }

  const handleReceive = async (id: number) => {
    try {
      await invoke('receber_company_revenue', { id, dataRecebimento: receiveData.data_recebimento, formaRecebimento: receiveData.forma_recebimento })
      addToast('Receita marcada como recebida', 'success'); setReceiveDialog(null); loadRevenues()
    } catch (error) { addToast('Erro ao marcar como recebida', 'error') }
  }

  const handleDelete = async (id: number) => {
    try { await invoke('delete_company_revenue', { id }); addToast('Receita deletada', 'success'); setDeleteConfirm(null); loadRevenues() }
    catch (error) { addToast('Erro ao deletar', 'error') }
  }

  const handleEdit = (revenue: CompanyRevenue) => { setFormData({ ...revenue }); setEditingId(revenue.id || null); setShowDialog(true) }
  const resetForm = () => { setFormData({ ...defaultForm }); setEditingId(null) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Receitas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie as receitas operacionais da empresa</p>
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
            <CardTitle className="text-sm font-medium text-green-600">Recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceived)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending + totalReceived)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{filteredRevenues.length} registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Button onClick={() => { resetForm(); setShowDialog(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Receita
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Receita</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                <div className="flex gap-2 mt-1">
                  <input autoComplete="off" list="categorias-list" type="text" value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Ex: Mensalidades" className={INPUT_CLASS} />
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
                placeholder="Detalhes da receita..." className={INPUT_CLASS} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data da Receita</label>
                <input autoComplete="off" type="date" value={formData.data_receita} onChange={(e) => setFormData({ ...formData, data_receita: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de Recebimento</label>
                <select value={formData.forma_recebimento} onChange={(e) => setFormData({ ...formData, forma_recebimento: e.target.value })} className={INPUT_CLASS}>
                  {FORMAS_RECEBIMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
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

      {/* Receive Dialog */}
      <Dialog open={!!receiveDialog} onOpenChange={() => setReceiveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data do Recebimento</label>
              <input autoComplete="off" type="date" value={receiveData.data_recebimento}
                onChange={(e) => setReceiveData({ ...receiveData, data_recebimento: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de Recebimento</label>
              <select value={receiveData.forma_recebimento}
                onChange={(e) => setReceiveData({ ...receiveData, forma_recebimento: e.target.value })} className={INPUT_CLASS}>
                {FORMAS_RECEBIMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialog(null)}>Cancelar</Button>
            <Button onClick={() => receiveDialog && handleReceive(receiveDialog)} className="gap-2">
              <Check className="h-4 w-4" /> Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deletar Receita?</DialogTitle></DialogHeader>
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
          <CardTitle>Receitas Registradas</CardTitle>
          <CardDescription>{filteredRevenues.length} registro{filteredRevenues.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
          ) : filteredRevenues.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">{revenues.length === 0 ? 'Nenhuma receita registrada' : 'Nenhuma receita encontrada com os filtros atuais'}</p>
              {revenues.length === 0 && (
                <Button onClick={() => { resetForm(); setShowDialog(true) }} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Primeira Receita
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
                  {filteredRevenues.map((r) => (
                    <TableRow key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-medium">{r.categoria}</TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600 dark:text-gray-400">{r.descricao || '—'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(r.valor)}</TableCell>
                      <TableCell>{formatDate(r.data_receita)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === 'pendente' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                              onClick={() => { setReceiveData({ data_recebimento: new Date().toISOString().split('T')[0], forma_recebimento: 'pix' }); setReceiveDialog(r.id || 0) }}>
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </Button>
                          )}
                          {r.status === 'pendente' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(r)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteConfirm(r.id || 0)}>
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">Total</TableCell>
                    <TableCell />
                    <TableCell className="font-bold">{formatCurrency(filteredRevenues.reduce((s, r) => s + r.valor, 0))}</TableCell>
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

