'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@/lib/tauri-invoke'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreditCard, Plus, Search, DollarSign, Trash2, RefreshCw, Pencil } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/lib/context/ToastContext'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

type StatusMensalidade = 'pago' | 'pendente' | 'vencido' | 'cancelado'

interface Mensalidade {
  id: number
  aluno_id: number
  vencimento: string
  valor: number
  pago: number
  data_pagamento: string | null
  forma_pagamento: string | null
  taxa_matricula: number
}

interface Aluno {
  id: number
  nome: string
  numero_matricula?: string | null
}

interface DeleteConfirmDialogProps {
  isOpen: boolean
  mensalidade: Mensalidade | null
  alunoNome: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, mensalidade, alunoNome, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !mensalidade) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Mensalidade?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Tem certeza que deseja deletar a mensalidade de <strong>{alunoNome}</strong>? Esta ação não poderá ser desfeita.
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

const statusVariant: Record<StatusMensalidade, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pago: 'default',
  pendente: 'secondary',
  vencido: 'destructive',
  cancelado: 'outline',
}

const statusLabel: Record<StatusMensalidade, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

const meses = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

const formasPagamento = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
]

function getStatus(vencimento: string, pago: number): StatusMensalidade {
  if (pago === 1) return 'pago'
  const venc = new Date(vencimento)
  return venc < new Date() ? 'vencido' : 'pendente'
}

export default function MensalidadesPage() {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [mesFiltro, setMesFiltro] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagamentoOpen, setPagamentoOpen] = useState(false)
  const [selectedMensalidade, setSelectedMensalidade] = useState<Mensalidade | null>(null)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0])
  const [pagando, setPagando] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; mensalidade: Mensalidade | null; isLoading: boolean }>({
    isOpen: false,
    mensalidade: null,
    isLoading: false,
  })
  const [gerando, setGerando] = useState(false)
  const [taxaDialogOpen, setTaxaDialogOpen] = useState(false)
  const [taxaMensalidade, setTaxaMensalidade] = useState<Mensalidade | null>(null)
  const [cobrarTaxa, setCobrarTaxa] = useState(false)
  const [taxaValor, setTaxaValor] = useState(0)
  const [salvandoTaxa, setSalvandoTaxa] = useState(false)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      invoke<Mensalidade[]>('get_mensalidades').catch(() => []),
      invoke<Aluno[]>('listar_alunos').catch(() => []),
    ])
      .then(([mens, alns]) => {
        setMensalidades(mens)
        setAlunos(alns)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function getAlunoNome(alunoId: number): string {
    const aluno = alunos.find((a) => a.id === alunoId)
    if (!aluno) return `Aluno #${alunoId}`
    return aluno.numero_matricula ? `${aluno.nome} (Mat. ${aluno.numero_matricula})` : aluno.nome
  }

  const filtered = mensalidades.filter((m) => {
    const matchMes = !mesFiltro || new Date(m.vencimento).getMonth() + 1 === parseInt(mesFiltro)
    const matchBusca = !busca || getAlunoNome(m.aluno_id).toLowerCase().includes(busca.toLowerCase())
    return matchMes && matchBusca
  })

  const handlePagamento = async () => {
    if (!selectedMensalidade || !formaPagamento) return
    setPagando(true)
    try {
      await invoke('pagar_mensalidade', {
        id: selectedMensalidade.id,
        dataPagamento,
        formaPagamento,
      })
      setMensalidades((prev) =>
        prev.map((m) =>
          m.id === selectedMensalidade.id
            ? { ...m, pago: 1, data_pagamento: dataPagamento, forma_pagamento: formaPagamento }
            : m
        )
      )
      setPagamentoOpen(false)
      setSelectedMensalidade(null)
      setFormaPagamento('')
    } catch (err) {
      console.error(err)
    } finally {
      setPagando(false)
    }
  }

  const openPagamento = (m: Mensalidade) => {
    setSelectedMensalidade(m)
    setFormaPagamento('')
    setDataPagamento(new Date().toISOString().split('T')[0])
    setPagamentoOpen(true)
  }

  const openTaxaDialog = (m: Mensalidade) => {
    setTaxaMensalidade(m)
    setCobrarTaxa((m.taxa_matricula ?? 0) > 0)
    setTaxaValor(m.taxa_matricula ?? 0)
    setTaxaDialogOpen(true)
  }

  const handleSalvarTaxa = async () => {
    if (!taxaMensalidade) return
    const novaTaxa = cobrarTaxa ? taxaValor : 0
    setSalvandoTaxa(true)
    try {
      await invoke('atualizar_taxa_matricula_mensalidade', {
        id: taxaMensalidade.id,
        taxa: novaTaxa,
      })
      setMensalidades((prev) =>
        prev.map((m) =>
          m.id === taxaMensalidade.id
            ? {
                ...m,
                valor: m.valor - (m.taxa_matricula ?? 0) + novaTaxa,
                taxa_matricula: novaTaxa,
              }
            : m
        )
      )
      setTaxaDialogOpen(false)
      setTaxaMensalidade(null)
      toast.addToast(cobrarTaxa ? 'Taxa de matrícula ativada com sucesso!' : 'Taxa de matrícula desativada.', 'success')
    } catch (error) {
      console.error('Erro ao atualizar taxa de matrícula:', error)
      toast.addToast('Erro ao atualizar taxa de matrícula. Tente novamente.', 'error')
    } finally {
      setSalvandoTaxa(false)
    }
  }

  const handleDeleteClick = (mensalidade: Mensalidade) => {
    setDeleteDialog({ isOpen: true, mensalidade, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.mensalidade) return
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_mensalidade', { id: deleteDialog.mensalidade!.id })
      setMensalidades((prev) => prev.filter((m) => m.id !== deleteDialog.mensalidade!.id))
      setDeleteDialog({ isOpen: false, mensalidade: null, isLoading: false })
      toast.addToast('Mensalidade deletada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao deletar mensalidade:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, mensalidade: null, isLoading: false })
  }

  const gerarMensalidadesDoMes = async () => {
    const ano = new Date().getFullYear()
    const mes = mesFiltro || String(new Date().getMonth() + 1)
    const mesReferencia = `${ano}-${mes.padStart(2, '0')}`
    setGerando(true)
    try {
      const ids = await invoke<number[]>('gerar_mensalidades_do_mes', { mesReferencia })
      const mensagens = await invoke<Mensalidade[]>('get_mensalidades').catch(() => [])
      setMensalidades(mensagens)
      if (ids.length > 0) {
        toast.addToast(`${ids.length} mensalidade${ids.length !== 1 ? 's' : ''} gerada${ids.length !== 1 ? 's' : ''} com sucesso!`, 'success')
      } else {
        toast.addToast('Nenhuma nova mensalidade foi gerada (todas já existem ou alunos sem valor definido).', 'info')
      }
    } catch (e) {
      toast.addToast(`Erro ao gerar mensalidades: ${e}`, 'error')
    } finally {
      setGerando(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        mensalidade={deleteDialog.mensalidade}
        alunoNome={deleteDialog.mensalidade ? getAlunoNome(deleteDialog.mensalidade.aluno_id) : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Mensalidades</h1>
          <p className="text-sm text-muted-foreground">Controle de mensalidades e pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push('/mensalidades/novo')}>
            <Plus className="mr-2 h-4 w-4" />Nova Mensalidade
          </Button>
          <Button variant="outline" onClick={gerarMensalidadesDoMes} disabled={gerando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${gerando ? 'animate-spin' : ''}`} />
            {gerando ? 'Gerando...' : 'Gerar Mensalidades do Mês'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input autoComplete="off"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Select value={mesFiltro} onValueChange={(value: string) => setMesFiltro(value)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por mês" /></SelectTrigger>
          <SelectContent>
            {meses.map((mes) => <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Todas as Mensalidades</CardTitle>
          <CardDescription>{filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhuma mensalidade encontrada"
              description="Nenhuma mensalidade corresponde aos filtros aplicados."
              action={
                <Button variant="outline" onClick={() => { setMesFiltro(''); setBusca('') }}>
                  Limpar Filtros
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold">{getAlunoNome(m.aluno_id)}</TableCell>
                    <TableCell>{new Date(m.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-bold">
                      {m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {m.taxa_matricula > 0 && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          inclui taxa de matrícula {m.taxa_matricula.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant[getStatus(m.vencimento, m.pago)]} className="font-bold">{statusLabel[getStatus(m.vencimento, m.pago)]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {m.pago === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPagamento(m)}
                          >
                            <DollarSign className="mr-1 h-3 w-3" />
                            Pagar
                          </Button>
                        )}
                        <button onClick={() => openTaxaDialog(m)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Taxa de Matrícula">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(m)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors" title="Deletar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={taxaDialogOpen} onOpenChange={setTaxaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taxa de Matrícula</DialogTitle>
            <DialogDescription>
              {taxaMensalidade && (
                <>
                  Aluno: <strong>{getAlunoNome(taxaMensalidade.aluno_id)}</strong>
                  <br />
                  Vencimento: <strong>{new Date(taxaMensalidade.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cobrarTaxa}
                onChange={(e) => setCobrarTaxa(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Cobrar taxa de matrícula nesta mensalidade
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor da Taxa (R$)</label>
              <CurrencyInput
                value={taxaValor}
                onChange={setTaxaValor}
                disabled={!cobrarTaxa}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaxaDialogOpen(false)} disabled={salvandoTaxa}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarTaxa} disabled={salvandoTaxa}>
              {salvandoTaxa ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagamentoOpen} onOpenChange={setPagamentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedMensalidade && (
                <>
                  Aluno: <strong>{getAlunoNome(selectedMensalidade.aluno_id)}</strong>
                  <br />
                  Valor: <strong>{selectedMensalidade.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                  <br />
                  {selectedMensalidade.taxa_matricula > 0 && (
                    <>
                      Inclui taxa de matrícula de{' '}
                      <strong>{selectedMensalidade.taxa_matricula.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      <br />
                    </>
                  )}
                   Vencimento: <strong>{new Date(selectedMensalidade.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data do Pagamento</label>
              <input autoComplete="off"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((fp) => (
                    <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagamentoOpen(false)}>Cancelar</Button>
            <Button onClick={handlePagamento} disabled={pagando || !formaPagamento}>
              {pagando ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

