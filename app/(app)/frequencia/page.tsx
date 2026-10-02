'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, XCircle, Calendar, Save, Trash2, Pencil } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import JustificativaFaltaSelector from '@/components/frequencia/JustificativaFaltaSelector'
import CalendarioPicker from '@/components/frequencia/CalendarioPicker'

interface Turma {
  id: number
  nome: string
  ano: number | null
  turno: string | null
  status: string | null
  responsaveis: string | null
}

interface Aluno {
  id: number
  nome: string
  data_nascimento: string
  nome_responsavel: string
  telefone_responsavel: string
  status: string
  turma_id: number | null
}

interface FrequenciaRegistro {
  id: number
  turma_id: number
  data: string
  registros: string
}

interface RegistroAluno {
  alunoId: number
  presente: boolean
  tipoJustificativa?: string
  justificativa?: string
}

function DeleteConfirmDialog({ isOpen, data, onConfirm, onCancel, isLoading }: {
  isOpen: boolean; data: string; onConfirm: () => void; onCancel: () => void; isLoading: boolean
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm mx-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Deletar Registro de Frequência?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Tem certeza que deseja deletar o registro de frequência de <strong>{data}</strong>? Esta ação não poderá ser desfeita.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {isLoading ? (
              <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Deletando...</>
            ) : (
              <><Trash2 className="h-4 w-4" /> Deletar</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDateBR(dateStr: string): string {
  try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR') } catch { return dateStr }
}

export default function FrequenciaPage() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [turmaSelecionada, setTurmaSelecionada] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0])
  const [presencas, setPresencas] = useState<Record<number, boolean>>({})
  const [tipoJustificativa, setTipoJustificativa] = useState<Record<number, string>>({})
  const [textoJustificativa, setTextoJustificativa] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState<FrequenciaRegistro[]>([])
  const [salvo, setSalvo] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, registroId: null as number | null, data: '', isLoading: false })
  const [salvandoAluno, setSalvandoAluno] = useState<number | null>(null)
  const toast = useToast()

  useEffect(() => {
    invoke<Turma[]>('get_turmas')
      .then(setTurmas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!turmaSelecionada) {
      setAlunos([]); setPresencas({}); setTipoJustificativa({}); setTextoJustificativa({})
      return
    }
    const tid = parseInt(turmaSelecionada)
    Promise.all([
      invoke<Aluno[]>('get_alunos_by_turma', { turmaId: tid }).catch(() => []),
      invoke<FrequenciaRegistro | null>('get_frequencia_por_turma_data', { turmaId: tid, data: dataSelecionada }).catch(() => null),
      invoke<FrequenciaRegistro[]>('get_frequencia_historico', { turmaId: tid }).catch(() => []),
    ])
      .then(([alns, existente, hist]) => {
        setAlunos(alns)
        setHistorico(hist)
        const presMap: Record<number, boolean> = {}
        const tipoMap: Record<number, string> = {}
        const textoMap: Record<number, string> = {}
        if (existente) {
          const regs = JSON.parse(existente.registros) as RegistroAluno[]
          regs.forEach((r) => {
            presMap[r.alunoId] = r.presente
            if (!r.presente) {
              if (r.tipoJustificativa) tipoMap[r.alunoId] = r.tipoJustificativa
              if (r.justificativa) textoMap[r.alunoId] = r.justificativa
            }
          })
        } else {
          alns.forEach((a) => { presMap[a.id] = true })
        }
        setPresencas(presMap)
        setTipoJustificativa(tipoMap)
        setTextoJustificativa(textoMap)
        setSalvo(false)
      })
      .catch(console.error)
  }, [turmaSelecionada, dataSelecionada])

  const togglePresenca = (alunoId: number) => {
    setPresencas((prev) => {
      const novo = !prev[alunoId]
      if (novo) {
        setTipoJustificativa((t) => { const n = { ...t }; delete n[alunoId]; return n })
        setTextoJustificativa((t) => { const n = { ...t }; delete n[alunoId]; return n })
      }
      return { ...prev, [alunoId]: novo }
    })
  }

  const marcarTodos = (presente: boolean) => {
    const presMap: Record<number, boolean> = {}
    alunos.forEach((a) => { presMap[a.id] = presente })
    setPresencas(presMap)
    if (presente) {
      setTipoJustificativa({})
      setTextoJustificativa({})
    }
  }

  const handleTipoJustificativaChange = (alunoId: number, value: string) => {
    setTipoJustificativa((prev) => ({ ...prev, [alunoId]: value }))
    if (value !== 'outros') {
      setTextoJustificativa((prev) => ({ ...prev, [alunoId]: '' }))
    }
  }

  const salvar = async () => {
    if (!turmaSelecionada) return

    const registros: RegistroAluno[] = alunos.map((a) => {
      const presente = presencas[a.id] ?? true
      const reg: RegistroAluno = { alunoId: a.id, presente }
      if (!presente) {
        reg.tipoJustificativa = tipoJustificativa[a.id] || ''
        reg.justificativa = tipoJustificativa[a.id] === 'outros' ? (textoJustificativa[a.id] || '') : ''
        if (tipoJustificativa[a.id] === 'outros' && !textoJustificativa[a.id]) {
          throw new Error(`Descreva o motivo da falta para ${a.nome}`)
        }
      }
      return reg
    })

    setSalvando(true)
    try {
      await invoke('salvar_frequencia_turma', {
        turmaId: parseInt(turmaSelecionada),
        data: dataSelecionada,
        registros: JSON.stringify(registros),
      })
      setSalvo(true)
      toast.addToast('Frequência salva com sucesso!', 'success')
      setTimeout(() => setSalvo(false), 3000)
      const hist = await invoke<FrequenciaRegistro[]>('get_frequencia_historico', { turmaId: parseInt(turmaSelecionada) })
      setHistorico(hist)
    } catch (err: unknown) {
      toast.addToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setSalvando(false)
    }
  }

  const presentes = Object.values(presencas).filter(Boolean).length
  const ausentes = Object.values(presencas).filter((v) => !v).length

  const salvarAluno = async (alunoId: number) => {
    const aluno = alunos.find((a) => a.id === alunoId)
    if (!aluno) return
    const presente = presencas[alunoId] ?? true
    const reg: RegistroAluno = { alunoId, presente }
    if (!presente) {
      reg.tipoJustificativa = tipoJustificativa[alunoId] || ''
      reg.justificativa = tipoJustificativa[alunoId] === 'outros' ? (textoJustificativa[alunoId] || '') : ''
      if (tipoJustificativa[alunoId] === 'outros' && !textoJustificativa[alunoId]) {
        toast.addToast(`Descreva o motivo da falta para ${aluno.nome}`, 'error')
        return
      }
    }

    setSalvandoAluno(alunoId)
    try {
      const existente = await invoke<FrequenciaRegistro | null>('get_frequencia_por_turma_data', {
        turmaId: parseInt(turmaSelecionada),
        data: dataSelecionada,
      }).catch(() => null)

      let registros: RegistroAluno[]
      if (existente) {
        registros = JSON.parse(existente.registros) as RegistroAluno[]
        const idx = registros.findIndex((r) => r.alunoId === alunoId)
        if (idx >= 0) registros[idx] = reg
        else registros.push(reg)
      } else {
        registros = alunos.map((a) => {
          const pr = presencas[a.id] ?? true
          const r: RegistroAluno = { alunoId: a.id, presente: pr }
          if (!pr) {
            r.tipoJustificativa = tipoJustificativa[a.id] || ''
            r.justificativa = tipoJustificativa[a.id] === 'outros' ? (textoJustificativa[a.id] || '') : ''
          }
          return r
        })
        const idx = registros.findIndex((r) => r.alunoId === alunoId)
        if (idx >= 0) registros[idx] = reg
      }

      await invoke('salvar_frequencia_turma', {
        turmaId: parseInt(turmaSelecionada),
        data: dataSelecionada,
        registros: JSON.stringify(registros),
      })
      toast.addToast(`Frequência de ${aluno.nome} salva com sucesso!`, 'success')
      const hist = await invoke<FrequenciaRegistro[]>('get_frequencia_historico', { turmaId: parseInt(turmaSelecionada) })
      setHistorico(hist)
    } catch (err: unknown) {
      toast.addToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setSalvandoAluno(null)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        data={deleteDialog.data}
        onConfirm={async () => {
          if (!deleteDialog.registroId) return
          setDeleteDialog((p) => ({ ...p, isLoading: true }))
          try {
            await invoke('delete_frequencia_registro', { id: deleteDialog.registroId })
            setHistorico((p) => p.filter((h) => h.id !== deleteDialog.registroId))
            setDeleteDialog({ isOpen: false, registroId: null, data: '', isLoading: false })
            toast.addToast('Registro deletado', 'success')
          } catch {
            toast.addToast('Erro ao deletar', 'error')
            setDeleteDialog((p) => ({ ...p, isLoading: false }))
          }
        }}
        onCancel={() => setDeleteDialog({ isOpen: false, registroId: null, data: '', isLoading: false })}
        isLoading={deleteDialog.isLoading}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Frequência</h1>
        <p className="text-sm text-muted-foreground">Registre a presença dos alunos por turma e data</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={turmaSelecionada} onValueChange={setTurmaSelecionada}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
          <SelectContent>
            {turmas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <CalendarioPicker
            mode="date"
            value={new Date(dataSelecionada + 'T00:00:00')}
            onChange={(d) => setDataSelecionada(d.toISOString().split('T')[0])}
          />
        </div>
      </div>

      {turmaSelecionada && dataSelecionada && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${historico.some((h) => h.data === dataSelecionada) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700' : 'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'}`}>
          <Pencil className={`h-4 w-4 ${historico.some((h) => h.data === dataSelecionada) ? 'text-indigo-600 dark:text-indigo-300' : 'text-amber-600 dark:text-amber-300'}`} />
          <p className={`text-sm font-medium ${historico.some((h) => h.data === dataSelecionada) ? 'text-indigo-700 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {historico.some((h) => h.data === dataSelecionada)
              ? `Editando frequência de ${formatDateBR(dataSelecionada)}`
              : `Nova frequência para ${formatDateBR(dataSelecionada)}`}
          </p>
        </div>
      )}

      {!turmaSelecionada && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Selecione uma turma para registrar frequência</p></CardContent></Card>
      )}

      {turmaSelecionada && alunos.length === 0 && (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhum aluno vinculado a esta turma</p></CardContent></Card>
      )}

      {turmaSelecionada && alunos.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="default">{presentes} presentes</Badge>
              <Badge variant="secondary">{ausentes} ausentes</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => marcarTodos(true)}>Todos Presentes</Button>
              <Button variant="outline" size="sm" onClick={() => marcarTodos(false)}>Todos Ausentes</Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Lista de Presença</CardTitle>
              <CardDescription>Clique para alternar entre presente e ausente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alunos.map((aluno) => (
                  <div key={aluno.id}>
                    <div
                      onClick={() => togglePresenca(aluno.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                        presencas[aluno.id] ? 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700 dark:hover:bg-green-900/30' : 'bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-700 dark:hover:bg-red-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {presencas[aluno.id] ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{aluno.nome}</p>
                          <p className="text-xs text-muted-foreground">{aluno.nome_responsavel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={presencas[aluno.id] ? 'default' : 'destructive'}>
                          {presencas[aluno.id] ? 'Presente' : 'Ausente'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); salvarAluno(aluno.id) }}
                          disabled={salvandoAluno !== null}
                          title={`Salvar frequência de ${aluno.nome} para esta data`}
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          {salvandoAluno === aluno.id ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                    {!presencas[aluno.id] && (
                      <div className="ml-9 mt-1 mb-2">
                        <JustificativaFaltaSelector
                          tipoJustificativa={tipoJustificativa[aluno.id] || ''}
                          justificativaTexto={textoJustificativa[aluno.id] || ''}
                          onTipoChange={(v) => handleTipoJustificativaChange(aluno.id, v)}
                          onTextoChange={(v) => setTextoJustificativa((p) => ({ ...p, [aluno.id]: v }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={salvar} disabled={salvando}>
              <Save className="mr-2 h-4 w-4" />
              {salvando ? 'Salvando...' : 'Salvar Frequência'}
            </Button>
            {salvo && <span className="text-sm text-green-600 dark:text-green-400">Frequência salva com sucesso!</span>}
          </div>

          {historico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
                <CardDescription>{historico.length} registro(s) de frequência — clique em um registro para editá-lo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {historico.map((h) => {
                    const regs = JSON.parse(h.registros) as RegistroAluno[]
                    const p = regs.filter((r) => r.presente).length
                    const ativo = h.data === dataSelecionada
                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          setDataSelecionada(h.data)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                          toast.addToast(`Editando frequência de ${formatDateBR(h.data)}`, 'info')
                        }}
                        className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                          ativo
                            ? 'bg-indigo-50 border-indigo-300 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-700 dark:hover:bg-indigo-900/40'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                        title="Clique para editar este registro"
                      >
                        <div className="flex items-center gap-2">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{formatDateBR(h.data)}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Badge variant="default">{p} presentes</Badge>
                          <Badge variant="secondary">{regs.length - p} ausentes</Badge>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteDialog({ isOpen: true, registroId: h.id, data: h.data, isLoading: false }) }}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors ml-2"
                            title="Deletar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

