'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { IMaskInput } from 'react-imask'
import { ArrowLeft, AlertCircle, AlertTriangle, Trash2, Plus } from 'lucide-react'
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

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const INPUT_ERROR_CLASS = 'w-full px-3 py-2 border border-red-500 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500'

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
  status: z.enum(['ativo', 'inativo']),
})

type FuncionarioForm = z.infer<typeof funcionarioSchema>

interface Funcionario {
  id: number
  nome_completo: string
  nome_social: string | null
  cpf: string
  telefone: string
  telefone_secundario: string | null
  email: string
  salario: number
  cargo_id: number
  escala_trabalho_id: number | null
  contato_emergencia: string | null
  telefone_emergencia: string | null
  status: string
}

interface Cargo {
  id: number
  nome: string
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

interface FuncionarioTurma {
  turma_id: number
  turma_nome: string
}

interface FieldError {
  [key: string]: string | undefined
}

interface DeleteConfirmDialogProps {
  isOpen: boolean
  funcionario: Funcionario | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeleteConfirmDialog({ isOpen, funcionario, onConfirm, onCancel, isLoading }: DeleteConfirmDialogProps) {
  if (!isOpen || !funcionario) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:border dark:border-gray-700 p-6 max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Deletar Funcionário?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Tem certeza que deseja deletar o funcionário <strong>{funcionario.nome_completo}</strong>? Esta ação não poderá ser desfeita.
            </p>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-6 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" /> Todos os registros relacionados (turmas, frequências, etc) também serão deletados.
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

function EditarFuncionarioContent() {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const id = params.get('id') ?? ''
  const [loading, setLoading] = useState(true)
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [escalas, setEscalas] = useState<Escala[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [funcionarioTurmas, setFuncionarioTurmas] = useState<FuncionarioTurma[]>([])
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [selectedTurmaId, setSelectedTurmaId] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; isLoading: boolean }>({
    isOpen: false,
    isLoading: false,
  })
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
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

  useEffect(() => {
    Promise.all([
      invoke<Cargo[]>('listar_cargos').catch(() => []),
      invoke<Turma[]>('get_turmas').catch(() => []),
      invoke<Escala[]>('listar_escalas_trabalho')
        .then((es) => (es || []).filter((e) => e.status === 'ativo'))
        .catch(() => []),
    ])
      .then(([crgs, trms, escs]) => {
        setCargos(crgs)
        setTurmas(trms)
        setEscalas(escs)
        return crgs
      })
      .catch(console.error)

    invoke<Funcionario>('get_funcionario_by_id', { id: parseInt(id) })
      .then((func) => {
        setFuncionario(func)
        reset({
          nome: func.nome_completo,
          nome_social: func.nome_social || '',
          cpf: func.cpf,
          telefone: func.telefone,
          telefone_secundario: func.telefone_secundario || '',
          email: func.email,
          salario: func.salario,
          cargo_id: func.cargo_id,
          escala_trabalho_id: func.escala_trabalho_id || 0,
          contato_emergencia: func.contato_emergencia || '',
          telefone_emergencia: func.telefone_emergencia || '',
          status: func.status as 'ativo' | 'inativo',
        })

        return invoke<FuncionarioTurma[]>('get_funcionario_turmas', { funcionarioId: parseInt(id) })
      })
      .then((ft) => {
        setFuncionarioTurmas(ft)
      })
      .catch((error) => {
        console.error('Erro ao carregar dados:', error)
        toast.addToast('Erro ao carregar dados do funcionário', 'error')
      })
      .finally(() => setLoading(false))
  }, [id, reset])

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

  const currentCargoExists = formValues.cargo_id && cargos.some((c) => c.id === formValues.cargo_id)

  const onSubmit = async (data: FuncionarioForm) => {
    setSubmitError('')

    if (!cargos.some((c) => c.id === data.cargo_id)) {
      setSubmitError('O cargo selecionado não existe mais. Escolha outro cargo.')
      toast.addToast('O cargo selecionado foi deletado', 'error')
      return
    }

    const nameValidation = validateName(data.nome)
    const cpfValidation = validateCPF(data.cpf)
    const phoneValidation = validatePhone(data.telefone)
    const emailValidation = validateEmail(data.email)

    if (!nameValidation.isValid || !cpfValidation.isValid || !phoneValidation.isValid || !emailValidation.isValid) {
      setSubmitError('Por favor, corrija os erros no formulário')
      return
    }

    try {
      await invoke('update_funcionario', {
        func: {
          id: parseInt(id),
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
      toast.addToast('Funcionário atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar funcionário:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar funcionário'
      const finalError = errorMessage || 'Erro ao atualizar. Tente novamente.'
      setSubmitError(finalError)
      toast.addToast(finalError, 'error')
    }
  }

  const handleAddTurma = async () => {
    if (!selectedTurmaId) return

    try {
      const turmaId = parseInt(selectedTurmaId)
      await invoke('adicionar_funcionario_turma', {
        funcionarioId: parseInt(id),
        turmaId,
      })
      const turma = turmas.find((t) => t.id === turmaId)
      if (turma) {
        setFuncionarioTurmas((prev) => [...prev, { turma_id: turmaId, turma_nome: turma.nome }])
        setSelectedTurmaId('')
        toast.addToast('Turma adicionada com sucesso!', 'success')
      }
    } catch (error) {
      console.error('Erro ao adicionar turma:', error)
      toast.addToast('Erro ao adicionar turma', 'error')
    }
  }

  const handleRemoveTurma = async (turmaId: number) => {
    try {
      await invoke('remover_funcionario_turma', {
        funcionarioId: parseInt(id),
        turmaId,
      })
      setFuncionarioTurmas((prev) => prev.filter((ft) => ft.turma_id !== turmaId))
      toast.addToast('Turma removida com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao remover turma:', error)
      toast.addToast('Erro ao remover turma', 'error')
    }
  }

  const handleDeleteClick = () => {
    setDeleteDialog({ isOpen: true, isLoading: false })
  }

  const handleDeleteConfirm = async () => {
    setDeleteDialog((prev) => ({ ...prev, isLoading: true }))

    try {
      await invoke('delete_funcionario', { id: parseInt(id) })
      setDeleteDialog({ isOpen: false, isLoading: false })
      toast.addToast('Funcionário deletado com sucesso!', 'success')
      router.push('/funcionarios')
    } catch (error) {
      console.error('Erro ao deletar funcionário:', error)
      toast.addToast('Erro ao deletar. Tente novamente.', 'error')
      setDeleteDialog((prev) => ({ ...prev, isLoading: false }))
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Carregando...</h1>
        </div>
        <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!funcionario) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Funcionário não encontrado</h1>
        </div>
      </div>
    )
  }

  const availableTurmas = turmas.filter((t) => !funcionarioTurmas.some((ft) => ft.turma_id === t.id))

  return (
    <div>
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        funcionario={funcionario}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, isLoading: false })}
        isLoading={deleteDialog.isLoading}
      />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editar Funcionário</h1>
      </div>

      <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
          </div>
        )}

        {/* Warning if current cargo was deleted */}
        {funcionario && funcionario.cargo_id && !currentCargoExists && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Cargo foi deletado</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">O cargo associado a este funcionário foi deletado. Escolha um novo cargo antes de salvar.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nome Completo */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Nome Completo <span className="text-red-600">*</span>
            </label>
            <input
              {...register('nome')}
              onBlur={() => handleFieldBlur('nome')}
              type="text"
              autoComplete="off"
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
            <input
              {...register('nome_social')}
              type="text"
              autoComplete="off"
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Telefone Secundário</label>
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              {...register('email')}
              onBlur={() => handleFieldBlur('email')}
              type="email"
              autoComplete="off"
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
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
                    {cargo.nome}
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Escala de Trabalho</label>
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Nenhuma escala criada. Crie em Funcionários → Escalas.
              </p>
            )}
          </div>

          {/* Contato Emergência */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Contato Emergência</label>
            <input
              {...register('contato_emergencia')}
              type="text"
              autoComplete="off"
              placeholder="Nome do contato (opcional)"
              className={INPUT_CLASS}
            />
          </div>

          {/* Telefone Emergência */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Telefone Emergência</label>
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
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Status</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('status')}
                  type="radio"
                  value="ativo"
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register('status')}
                  type="radio"
                  value="inativo"
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Inativo</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={hasFormErrors || !hasRequiredFields || isSubmitting || !currentCargoExists}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </>
              ) : (
                'Atualizar Funcionário'
              )}
            </button>
          </div>
        </form>

        {/* Delete Button */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDeleteClick}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Deletar Funcionário
          </button>
        </div>
      </div>

      {/* Turmas Section */}
      <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Turmas</h2>

        {/* Add Turma */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Adicionar Turma</label>
          <div className="flex gap-2">
            <select
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Selecione uma turma</option>
              {availableTurmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddTurma}
              disabled={!selectedTurmaId}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
          {availableTurmas.length === 0 && funcionarioTurmas.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Todas as turmas já foram adicionadas</p>
          )}
        </div>

        {/* Turmas List */}
        {funcionarioTurmas.length > 0 ? (
          <div className="space-y-2">
            {funcionarioTurmas.map((ft) => (
              <div
                key={ft.turma_id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <span className="text-sm text-gray-900 dark:text-gray-100">{ft.turma_nome}</span>
                <button
                  onClick={() => handleRemoveTurma(ft.turma_id)}
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Nenhuma turma atribuída</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EditarFuncionarioPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>}>
      <EditarFuncionarioContent />
    </Suspense>
  )
}
