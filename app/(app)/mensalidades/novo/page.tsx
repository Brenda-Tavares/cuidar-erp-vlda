'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke } from '@/lib/tauri-invoke'
import { IMaskInput } from 'react-imask'
import { ArrowLeft } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

const mensalidadeSchema = z.object({
  aluno_id: z.coerce.number().min(1, 'Selecione um aluno'),
  vencimento: z.string().min(1, 'Data de vencimento é obrigatória'),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
})

type MensalidadeForm = z.infer<typeof mensalidadeSchema>

interface Aluno { id: number; nome: string }

export default function NovaMensalidadePage() {
  const router = useRouter()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MensalidadeForm>({
    resolver: zodResolver(mensalidadeSchema),
    defaultValues: { aluno_id: 0, vencimento: '', valor: 0 },
  })

  useEffect(() => {
    invoke<Aluno[]>('listar_alunos')
      .then(setAlunos)
      .catch(console.error)
  }, [])

  const onSubmit = async (data: MensalidadeForm) => {
    setSubmitError('')
    try {
      await invoke('create_mensalidade', {
        m: {
          id: null,
          aluno_id: data.aluno_id,
          vencimento: data.vencimento,
          valor: data.valor,
          pago: 0,
        },
      })
      router.push('/mensalidades')
    } catch (e) {
      setSubmitError(String(e))
    }
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />Voltar
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Mensalidade</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aluno *</label>
            <select {...register('aluno_id')} className={INPUT_CLASS} defaultValue="">
              <option value="" disabled>Selecione um aluno</option>
              {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            {errors.aluno_id && <p className="mt-1 text-sm text-red-600">{errors.aluno_id.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento *</label>
            <input autoComplete="off" type="date" {...register('vencimento')} className={INPUT_CLASS} />
            {errors.vencimento && <p className="mt-1 text-sm text-red-600">{errors.vencimento.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
            <Controller
              name="valor"
              control={control}
              rules={{ required: 'Valor é obrigatório', min: { value: 0.01, message: 'Valor deve ser maior que zero' } }}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value || 0}
                  onChange={field.onChange}
                  className={INPUT_CLASS}
                  placeholder="0,00"
                />
              )}
            />
            {errors.valor && <p className="mt-1 text-sm text-red-600">{errors.valor.message}</p>}
           </div>
         </div>
         {/* FIX #2: Added submitError display */}
         {submitError && (
           <p className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-lg">{submitError}</p>
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

