'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { ArrowLeft, Plus, X, Search } from 'lucide-react'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const turmaSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  turno: z.string().min(1, 'Selecione um turno'),
  vagas: z.coerce.number().min(1, 'Informe o número de vagas'),
})

type TurmaForm = z.infer<typeof turmaSchema>

const TURNOS = ['Manhã', 'Tarde', 'Integral']

interface Funcionario {
  id: number
  nome_completo: string
}

function ResponsavelInput({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    invoke<Funcionario[]>('listar_funcionarios')
      .then((list) => setFuncionarios(list))
      .catch(() => setFuncionarios([]))
  }, [])

  useEffect(() => {
    setQuery(value)
  }, [value])

  const filtered = query.trim()
    ? funcionarios.filter((f) =>
        f.nome_completo.toLowerCase().includes(query.toLowerCase())
      )
    : funcionarios

  const select = useCallback(
    (nome: string) => {
      setQuery(nome)
      onChange(nome)
      setOpen(false)
    },
    [onChange]
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200)
            onBlur?.()
          }}
          className={`${INPUT_CLASS} pl-8`}
          placeholder={placeholder || 'Nome do responsavel'}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((f) => (
            <li
              key={f.id}
              onMouseDown={() => select(f.nome_completo)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700"
            >
              {f.nome_completo}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function NovaTurmaPage() {
  const router = useRouter()
  const [responsaveis, setResponsaveis] = useState<string[]>([''])
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TurmaForm>({
    resolver: zodResolver(turmaSchema),
    defaultValues: { nome: '', turno: '', vagas: 20 },
  })

  const addResponsavel = () => setResponsaveis((prev) => [...prev, ''])
  const removeResponsavel = (index: number) => setResponsaveis((prev) => prev.filter((_, i) => i !== index))
  const updateResponsavel = (index: number, value: string) => setResponsaveis((prev) => prev.map((r, i) => (i === index ? value : r)))

  const onSubmit = async (data: TurmaForm) => {
    setSubmitError('')
    try {
      const responsaveisFiltrados = responsaveis.filter((r) => r.trim() !== '')
      await invoke('create_turma', {
        turma: {
          id: null,
          nome: data.nome,
          ano: new Date().getFullYear(),
          turno: data.turno,
          vagas: data.vagas,
          status: 'ativa',
          responsaveis: JSON.stringify(responsaveisFiltrados),
        },
      })
      router.push('/turmas')
    } catch (e) {
      setSubmitError(String(e))
    }
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />Voltar
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Turma</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Turma *</label>
            <input autoComplete="off" {...register('nome')} className={INPUT_CLASS} placeholder="Ex: maternal A" />
            {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Turno *</label>
            <select {...register('turno')} className={INPUT_CLASS} defaultValue="">
              <option value="" disabled>Selecione</option>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.turno && <p className="mt-1 text-sm text-red-600">{errors.turno.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vagas *</label>
            <input autoComplete="off" type="number" {...register('vagas')} className={INPUT_CLASS} min={1} />
            {errors.vagas && <p className="mt-1 text-sm text-red-600">{errors.vagas.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsaveis da Turma</label>
            <div className="space-y-2">
              {responsaveis.map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <ResponsavelInput
                    value={r}
                    onChange={(v) => updateResponsavel(i, v)}
                    placeholder="Nome do responsavel"
                  />
                  {responsaveis.length > 1 && (
                    <button type="button" onClick={() => removeResponsavel(i)} className="p-2 text-red-500 hover:text-red-700 mt-1">
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
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors">
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
        </div>
      </form>
    </div>
  )
}

