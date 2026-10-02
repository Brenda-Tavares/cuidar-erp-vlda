'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { IMaskInput } from 'react-imask'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { parseCurrency } from '@/lib/utils/currency'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { useToast } from '@/lib/context/ToastContext'
import {
  validateName,
  validateDateOfBirth,
  validatePhone,
} from '@/lib/utils/validation'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const alunoSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .refine((val) => val.trim().split(/\s+/).length >= 2, {
      message: 'Nome deve ter no mínimo 2 palavras',
    }),
  data_nascimento: z.string().min(1, 'Data de nascimento é obrigatória'),
  nome_responsavel: z.string()
    .min(3, 'Nome do responsável deve ter pelo menos 3 caracteres')
    .refine((val) => val.trim().split(/\s+/).length >= 2, {
      message: 'Nome do responsável deve ter no mínimo 2 palavras',
    }),
  telefone_responsavel: z.string().min(1, 'Telefone é obrigatório'),
  telefone_responsavel_2: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
  turma_id: z.coerce.number().nullable(),
  valor_mensalidade_override: z.number().optional().nullable(),
  dia_vencimento: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(31, 'Dia de vencimento deve estar entre 1 e 31').nullable()
  ),
})

type AlunoForm = z.infer<typeof alunoSchema>

interface Turma { id: number; nome: string }
interface Servico { id: number; nome: string; descricao?: string; valor_padrao: number; status?: string }

interface ServicoSelecionado {
  servico_id: number
  nome: string
  valor_acordado: number
  jaVinculado: boolean
}

interface FieldError {
  [key: string]: string | undefined
}

function EditarAlunoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const [loading, setLoading] = useState(true)
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [servicosDisponiveis, setServicosDisponiveis] = useState<Servico[]>([])
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoSelecionado[]>([])
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [numeroMatricula, setNumeroMatricula] = useState('')
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<AlunoForm>({
    resolver: zodResolver(alunoSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: '',
      data_nascimento: '',
      nome_responsavel: '',
      telefone_responsavel: '',
      telefone_responsavel_2: '',
      status: 'ativo',
      turma_id: null,
      valor_mensalidade_override: null,
      dia_vencimento: null,
    },
  })

  const formValues = watch()

  useEffect(() => {
    const alunoId = parseInt(id)
    Promise.all([
      invoke<Turma[]>('get_turmas').catch(() => []),
      invoke<Array<{ id: number; nome: string; data_nascimento: string; nome_responsavel: string; telefone_responsavel: string; telefone_responsavel_2?: string; status: string; turma_id: number | null; dia_vencimento?: number | null }>>('listar_alunos').catch(() => []),
      invoke<Servico[]>('listar_servicos', { tipo: 'creche' }).catch(() => []),
      invoke<Array<{ id: number; servico_id: number; nome_servico: string; valor_acordado: number }>>('get_servicos_do_aluno', { alunoId }).catch(() => []),
    ])
      .then(([trms, alunos, servicos, servicosAluno]) => {
        setTurmas(trms)
        setServicosDisponiveis((servicos || []).filter((sv) => sv.status !== 'inativo'))
        const selecionados: ServicoSelecionado[] = (servicosAluno || []).map((sa) => ({
          servico_id: sa.servico_id,
          nome: sa.nome_servico,
          valor_acordado: sa.valor_acordado,
          jaVinculado: true,
        }))
        setServicosSelecionados(selecionados)
        const aluno = alunos.find((a) => a.id === alunoId)
        if (aluno) {
          setNumeroMatricula((aluno as any).numero_matricula ?? '')
          reset({
            nome: aluno.nome,
            data_nascimento: aluno.data_nascimento,
            nome_responsavel: aluno.nome_responsavel,
            telefone_responsavel: aluno.telefone_responsavel,
            status: aluno.status as 'ativo' | 'inativo',
            turma_id: aluno.turma_id,
            valor_mensalidade_override: (aluno as any).valor_mensalidade_override ?? null,
            dia_vencimento: aluno.dia_vencimento ?? null,
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, reset])

  const handleFieldBlur = (fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName))
    validateField(fieldName)
  }

  const validateField = (fieldName: string) => {
    const value = formValues[fieldName as keyof AlunoForm]
    const newErrors = { ...fieldErrors }
    
    switch (fieldName) {
      case 'nome':
        if (value) {
          const result = validateName(String(value))
          newErrors.nome = result.isValid ? undefined : result.error
        }
        break
      case 'data_nascimento':
        if (value) {
          const result = validateDateOfBirth(String(value))
          newErrors.data_nascimento = result.isValid ? undefined : result.error
        }
        break
      case 'nome_responsavel':
        if (value) {
          const result = validateName(String(value))
          newErrors.nome_responsavel = result.isValid ? undefined : result.error
        }
        break
      case 'telefone_responsavel':
        if (value) {
          const result = validatePhone(String(value))
          newErrors.telefone_responsavel = result.isValid ? undefined : result.error
        }
        break
      case 'telefone_responsavel_2':
        if (value && String(value).trim()) {
          const result = validatePhone(String(value))
          newErrors.telefone_responsavel_2 = result.isValid ? undefined : result.error
        } else {
          newErrors.telefone_responsavel_2 = undefined
        }
        break
    }
    
    setFieldErrors(newErrors)
  }

  const hasFormErrors = Object.values(fieldErrors).some((err) => err !== undefined)
  const hasRequiredFields = formValues.nome && formValues.data_nascimento && 
    formValues.nome_responsavel && formValues.telefone_responsavel

  const onSubmit = async (data: AlunoForm) => {
    setSubmitError('')
    const alunoId = parseInt(id)
    try {
      await invoke('update_aluno', {
        aluno: {
          id: alunoId,
          nome: data.nome,
          data_nascimento: data.data_nascimento,
          nome_responsavel: data.nome_responsavel,
          telefone_responsavel: data.telefone_responsavel,
          telefone_responsavel_2: data.telefone_responsavel_2 || null,
          status: data.status,
          turma_id: data.turma_id,
          valor_mensalidade_override: data.valor_mensalidade_override ?? null,
          dia_vencimento: data.dia_vencimento ?? null,
        },
      })
      for (const sv of servicosSelecionados) {
        if (sv.jaVinculado) {
          await invoke('update_valor_acordado_servico', { alunoId, servicoId: sv.servico_id, valorAcordado: sv.valor_acordado })
        } else {
          await invoke('vincular_servico_aluno', {
            alunoId,
            servicoId: sv.servico_id,
            valorAcordado: sv.valor_acordado,
            dataInicio: new Date().toISOString().split('T')[0],
          })
        }
      }
      const idsSelecionados = new Set(servicosSelecionados.map((s) => s.servico_id))
      const idsVinculados = await invoke<Array<{ servico_id: number }>>('get_servicos_do_aluno', { alunoId })
      for (const v of idsVinculados) {
        if (!idsSelecionados.has(v.servico_id)) {
          await invoke('desvincular_servico_aluno', { alunoId, servicoId: v.servico_id })
        }
      }
      toast.addToast('Aluno atualizado com sucesso!', 'success')
      router.push('/alunos')
    } catch (e) {
      setSubmitError(String(e))
    }
  }

  const toggleServico = (servico: Servico) => {
    setServicosSelecionados((prev) => {
      const exists = prev.find((s) => s.servico_id === servico.id)
      if (exists) return prev.filter((s) => s.servico_id !== servico.id)
      return [...prev, { servico_id: servico.id, nome: servico.nome, valor_acordado: servico.valor_padrao, jaVinculado: false }]
    })
  }

  const updateValorAcordado = (servicoId: number, valor: number) => {
    setServicosSelecionados((prev) => prev.map((s) => s.servico_id === servicoId ? { ...s, valor_acordado: valor } : s))
  }

  if (loading) {
    return <div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />Voltar
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Aluno</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="numero_matricula" className="block text-sm font-medium text-gray-700 mb-1">Número de Matrícula</label>
            <input
              id="numero_matricula"
              type="text"
              autoComplete="off"
              disabled
              value={numeroMatricula || '—'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">Matrícula automática e sequencial, não pode ser editada.</p>
          </div>

          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Nome do Aluno *</label>
            <input
              id="nome"
              type="text"
              autoComplete="off"
              {...register('nome')}
              onBlur={() => handleFieldBlur('nome')}
              className={touched.has('nome') && fieldErrors.nome ? INPUT_ERROR_CLASS : INPUT_CLASS}
              placeholder="Nome completo"
            />
            {(touched.has('nome') && fieldErrors.nome) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.nome}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="data_nascimento" className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
            <input
              id="data_nascimento"
              type="date"
              {...register('data_nascimento')}
              onBlur={() => handleFieldBlur('data_nascimento')}
              className={touched.has('data_nascimento') && fieldErrors.data_nascimento ? INPUT_ERROR_CLASS : INPUT_CLASS}
            />
            {(touched.has('data_nascimento') && fieldErrors.data_nascimento) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.data_nascimento}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="turma_id" className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
            <select
              id="turma_id"
              {...register('turma_id')}
              className={INPUT_CLASS}
              onBlur={() => handleFieldBlur('turma_id')}
            >
              <option value="">Sem turma</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="dia_vencimento" className="block text-sm font-medium text-gray-700 mb-1">Dia de Vencimento</label>
            <select
              id="dia_vencimento"
              {...register('dia_vencimento')}
              className={INPUT_CLASS}
            >
              <option value="">Padrão da instituição</option>
              {[...Array(31)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Opcional — usado nas mensalidades deste aluno. Em branco, usa o dia configurado na instituição.</p>
          </div>

          <div>
            <label htmlFor="nome_responsavel" className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsavel *</label>
            <input
              id="nome_responsavel"
              type="text"
              autoComplete="off"
              {...register('nome_responsavel')}
              onBlur={() => handleFieldBlur('nome_responsavel')}
              className={touched.has('nome_responsavel') && fieldErrors.nome_responsavel ? INPUT_ERROR_CLASS : INPUT_CLASS}
              placeholder="Nome completo do responsavel"
            />
            {(touched.has('nome_responsavel') && fieldErrors.nome_responsavel) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.nome_responsavel}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone_responsavel" className="block text-sm font-medium text-gray-700 mb-1">Telefone do Responsavel *</label>
            <Controller
              name="telefone_responsavel"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  mask="(00) 00000-0000"
                  value={field.value}
                  onAccept={(value) => field.onChange(value)}
                  onBlur={() => {
                    field.onBlur()
                    handleFieldBlur('telefone_responsavel')
                  }}
                  inputRef={field.ref}
                  className={touched.has('telefone_responsavel') && fieldErrors.telefone_responsavel ? INPUT_ERROR_CLASS : INPUT_CLASS}
                  placeholder="(00) 00000-0000"
                />
              )}
            />
            {(touched.has('telefone_responsavel') && fieldErrors.telefone_responsavel) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.telefone_responsavel}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone_responsavel_2" className="block text-sm font-medium text-gray-700 mb-1">Telefone Alternativo (opcional)</label>
            <Controller
              name="telefone_responsavel_2"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  mask="(00) 00000-0000"
                  value={field.value}
                  onAccept={(value) => field.onChange(value)}
                  onBlur={() => {
                    field.onBlur()
                    handleFieldBlur('telefone_responsavel_2')
                  }}
                  inputRef={field.ref}
                  className={touched.has('telefone_responsavel_2') && fieldErrors.telefone_responsavel_2 ? INPUT_ERROR_CLASS : INPUT_CLASS}
                  placeholder="(00) 00000-0000"
                />
              )}
            />
            {(touched.has('telefone_responsavel_2') && fieldErrors.telefone_responsavel_2) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.telefone_responsavel_2}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Mensalidade (Opcional)</label>
            <Controller
              name="valor_mensalidade_override"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v || null)}
                  placeholder="0,00"
                  className={INPUT_CLASS}
                />
              )}
            />
            <p className="mt-1 text-xs text-gray-500">Deixe em branco para cálculo automático (soma de serviços ou valor padrão da instituição).</p>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="status" {...register('status')} className={INPUT_CLASS}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        {/* Serviços Prestados */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Serviços Prestados (opcional)</h2>
            <p className="text-sm text-gray-500 mb-3">Selecione os serviços que este aluno utiliza</p>
            {servicosDisponiveis.length === 0 ? (
              <p className="text-sm text-amber-600">Nenhum serviço ativo disponível. Crie serviços em Configurações → Serviços.</p>
            ) : (
              <div className="space-y-2">
                {servicosDisponiveis.map((sv) => {
                  const selecionado = servicosSelecionados.find((s) => s.servico_id === sv.id)
                  return (
                    <div key={sv.id} className={`rounded-lg border p-3 transition-colors ${selecionado ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={!!selecionado}
                            onChange={() => toggleServico(sv)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{sv.nome}</p>
                            {sv.descricao && <p className="text-xs text-gray-500">{sv.descricao}</p>}
                          </div>
                        </label>
                        {selecionado && (
                          <div className="flex items-center gap-2 ml-4">
                            <label className="text-xs text-gray-500">Valor:</label>
                            <CurrencyInput
                              value={selecionado.valor_acordado ?? 0}
                              onChange={(v) => updateValorAcordado(sv.id, v)}
                              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                              placeholder="0,00"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {servicosSelecionados.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Nenhum serviço adicional selecionado.</p>
            )}
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 text-center">{submitError}</p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || hasFormErrors || !hasRequiredFields}
            className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

export default function EditarAlunoPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>}>
      <EditarAlunoContent />
    </Suspense>
  )
}
