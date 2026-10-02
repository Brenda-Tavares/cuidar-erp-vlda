'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { AlertCircle, X } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { Cargo } from '@/lib/types/cargo'
import { parseCurrency } from '@/lib/utils/currency'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

interface CargoModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  cargo?: Cargo | null
  onClose: () => void
  onSuccess: () => void
}

interface ValidationErrors {
  nome?: string
  descricao?: string
  salario_base?: string
  status?: string
}

interface CargoFormData {
  id?: number
  nome: string
  descricao: string
  salario_base: number | ''
  status: 'ativo' | 'inativo'
}

export function CargoModal({ isOpen, mode, cargo, onClose, onSuccess }: CargoModalProps) {
  const toast = useToast()
  const [formData, setFormData] = useState<CargoFormData>({
    nome: '',
    descricao: '',
    salario_base: '',
    status: 'ativo',
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && cargo) {
      setFormData({
        id: cargo.id,
        nome: cargo.nome,
        descricao: cargo.descricao || '',
        salario_base: cargo.salario_base || 0,
        status: cargo.status,
      })
      } else {
      setFormData({
        nome: '',
        descricao: '',
        salario_base: '',
        status: 'ativo',
      })
    }
    setErrors({})
    setTouched(new Set())
  }, [mode, cargo, isOpen])

  const validateField = (fieldName: string, value: any): string | undefined => {
    switch (fieldName) {
      case 'nome':
        if (!value || typeof value !== 'string') return 'Nome é obrigatório'
        if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres'
        if (value.trim().length > 100) return 'Nome não pode exceder 100 caracteres'
        return undefined

      case 'descricao':
        if (value && typeof value === 'string' && value.length > 500) {
          return 'Descrição não pode exceder 500 caracteres'
        }
        return undefined

      case 'salario_base':
        if (value !== '' && value !== null && value !== undefined) {
          const numValue = parseCurrency(value)
          if (isNaN(numValue)) return 'Salário deve ser um número válido'
          if (numValue < 0) return 'Salário não pode ser negativo'
        }
        return undefined

      case 'status':
        if (!value || (value !== 'ativo' && value !== 'inativo')) {
          return 'Status é obrigatório'
        }
        return undefined

      default:
        return undefined
    }
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))

    if (touched.has(fieldName)) {
      const error = validateField(fieldName, value)
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }))
    }
  }

  const handleFieldBlur = (fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName))
    const error = validateField(fieldName, formData[fieldName as keyof Cargo])
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}
    let isValid = true

    const nomeError = validateField('nome', formData.nome)
    if (nomeError) {
      newErrors.nome = nomeError
      isValid = false
    }

    const descricaoError = validateField('descricao', formData.descricao)
    if (descricaoError) {
      newErrors.descricao = descricaoError
      isValid = false
    }

    const salarioError = validateField('salario_base', formData.salario_base)
    if (salarioError) {
      newErrors.salario_base = salarioError
      isValid = false
    }

    const statusError = validateField('status', formData.status)
    if (statusError) {
      newErrors.status = statusError
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.addToast('Por favor, corrija os erros no formulário', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'create') {
        await invoke('criar_cargo', {
          cargo: {
            id: null,
            nome: formData.nome.trim(),
            descricao: formData.descricao.trim() || null,
            salario_base: formData.salario_base || null,
            status: formData.status,
          },
        })

        toast.addToast('Cargo criado com sucesso!', 'success')
      } else {
        await invoke('update_cargo', {
          cargo: {
            id: formData.id,
            nome: formData.nome.trim(),
            descricao: formData.descricao.trim() || null,
            salario_base: formData.salario_base || null,
            status: formData.status,
          },
        })

        toast.addToast('Cargo atualizado com sucesso!', 'success')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Erro ao salvar cargo:', error)
      const message = error instanceof Error ? error.message : 'Erro ao salvar cargo'
      toast.addToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isFormValid =
    formData.nome.trim().length >= 2 &&
    formData.nome.trim().length <= 100 &&
    (formData.salario_base === '' ||
      formData.salario_base === null ||
      (typeof formData.salario_base === 'number' && formData.salario_base >= 0)) &&
    formData.status &&
    Object.values(errors).every((err) => !err)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {mode === 'create' ? 'Novo Cargo' : 'Editar Cargo'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Nome <span className="text-red-600">*</span>
            </label>
            <input autoComplete="off"
              type="text"
              value={formData.nome}
              onChange={(e) => handleFieldChange('nome', e.target.value)}
              onBlur={() => handleFieldBlur('nome')}
              placeholder="Ex: Gerente, Supervisor"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.nome && touched.has('nome')
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-indigo-500'
              }`}
              disabled={isSubmitting}
            />
            {errors.nome && touched.has('nome') && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.nome}</p>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => handleFieldChange('descricao', e.target.value)}
              onBlur={() => handleFieldBlur('descricao')}
              placeholder="Descreva as responsabilidades do cargo (opcional)"
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors resize-none ${
                errors.descricao && touched.has('descricao')
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-indigo-500'
              }`}
              disabled={isSubmitting}
            />
            {errors.descricao && touched.has('descricao') && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.descricao}</p>
              </div>
            )}
          </div>

          {/* Salário Base */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Salário Base</label>
            <CurrencyInput
              value={typeof formData.salario_base === 'number' ? formData.salario_base : 0}
              onChange={(v) => handleFieldChange('salario_base', v)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.salario_base && touched.has('salario_base')
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-indigo-500'
              }`}
              placeholder="0,00 (opcional)"
            />
            {errors.salario_base && touched.has('salario_base') && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.salario_base}</p>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Status <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input autoComplete="off"
                  type="radio"
                  name="status"
                  value="ativo"
                  checked={formData.status === 'ativo'}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  onBlur={() => handleFieldBlur('status')}
                  className="w-4 h-4 accent-indigo-600"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input autoComplete="off"
                  type="radio"
                  name="status"
                  value="inativo"
                  checked={formData.status === 'inativo'}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  onBlur={() => handleFieldBlur('status')}
                  className="w-4 h-4 accent-indigo-600"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-gray-700">Inativo</span>
              </label>
            </div>
            {errors.status && touched.has('status') && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.status}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </>
              ) : mode === 'create' ? (
                'Criar Cargo'
              ) : (
                'Atualizar Cargo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

