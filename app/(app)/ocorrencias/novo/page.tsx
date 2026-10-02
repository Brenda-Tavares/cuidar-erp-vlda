'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import {
  validateRequired,
  validateTextLength,
} from '@/lib/utils/validation'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const ocorrenciaSchema = z.object({
  aluno_id: z.coerce.number().min(1, 'Selecione um aluno'),
  data: z.string().min(1, 'Data é obrigatória'),
  tipo: z.enum(['Positiva', 'Negativa', 'Neutra']).optional(),
  descricao: z.string().min(5, 'Descrição deve ter pelo menos 5 caracteres').max(500, 'Descrição não pode exceder 500 caracteres'),
})

type OcorrenciaForm = z.infer<typeof ocorrenciaSchema>

interface Aluno {
  id: number
  nome: string
}

interface FieldError {
  [key: string]: string | undefined
}

function getCurrentDateTime(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function NovaOcorrenciaPage() {
  const router = useRouter()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [charCount, setCharCount] = useState(0)
  const MAX_CHARS = 500
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OcorrenciaForm>({
    resolver: zodResolver(ocorrenciaSchema),
    mode: 'onBlur',
    defaultValues: {
      aluno_id: 0,
      data: getCurrentDateTime(),
      tipo: 'Negativa',
      descricao: '',
    },
  })

  const formValues = watch()

  useEffect(() => {
    invoke<Aluno[]>('listar_alunos')
      .then(setAlunos)
      .catch(console.error)
  }, [])

  useEffect(() => {
    setCharCount(formValues.descricao?.length || 0)
  }, [formValues.descricao])

  const handleFieldBlur = (fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName))
    validateField(fieldName)
  }

  const validateField = (fieldName: string) => {
    const value = formValues[fieldName as keyof OcorrenciaForm]
    const newErrors = { ...fieldErrors }
    
    switch (fieldName) {
      case 'aluno_id':
        if (!value || value === 0) {
          newErrors.aluno_id = 'Selecione um aluno'
        } else {
          newErrors.aluno_id = undefined
        }
        break
      case 'data':
        if (!value || String(value).trim() === '') {
          newErrors.data = 'Data e hora são obrigatórias'
        } else {
          newErrors.data = undefined
        }
        break
      case 'descricao':
        if (value) {
          const result = validateTextLength(String(value), 5, MAX_CHARS)
          newErrors.descricao = result.isValid ? undefined : result.error
        } else {
          newErrors.descricao = 'Descrição é obrigatória'
        }
        break
    }
    
    setFieldErrors(newErrors)
  }

  const hasFormErrors = Object.values(fieldErrors).some((err) => err !== undefined)
  const hasRequiredFields = formValues.aluno_id && formValues.data && formValues.descricao

  const onSubmit = async (data: OcorrenciaForm) => {
    setSubmitError('')
    try {
      const [datePart, timePart] = data.data.split('T')
      const dbDateTime = `${datePart} ${timePart}:00`

      await invoke('create_ocorrencia', {
        o: {
          id: null,
          aluno_id: data.aluno_id,
          data: dbDateTime,
          tipo: data.tipo || 'Neutra',
          descricao: data.descricao,
        },
      })
      router.push('/ocorrencias')
    } catch (e) {
      setSubmitError(String(e))
    }
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Ocorrência</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="aluno_id" className="block text-sm font-medium text-gray-700 mb-1">
              Aluno *
            </label>
            <select
              id="aluno_id"
              {...register('aluno_id')}
              onBlur={() => handleFieldBlur('aluno_id')}
              className={touched.has('aluno_id') && fieldErrors.aluno_id ? INPUT_ERROR_CLASS : INPUT_CLASS}
            >
              <option value="">Selecione um aluno</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            {(touched.has('aluno_id') && fieldErrors.aluno_id) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.aluno_id}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="data" className="block text-sm font-medium text-gray-700 mb-1">
              Data e Hora *
            </label>
            <input autoComplete="off"
              id="data"
              type="datetime-local"
              {...register('data')}
              onBlur={() => handleFieldBlur('data')}
              className={touched.has('data') && fieldErrors.data ? INPUT_ERROR_CLASS : INPUT_CLASS}
            />
            {(touched.has('data') && fieldErrors.data) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.data}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select id="tipo" {...register('tipo')} className={INPUT_CLASS}>
              <option value="Positiva">Positiva</option>
              <option value="Negativa">Negativa</option>
              <option value="Neutra">Neutra</option>
            </select>
            {errors.tipo && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.tipo.message}</p>}
          </div>

          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição * <span className="text-gray-500 font-normal">({charCount}/{MAX_CHARS})</span>
            </label>
            <textarea
              id="descricao"
              {...register('descricao')}
              onBlur={() => handleFieldBlur('descricao')}
              className={`${touched.has('descricao') && fieldErrors.descricao ? INPUT_ERROR_CLASS : INPUT_CLASS} resize-none h-24`}
              placeholder="Descreva a ocorrência com detalhes (mínimo 5 caracteres)..."
              maxLength={MAX_CHARS}
            />
            {(touched.has('descricao') && fieldErrors.descricao) && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{fieldErrors.descricao}
              </p>
            )}
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600 text-center">{submitError}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || hasFormErrors || !hasRequiredFields}
            className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

