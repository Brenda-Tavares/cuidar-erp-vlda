'use client'

import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import { IMaskInput } from 'react-imask'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const onboardingSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cnpj: z.string().optional().or(z.literal('')),
  endereco: z.string().min(3, 'Endereço é obrigatório'),
  numero: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Selecione um estado válido'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Informe um e-mail válido'),
  senha_admin: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').optional().or(z.literal('')),
  valor_padrao_mensalidade: z.number().min(0, 'Valor deve ser positivo').optional().default(0),
  dia_vencimento: z.number().min(1).max(28, 'Dia deve ser entre 1 e 28').optional().default(5),
})

type OnboardingForm = z.infer<typeof onboardingSchema>

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export default function OnboardingPage() {
  const router = useRouter()
  const { setCreche } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      nome: '',
      cnpj: '',
      endereco: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      telefone: '',
      email: '',
      senha_admin: '',
      valor_padrao_mensalidade: 0,
      dia_vencimento: 5,
    },
  })

  const onSubmit = async (data: OnboardingForm) => {
    setIsSubmitting(true)
    try {
      await invoke('salvar_creche', {
        creche: {
          id: null,
          nome: data.nome,
          cnpj: data.cnpj || null,
          endereco: data.endereco,
          numero: data.numero || null,
          bairro: data.bairro || null,
          cidade: data.cidade,
          estado: data.estado,
          telefone: data.telefone,
          email: data.email,
          senha_admin: data.senha_admin || null,
          onboarding_completo: true,
          valor_padrao_mensalidade: data.valor_padrao_mensalidade ?? 0,
          dia_vencimento: data.dia_vencimento ?? 5,
        },
      })
      setCreche({
        id: 1,
        nome: data.nome,
        cnpj: data.cnpj || null,
        endereco: data.endereco,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cidade: data.cidade,
        estado: data.estado,
        telefone: data.telefone,
        email: data.email,
        senha_admin: data.senha_admin || null,
        onboarding_completo: true,
        valor_padrao_mensalidade: data.valor_padrao_mensalidade ?? 0,
        dia_vencimento: data.dia_vencimento ?? 5,
      })
      router.replace('/dashboard')
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuração da Instituição</h1>
          <p className="mt-2 text-gray-600">Preencha os dados da sua instituição para começar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Instituição</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instituição *</label>
                <input autoComplete="off"
                  type="text"
                  {...register('nome')}
                  className={INPUT_CLASS}
                  placeholder="Instituição Educacional Vila do Aprender"
                />
                {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <Controller
                  name="cnpj"
                  control={control}
                  render={({ field }) => (
                    <IMaskInput
                      mask="00.000.000/0000-00"
                      value={field.value}
                      onAccept={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      className={INPUT_CLASS}
                      placeholder="00.000.000/0000-00"
                    />
                  )}
                />
                {errors.cnpj && <p className="mt-1 text-sm text-red-600">{errors.cnpj.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                <Controller
                  name="telefone"
                  control={control}
                  render={({ field }) => (
                    <IMaskInput
                      mask="(00) 00000-0000"
                      value={field.value}
                      onAccept={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      className={INPUT_CLASS}
                      placeholder="(00) 00000-0000"
                    />
                  )}
                />
                {errors.telefone && <p className="mt-1 text-sm text-red-600">{errors.telefone.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço *</label>
                <input autoComplete="off"
                  type="text"
                  {...register('endereco')}
                  className={INPUT_CLASS}
                  placeholder="Rua, Avenida..."
                />
                {errors.endereco && <p className="mt-1 text-sm text-red-600">{errors.endereco.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input autoComplete="off"
                  type="text"
                  {...register('numero')}
                  className={INPUT_CLASS}
                  placeholder="123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                <input autoComplete="off"
                  type="text"
                  {...register('bairro')}
                  className={INPUT_CLASS}
                  placeholder="Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
                <input autoComplete="off"
                  type="text"
                  {...register('cidade')}
                  className={INPUT_CLASS}
                  placeholder="São Paulo"
                />
                {errors.cidade && <p className="mt-1 text-sm text-red-600">{errors.cidade.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
                <select
                  {...register('estado')}
                  className={INPUT_CLASS}
                  defaultValue=""
                >
                  <option value="" disabled>Selecione</option>
                  {ESTADOS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
                {errors.estado && <p className="mt-1 text-sm text-red-600">{errors.estado.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input autoComplete="off"
                  type="email"
                  {...register('email')}
                  className={INPUT_CLASS}
                  placeholder="contato@instituicao.com.br"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Admin (opcional)</label>
                <input autoComplete="off"
                  type="password"
                  {...register('senha_admin')}
                  className={INPUT_CLASS}
                  placeholder="Mínimo 8 caracteres. Vazio = manter padrão"
                />
                {errors.senha_admin && <p className="mt-1 text-sm text-red-600">{errors.senha_admin.message}</p>}
                <p className="mt-1 text-xs text-gray-500">Se deixar vazio, a senha padrão será mantida.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurações Financeiras</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Padrão da Mensalidade (R$)</label>
                <Controller
                  name="valor_padrao_mensalidade"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? 0}
                      onChange={(val) => field.onChange(val)}
                      className={INPUT_CLASS}
                      placeholder="0,00"
                    />
                  )}
                />
                {errors.valor_padrao_mensalidade && (
                  <p className="mt-1 text-sm text-red-600">{errors.valor_padrao_mensalidade.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Valor padrão para novos alunos (sem valor personalizado)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia de Vencimento Padrão</label>
                <select
                  {...register('dia_vencimento', { valueAsNumber: true })}
                  className={INPUT_CLASS}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                    <option key={dia} value={dia}>Dia {dia}</option>
                  ))}
                </select>
                {errors.dia_vencimento && (
                  <p className="mt-1 text-sm text-red-600">{errors.dia_vencimento.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Dia do mês para vencimento das mensalidades</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm transition-colors"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar e Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

