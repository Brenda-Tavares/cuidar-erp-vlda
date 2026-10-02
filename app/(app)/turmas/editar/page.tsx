'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { AlertCircle } from 'lucide-react'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const turmaSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  turno: z.string().min(1, 'Selecione um turno'),
  vagas: z.coerce.number().min(1, 'Informe o número de vagas'),
  ano: z.coerce.number().optional(),
  status: z.enum(['ativa', 'inativa']),
})

type TurmaForm = z.infer<typeof turmaSchema>

const TURNOS = ['Manhã', 'Tarde', 'Integral']

function EditarTurmaContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const [loading, setLoading] = useState(true)
  const [responsaveis, setResponsaveis] = useState<string[]>([''])
  const [submitError, setSubmitError] = useState('')
  const toast = useToast()
  const [anoOriginal, setAnoOriginal] = useState<number | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TurmaForm>({
    resolver: zodResolver(turmaSchema),
    defaultValues: { nome: '', turno: '', vagas: 20, ano: new Date().getFullYear(), status: 'ativa' },
  })

  useEffect(() => {
    invoke<{ id: number; nome: string; ano: number | null; turno: string | null; vagas: number | null; status: string | null; responsaveis: string | null } | null>('get_turma_by_id', { id: parseInt(id) })
      .then((turma) => {
        if (turma) {
          setAnoOriginal(turma.ano)
          reset({
            nome: turma.nome,
            turno: turma.turno ?? '',
            vagas: turma.vagas ?? 20,
            ano: turma.ano ?? new Date().getFullYear(),
            status: (turma.status as 'ativa' | 'inativa') ?? 'ativa',
          })
          if (turma.responsaveis) {
            const parsed = JSON.parse(turma.responsaveis) as string[]
            setResponsaveis(parsed.length > 0 ? parsed : [''])
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, reset])

  const addResponsavel = () => setResponsaveis((prev) => [...prev, ''])
  const removeResponsavel = (index: number) => setResponsaveis((prev) => prev.filter((_, i) => i !== index))
  const updateResponsavel = (index: number, value: string) => setResponsaveis((prev) => prev.map((r, i) => (i === index ? value : r)))

  const onSubmit = async (data: TurmaForm) => {
    setSubmitError('')
    try {
      const responsaveisFiltrados = responsaveis.filter((r) => r.trim() !== '')
      await invoke('update_turma', {
        turma: {
          id: parseInt(id),
          nome: data.nome.trim(),
          ano: data.ano || null,
          turno: data.turno,
          vagas: data.vagas,
          status: data.status,
          responsaveis: JSON.stringify(responsaveisFiltrados),
        },
      })
      toast.addToast('Turma atualizada com sucesso!', 'success')
      router.push('/turmas')
    } catch (e) {
      setSubmitError(String(e))
      toast.addToast(String(e), 'error')
    }
  }

  if (loading) {
    return <div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />Voltar
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Turma</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Turma *</label>
            <input autoComplete="off" {...register('nome')} className={errors.nome ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="Ex: maternal A" />
            {errors.nome && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.nome.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano Letivo</label>
            <input type="number" {...register('ano')} className={INPUT_CLASS} min={2020} max={2099} />
            {errors.ano && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.ano.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Turno *</label>
            <select {...register('turno')} className={INPUT_CLASS}>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.turno && <p className="mt-1 text-sm text-red-600">{errors.turno.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vagas *</label>
            <input type="number" {...register('vagas')} className={INPUT_CLASS} min={1} />
            {errors.vagas && <p className="mt-1 text-sm text-red-600">{errors.vagas.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select {...register('status')} className={INPUT_CLASS}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsaveis da Turma</label>
            <div className="space-y-2">
              {responsaveis.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={r}
                    autoComplete="off"
                    onChange={(e) => updateResponsavel(i, e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Nome do responsavel"
                  />
                  {responsaveis.length > 1 && (
                    <button type="button" onClick={() => removeResponsavel(i)} className="p-2 text-red-500 hover:text-red-700">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addResponsavel} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
                <Plus className="h-3 w-3" />Adicionar responsavel
              </button>
            </div>
          </div>
        </div>
        {submitError && (
          <p className="text-sm text-red-600 text-center">{submitError}</p>
        )}
        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting || Object.keys(errors).length > 0} className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors">
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function EditarTurmaPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>}>
      <EditarTurmaContent />
    </Suspense>
  )
}
