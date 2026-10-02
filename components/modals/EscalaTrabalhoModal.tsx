'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { AlertCircle, X } from 'lucide-react'
import { useToast } from '@/lib/context/ToastContext'
import { EscalaTrabalho } from '@/lib/types/escala'

const DIAS_SEMANA = [
  { valor: 'segunda', label: 'Segunda' },
  { valor: 'terca', label: 'Terça' },
  { valor: 'quarta', label: 'Quarta' },
  { valor: 'quinta', label: 'Quinta' },
  { valor: 'sexta', label: 'Sexta' },
  { valor: 'sabado', label: 'Sábado' },
  { valor: 'domingo', label: 'Domingo' },
]

interface EscalaTrabalhoModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  escala?: EscalaTrabalho | null
  onClose: () => void
  onSuccess: () => void
}

interface ValidationErrors {
  nome?: string
  dias_semana?: string
  hora_entrada?: string
  hora_saida?: string
  descricao?: string
}

interface EscalaFormData {
  id?: number
  nome: string
  dias_semana: string[]
  hora_entrada: string
  hora_saida: string
  descricao: string
  status: 'ativo' | 'inativo'
}

export function EscalaTrabalhoModal({ isOpen, mode, escala, onClose, onSuccess }: EscalaTrabalhoModalProps) {
  const toast = useToast()
  const [formData, setFormData] = useState<EscalaFormData>({
    nome: '',
    dias_semana: [],
    hora_entrada: '08:00',
    hora_saida: '17:00',
    descricao: '',
    status: 'ativo',
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && escala) {
      let dias: string[] = []
      try {
        dias = JSON.parse(escala.dias_semana)
      } catch {
        dias = []
      }
      setFormData({
        id: escala.id,
        nome: escala.nome,
        dias_semana: Array.isArray(dias) ? dias : [],
        hora_entrada: escala.hora_entrada,
        hora_saida: escala.hora_saida,
        descricao: escala.descricao || '',
        status: escala.status,
      })
    } else {
      setFormData({
        nome: '',
        dias_semana: [],
        hora_entrada: '08:00',
        hora_saida: '17:00',
        descricao: '',
        status: 'ativo',
      })
    }
    setErrors({})
    setTouched(new Set())
  }, [mode, escala, isOpen])

  const validateField = (fieldName: string, value: any): string | undefined => {
    switch (fieldName) {
      case 'nome':
        if (!value || typeof value !== 'string') return 'Nome é obrigatório'
        if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres'
        if (value.trim().length > 100) return 'Nome não pode exceder 100 caracteres'
        return undefined

      case 'dias_semana':
        if (!value || value.length === 0) return 'Selecione ao menos um dia da semana'
        return undefined

      case 'hora_entrada':
        if (!value) return 'Informe o horário de entrada'
        return undefined

      case 'hora_saida':
        if (!value) return 'Informe o horário de saída'
        return undefined

      case 'descricao':
        if (value && typeof value === 'string' && value.length > 500) {
          return 'Descrição não pode exceder 500 caracteres'
        }
        return undefined

      default:
        return undefined
    }
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    if (touched.has(fieldName)) {
      const error = validateField(fieldName, value)
      setErrors((prev) => ({ ...prev, [fieldName]: error }))
    }
  }

  const handleFieldBlur = (fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName))
    const error = validateField(fieldName, formData[fieldName as keyof EscalaFormData])
    setErrors((prev) => ({ ...prev, [fieldName]: error }))
  }

  const toggleDia = (valor: string) => {
    const novos = formData.dias_semana.includes(valor)
      ? formData.dias_semana.filter((d) => d !== valor)
      : [...formData.dias_semana, valor]
    handleFieldChange('dias_semana', novos)
    handleFieldBlur('dias_semana')
  }

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}
    let isValid = true
    const campos: (keyof ValidationErrors)[] = ['nome', 'dias_semana', 'hora_entrada', 'hora_saida', 'descricao']
    for (const campo of campos) {
      const error = validateField(campo, formData[campo as keyof EscalaFormData])
      if (error) {
        newErrors[campo] = error
        isValid = false
      }
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

    const payload = {
      id: mode === 'edit' ? formData.id : null,
      nome: formData.nome.trim(),
      dias_semana: JSON.stringify(formData.dias_semana),
      hora_entrada: formData.hora_entrada,
      hora_saida: formData.hora_saida,
      descricao: formData.descricao.trim() || null,
      status: formData.status,
    }

    try {
      if (mode === 'create') {
        await invoke('criar_escala_trabalho', { escala: payload })
        toast.addToast('Escala criada com sucesso!', 'success')
      } else {
        await invoke('update_escala_trabalho', { escala: payload })
        toast.addToast('Escala atualizada com sucesso!', 'success')
      }
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Erro ao salvar escala:', error)
      const message = error instanceof Error ? error.message : 'Erro ao salvar escala'
      toast.addToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isFormValid =
    formData.nome.trim().length >= 2 &&
    formData.nome.trim().length <= 100 &&
    formData.dias_semana.length > 0 &&
    formData.hora_entrada !== '' &&
    formData.hora_saida !== '' &&
    Object.values(errors).every((err) => !err)

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
      hasError && touched.has('nome')
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:ring-indigo-500'
    }`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {mode === 'create' ? 'Nova Escala de Trabalho' : 'Editar Escala de Trabalho'}
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
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Nome <span className="text-red-600">*</span>
            </label>
            <input autoComplete="off"
              type="text"
              value={formData.nome}
              onChange={(e) => handleFieldChange('nome', e.target.value)}
              onBlur={() => handleFieldBlur('nome')}
              placeholder="Ex: Turno Integral, Manhã, Tarde"
              className={inputClass(!!errors.nome)}
              disabled={isSubmitting}
            />
            {errors.nome && touched.has('nome') && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.nome}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Dias da Semana <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DIAS_SEMANA.map((dia) => {
                const ativo = formData.dias_semana.includes(dia.valor)
                return (
                  <label
                    key={dia.valor}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      ativo
                        ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input autoComplete="off"
                      type="checkbox"
                      checked={ativo}
                      onChange={() => toggleDia(dia.valor)}
                      className="w-4 h-4 accent-indigo-600"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-800">{dia.label}</span>
                  </label>
                )
              })}
            </div>
            {errors.dias_semana && (
              <div className="mt-1 flex gap-1 text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{errors.dias_semana}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Hora de Entrada <span className="text-red-600">*</span>
              </label>
              <input autoComplete="off"
                type="time"
                value={formData.hora_entrada}
                onChange={(e) => handleFieldChange('hora_entrada', e.target.value)}
                onBlur={() => handleFieldBlur('hora_entrada')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              {errors.hora_entrada && touched.has('hora_entrada') && (
                <p className="mt-1 text-xs text-red-600">{errors.hora_entrada}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Hora de Saída <span className="text-red-600">*</span>
              </label>
              <input autoComplete="off"
                type="time"
                value={formData.hora_saida}
                onChange={(e) => handleFieldChange('hora_saida', e.target.value)}
                onBlur={() => handleFieldBlur('hora_saida')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              {errors.hora_saida && touched.has('hora_saida') && (
                <p className="mt-1 text-xs text-red-600">{errors.hora_saida}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => handleFieldChange('descricao', e.target.value)}
              onBlur={() => handleFieldBlur('descricao')}
              placeholder="Observações sobre a escala (opcional)"
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors resize-none ${
                errors.descricao && touched.has('descricao')
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-indigo-500'
              }`}
              disabled={isSubmitting}
            />
            {errors.descricao && touched.has('descricao') && (
              <p className="mt-1 text-xs text-red-600">{errors.descricao}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Status</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input autoComplete="off"
                  type="radio"
                  name="status"
                  value="ativo"
                  checked={formData.status === 'ativo'}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
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
                  className="w-4 h-4 accent-indigo-600"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-gray-700">Inativo</span>
              </label>
            </div>
          </div>

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
                'Criar Escala'
              ) : (
                'Atualizar Escala'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}