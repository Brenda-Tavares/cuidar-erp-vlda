'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Calendar, Save, AlertTriangle } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import JustificativaFaltaSelector from '@/components/frequencia/JustificativaFaltaSelector'
import CalendarioPicker from '@/components/frequencia/CalendarioPicker'

interface Funcionario {
  id: number
  nome_completo: string
  nome_social?: string
  cpf?: string
  telefone: string
  email: string
  salario: number
  cargo_id: number
  cargo_nome?: string
  escala_trabalho_id?: number
  status?: string
}

interface FrequenciaFuncionario {
  id?: number
  funcionario_id: number
  data: string
  status: string
  justificativa?: string
  tipo_justificativa?: string
}

export default function FrequenciaFuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0])
  const [presencas, setPresencas] = useState<Record<number, boolean>>({})
  const [tipoJustificativa, setTipoJustificativa] = useState<Record<number, string>>({})
  const [textoJustificativa, setTextoJustificativa] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const funcs = await invoke<Funcionario[]>('listar_funcionarios')
      const ativos = (funcs || []).filter((f) => f.status !== 'inativo')
      setFuncionarios(ativos)
    } catch {
      toast.addToast('Erro ao carregar funcionários', 'error')
      setLoading(false)
      return
    }

    try {
      const records = await invoke<FrequenciaFuncionario[]>('listar_frequencia_funcionarios_por_data', { data: dataSelecionada })
      const presMap: Record<number, boolean> = {}
      const tipoMap: Record<number, string> = {}
      const textoMap: Record<number, string> = {}
      ;(records || []).forEach((r) => {
        presMap[r.funcionario_id] = r.status === 'presente'
        if (r.status !== 'presente') {
          if (r.tipo_justificativa) tipoMap[r.funcionario_id] = r.tipo_justificativa
          if (r.justificativa) textoMap[r.funcionario_id] = r.justificativa
        }
      })
      setPresencas(presMap)
      setTipoJustificativa(tipoMap)
      setTextoJustificativa(textoMap)
    } catch (err: unknown) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [dataSelecionada])

  const togglePresenca = (funcionarioId: number) => {
    setPresencas((prev) => {
      const novo = !prev[funcionarioId]
      if (novo) {
        setTipoJustificativa((t) => { const n = { ...t }; delete n[funcionarioId]; return n })
        setTextoJustificativa((t) => { const n = { ...t }; delete n[funcionarioId]; return n })
      }
      return { ...prev, [funcionarioId]: novo }
    })
  }

  const handleTipoJustificativaChange = (funcionarioId: number, value: string) => {
    setTipoJustificativa((prev) => ({ ...prev, [funcionarioId]: value }))
    if (value !== 'outros') {
      setTextoJustificativa((prev) => ({ ...prev, [funcionarioId]: '' }))
    }
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      for (const func of funcionarios) {
        const presente = presencas[func.id] ?? true
        if (!presente && tipoJustificativa[func.id] === 'outros' && !textoJustificativa[func.id]) {
          toast.addToast(`Descreva o motivo da falta para ${func.nome_completo}`, 'error')
          setSalvando(false)
          return
        }
        const payload: FrequenciaFuncionario = {
          funcionario_id: func.id,
          data: dataSelecionada,
          status: presente ? 'presente' : 'ausente',
          tipo_justificativa: presente ? '' : (tipoJustificativa[func.id] || ''),
          justificativa: presente ? '' : (tipoJustificativa[func.id] === 'outros' ? (textoJustificativa[func.id] || '') : ''),
        }
        await invoke('salvar_frequencia_funcionario', { f: payload })
      }
      toast.addToast('Frequência salva com sucesso!', 'success')
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } catch (err: any) {
      toast.addToast(typeof err === 'string' ? err : (err.message || 'Erro ao salvar'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  const presentes = Object.values(presencas).filter(Boolean).length
  const ausentes = Object.values(presencas).filter((v) => !v).length

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Frequência — Funcionários</h1>
        <p className="text-sm text-muted-foreground">Registre a presença dos funcionários por data</p>
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <CalendarioPicker
          mode="date"
          value={new Date(dataSelecionada + 'T00:00:00')}
          onChange={(d) => setDataSelecionada(d.toISOString().split('T')[0])}
        />
      </div>

      {funcionarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum funcionário ativo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="default">{presentes} presentes</Badge>
              <Badge variant="secondary">{ausentes} ausentes</Badge>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Lista de Presença</CardTitle>
              <CardDescription>Clique para alternar entre presente e ausente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funcionarios.map((func) => {
                  const presente = presencas[func.id] ?? true
                  return (
                    <div key={func.id}>
                      <div
                        onClick={() => togglePresenca(func.id)}
                        className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                          presente ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-red-50 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {presente ? (
                            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{func.nome_completo}</p>
                            <p className="text-xs text-muted-foreground">{func.cargo_nome || '—'}</p>
                          </div>
                        </div>
                        <Badge variant={presente ? 'default' : 'destructive'}>
                          {presente ? 'Presente' : 'Ausente'}
                        </Badge>
                      </div>
                      {!presente && (
                        <div className="ml-9 mt-1 mb-2">
                          <JustificativaFaltaSelector
                            tipoJustificativa={tipoJustificativa[func.id] || ''}
                            justificativaTexto={textoJustificativa[func.id] || ''}
                            onTipoChange={(v) => handleTipoJustificativaChange(func.id, v)}
                            onTextoChange={(v) => setTextoJustificativa((p) => ({ ...p, [func.id]: v }))}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={salvar} disabled={salvando}>
              <Save className="mr-2 h-4 w-4" />
              {salvando ? 'Salvando...' : 'Salvar Frequência'}
            </Button>
            {salvo && <span className="text-sm text-green-600">Frequência salva com sucesso!</span>}
          </div>
        </>
      )}
    </div>
  )
}

