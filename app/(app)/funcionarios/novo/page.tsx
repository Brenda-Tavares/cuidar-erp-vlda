'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { IMaskInput } from 'react-imask'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import {
  validateName,
  validateCPF,
  validatePhone,
  validateEmail,
  formatPhone,
  formatCPF,
} from '@/lib/utils/validation'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

const funcionarioSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .refine((val) => val.trim().split(/\s+/).length >= 2, {
      message: 'Nome deve conter nome e sobrenome',
    }),
  nome_social: z.string().optional(),
  cpf: z.string().min(1, 'CPF é obrigatório'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  telefone_secundario: z.string().optional(),
  email: z.string().min(1, 'Email é obrigatório'),
  salario: z.coerce.number().min(0.01, 'Salário deve ser maior que zero'),
  cargo_id: z.coerce.number().min(1, 'Selecione um cargo'),
  escala_trabalho_id: z.coerce.number().optional(),
  contato_emergencia: z.string().optional(),
  telefone_emergencia: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
})

type FuncionarioForm = z.infer<typeof funcionarioSchema>

interface Cargo {
  id: number
  nome: string
  salario_base: number | null
}

interface Escala {
  id: number
  nome: string
  status: string
}

interface Turma {
  id: number
  nome: string
}

interface FieldError {
  [key: string]: string | undefined
}

export default function NovoFuncionarioPage() {
  const router = useRouter()
  const toast = useToast()
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [escalas, setEscalas] = useState<Escala[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<number[]>([])
  const [loadingCargos, setLoadingCargos] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FuncionarioForm>({
    resolver: zodResolver(funcionarioSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: '',
      nome_social: '',
      cpf: '',
      telefone: '',
      telefone_secundario: '',
      email: '',
      salario: 0,
      cargo_id: 0,
      escala_trabalho_id: 0,
      contato_emergencia: '',
      telefone_emergencia: '',
      status: 'ativo',
    },
  })

  const formValues = watch()

  const cargoIdRaw = watch('cargo_id')

  useEffect(() => {
    invoke<Cargo[]>('listar_cargos')
      .then(setCargos)
      .catch((error) => {
        console.error('Erro ao carregar cargos:', error)
        setCargos([])
      })
      .finally(() => setLoadingCargos(false))
  }, [])

  useEffect(() => {
    invoke<Escala[]>('listar_escalas_trabalho')
      .then((result) => setEscalas((result || []).filter((e) => e.status === 'ativo'))
      )
      .catch((error) => {
        console.error('Erro ao carregar escalas:', error)
        setEscalas([])
      })
  }, [])

  useEffect(() => {
    invoke<Turma[]>('get_turmas')
      .then(setTurmas)
      .catch((error) => {
        console.error('Erro ao carregar turmas:', error)
        setTurmas([])
      })
  }, [])

  useEffect(() => {
    const cargoId = Number(cargoIdRaw)
    if (!cargoId || cargoId <= 0) return
    const cargo = cargos.find((c) => c.id === cargoId)
    if (cargo?.salario_base) {
      setValue('salario', cargo.salario_base)
    }
  }, [cargoIdRaw, cargos, setValue])

  const handleFieldBlur = (fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName))
    validateField(fieldName)
  }

  const validateField = (fieldName: string) => {
    const value = formValues[fieldName as keyof FuncionarioForm]
    const newErrors = { ...fieldErrors }

    switch (fieldName) {
      case 'nome':
        if (value) {
          const result = validateName(String(value))
          newErrors.nome = result.isValid ? undefined : result.error
        }
        break
      case 'cpf':
        if (value) {
          const result = validateCPF(String(value))
          newErrors.cpf = result.isValid ? undefined : result.error
        }
        break
      case 'telefone':
        if (value) {
          const result = validatePhone(String(value))
          newErrors.telefone = result.isValid ? undefined : result.error
        }
        break
      case 'telefone_secundario':
        if (value && String(value).trim()) {
          const result = validatePhone(String(value))
          newErrors.telefone_secundario = result.isValid ? undefined : result.error
        } else {
          newErrors.telefone_secundario = undefined
        }
        break
      case 'email':
        if (value) {
          const result = validateEmail(String(value))
          newErrors.email = result.isValid ? undefined : result.error
        }
        break
      case 'telefone_emergencia':
        if (value && String(value).trim()) {
          const result = validatePhone(String(value))
          newErrors.telefone_emergencia = result.isValid ? undefined : result.error
        } else {
          newErrors.telefone_emergencia = undefined
        }
        break
    }

    setFieldErrors(newErrors)
  }

  const hasFormErrors = Object.values(fieldErrors).some((err) => err !== undefined)
  const hasRequiredFields =
    formValues.nome &&
    formValues.cpf &&
    formValues.telefone &&
    formValues.email &&
    formValues.salario > 0 &&
    formValues.cargo_id

  const onSubmit = async (data: FuncionarioForm) => {
    setSubmitError('')

    const nameValidation = validateName(data.nome)
    const cpfValidation = validateCPF(data.cpf)
    const phoneValidation = validatePhone(data.telefone)
    const emailValidation = validateEmail(data.email)

    if (!nameValidation.isValid || !cpfValidation.isValid || !phoneValidation.isValid || !emailValidation.isValid) {
      setSubmitError('Por favor, corrija os erros no formulário')
      return
    }

    try {
      const novoId = await invoke<number>('criar_funcionario', {
        func: {
          id: null,
          nome_completo: data.nome,
          nome_social: data.nome_social || null,
          cpf: data.cpf,
          telefone: data.telefone,
          telefone_secundario: data.telefone_secundario || null,
          email: data.email,
          salario: data.salario,
          cargo_id: data.cargo_id,
          escala_trabalho_id: data.escala_trabalho_id || null,
          contato_emergencia: data.contato_emergencia || null,
          telefone_emergencia: data.telefone_emergencia || null,
          status: data.status,
        },
      })

      for (const turmaId of turmasSelecionadas) {
        await invoke('adicionar_funcionario_turma', {
          funcionarioId: novoId,
          turmaId,
        })
      }

      toast.addToast('Funcionário criado com sucesso!', 'success')
      router.push('/funcionarios')
    } catch (error) {
      console.error('Erro ao criar funcionário:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar funcionário'
      const finalError = errorMessage || 'Erro ao criar funcionário. Tente novamente.'
      setSubmitError(finalError)
      toast.addToast(finalError, 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Novo Funcionário</h1>
      </div>

      {/* If no cargos, show disabled state */}
      {cargos.length === 0 ? (
        <div className="max-w-2xl bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Nenhum cargo disponível</p>
                <p className="text-sm text-blue-700 mt-1">Você precisa criar pelo menos um cargo antes de adicionar um funcionário.</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-600 text-sm mb-6">Acesse a página de gerenciar cargos para criar um novo cargo.</p>
            <button
              onClick={() => router.push('/funcionarios/cargos')}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Ir para Gerenciar Cargos
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl bg-white rounded-lg border border-gray-200 p-6">
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nome Completo */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Nome Completo <span className="text-red-600">*</span>
            </label>
            <input autoComplete="off"
              {...register('nome')}
              onBlur={() => handleFieldBlur('nome')}
              type="text"
              placeholder="Digite o nome completo"
              className={touched.has('nome') && fieldErrors.nome ? INPUT_ERROR_CLASS : INPUT_CLASS}
            />
            {touched.has('nome') && fieldErrors.nome && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.nome}</p>
              </div>
            )}
          </div>

          {/* Nome Social */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Nome Social</label>
            <input autoComplete="off"
              {...register('nome_social')}
              type="text"
              placeholder="Digite o nome social (opcional)"
              className={INPUT_CLASS}
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              CPF <span className="text-red-600">*</span>
            </label>
            <Controller
              name="cpf"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  {...field}
                  mask="000.000.000-00"
                  placeholder="000.000.000-00"
                  onBlur={() => handleFieldBlur('cpf')}
                  className={touched.has('cpf') && fieldErrors.cpf ? INPUT_ERROR_CLASS : INPUT_CLASS}
                />
              )}
            />
            {touched.has('cpf') && fieldErrors.cpf && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.cpf}</p>
              </div>
            )}
          </div>

          {/* Telefone Principal */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Telefone <span className="text-red-600">*</span>
            </label>
            <Controller
              name="telefone"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  {...field}
                  mask="(00) 00000-0000"
                  placeholder="(00) 00000-0000"
                  onBlur={() => handleFieldBlur('telefone')}
                  className={touched.has('telefone') && fieldErrors.telefone ? INPUT_ERROR_CLASS : INPUT_CLASS}
                />
              )}
            />
            {touched.has('telefone') && fieldErrors.telefone && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.telefone}</p>
              </div>
            )}
          </div>

          {/* Telefone Secundário */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Telefone Secundário</label>
            <Controller
              name="telefone_secundario"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  {...field}
                  mask="(00) 00000-0000"
                  placeholder="(00) 00000-0000 (opcional)"
                  onBlur={() => handleFieldBlur('telefone_secundario')}
                  className={touched.has('telefone_secundario') && fieldErrors.telefone_secundario ? INPUT_ERROR_CLASS : INPUT_CLASS}
                />
              )}
            />
            {touched.has('telefone_secundario') && fieldErrors.telefone_secundario && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.telefone_secundario}</p>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Email <span className="text-red-600">*</span>
            </label>
            <input autoComplete="off"
              {...register('email')}
              onBlur={() => handleFieldBlur('email')}
              type="email"
              placeholder="email@example.com"
              className={touched.has('email') && fieldErrors.email ? INPUT_ERROR_CLASS : INPUT_CLASS}
            />
            {touched.has('email') && fieldErrors.email && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.email}</p>
              </div>
            )}
          </div>

          {/* Salário */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Salário <span className="text-red-600">*</span>
            </label>
            <Controller
              name="salario"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value || 0}
                  onChange={field.onChange}
                  className={INPUT_CLASS}
                  placeholder="0,00"
                />
              )}
            />
            {errors.salario && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.salario.message}</p>
              </div>
            )}
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Cargo <span className="text-red-600">*</span>
            </label>
            <select
              {...register('cargo_id')}
              className={INPUT_CLASS}
            >
              <option value="">Selecione um cargo</option>
              {cargos.length > 0 ? (
                cargos.map((cargo) => (
                  <option key={cargo.id} value={cargo.id}>
                    {cargo.nome}{cargo.salario_base ? ` (R$ ${cargo.salario_base.toFixed(2).replace('.', ',')})` : ''}
                  </option>
                ))
              ) : (
                <option disabled>Nenhum cargo criado</option>
              )}
            </select>
            {errors.cargo_id && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.cargo_id.message}</p>
              </div>
            )}
          </div>

          {/* Escala de Trabalho */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Escala de Trabalho</label>
            <select
              {...register('escala_trabalho_id')}
              className={INPUT_CLASS}
            >
              <option value="">Sem escala (opcional)</option>
              {escalas.map((escala) => (
                <option key={escala.id} value={escala.id}>
                  {escala.nome}
                </option>
              ))}
            </select>
            {escalas.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Nenhuma escala criada. Crie em Funcionários → Escalas.
              </p>
            )}
          </div>

          {/* Turmas */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Turmas Atribuídas</label>
            {turmas.length === 0 ? (
              <p className="text-xs text-gray-500">
                Nenhuma turma criada. Crie em Turmas.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {turmas.map((turma) => {
                  const selecionada = turmasSelecionadas.includes(turma.id)
                  return (
                    <label
                      key={turma.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selecionada
                          ? 'bg-indigo-50 border-indigo-400'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input autoComplete="off"
                        type="checkbox"
                        checked={selecionada}
                        onChange={() =>
                          setTurmasSelecionadas((prev) =>
                            selecionada ? prev.filter((t) => t !== turma.id) : [...prev, turma.id]
                          )
                        }
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm text-gray-800">{turma.nome}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contato Emergência */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Contato Emergência</label>
            <input autoComplete="off"
              {...register('contato_emergencia')}
              type="text"
              placeholder="Nome do contato (opcional)"
              className={INPUT_CLASS}
            />
          </div>

          {/* Telefone Emergência */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Telefone Emergência</label>
            <Controller
              name="telefone_emergencia"
              control={control}
              render={({ field }) => (
                <IMaskInput
                  {...field}
                  mask="(00) 00000-0000"
                  placeholder="(00) 00000-0000 (opcional)"
                  onBlur={() => handleFieldBlur('telefone_emergencia')}
                  className={touched.has('telefone_emergencia') && fieldErrors.telefone_emergencia ? INPUT_ERROR_CLASS : INPUT_CLASS}
                />
              )}
            />
            {touched.has('telefone_emergencia') && fieldErrors.telefone_emergencia && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{fieldErrors.telefone_emergencia}</p>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Status</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input autoComplete="off"
                  {...register('status')}
                  type="radio"
                  value="ativo"
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input autoComplete="off"
                  {...register('status')}
                  type="radio"
                  value="inativo"
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Inativo</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={hasFormErrors || !hasRequiredFields || isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </>
              ) : (
                'Criar Funcionário'
              )}
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  )
}

