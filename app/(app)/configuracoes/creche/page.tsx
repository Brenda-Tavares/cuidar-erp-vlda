'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoke, estaNoNavegador } from '@/lib/tauri-invoke'
import { IMaskInput } from 'react-imask'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { useAuthStore } from '@/lib/store/auth-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const crecheSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cnpj: z.string().optional().or(z.literal('')),
  endereco: z.string().min(3, 'Endereço é obrigatório'),
  numero: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Selecione um estado válido'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Informe um e-mail válido'),
  valor_padrao_mensalidade: z.number().min(0, 'Valor deve ser positivo').optional().default(0),
  dia_vencimento: z.number().min(1).max(28, 'Dia deve ser entre 1 e 28').optional().default(5),
  taxa_matricula: z.number().min(0, 'Valor deve ser positivo').optional().default(0),
})

type CrecheForm = z.infer<typeof crecheSchema>

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export default function ConfiguracoesCrechePage() {
  const router = useRouter()
  const { resetAll, setCreche, setLogo } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [ipLocal, setIpLocal] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [redePermitida, setRedePermitida] = useState(false)
  const [redePorta, setRedePorta] = useState(1420)
  const [redeIp, setRedeIp] = useState('')
  const [ipsLocais, setIpsLocais] = useState<string[]>([])
  const [redeSalvando, setRedeSalvando] = useState(false)
  const [redeErro, setRedeErro] = useState('')
  const [redeMensagem, setRedeMensagem] = useState('')
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoFileName, setLogoFileName] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CrecheForm>({
    resolver: zodResolver(crecheSchema),
  })

  useEffect(() => {
    invoke<CrecheForm>('get_creche')
      .then((data) => {
        reset({
          nome: data.nome,
          cnpj: data.cnpj ?? '',
          endereco: data.endereco,
          numero: data.numero ?? '',
          bairro: data.bairro ?? '',
          cidade: data.cidade,
          estado: data.estado,
          telefone: data.telefone ?? '',
          email: data.email ?? '',
          valor_padrao_mensalidade: data.valor_padrao_mensalidade ?? 0,
          dia_vencimento: data.dia_vencimento ?? 5,
          taxa_matricula: data.taxa_matricula ?? 0,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    invoke<string>('get_ip_local')
      .then(setIpLocal)
      .catch(() => setIpLocal(null))

    invoke<string[]>('listar_ips_locais')
      .then((ips) => {
        setIpsLocais(ips)
        if (ips.length > 0) setRedeIp((atual) => atual || ips[0])
      })
      .catch(() => setIpsLocais([]))

    invoke<{ habilitada: boolean; porta: number; ip: string }>('rede_local_get')
      .then((cfg) => {
        setRedePermitida(cfg.habilitada)
        setRedePorta(cfg.porta)
        if (cfg.ip) setRedeIp(cfg.ip)
      })
      .catch(() => {})

    invoke<string | null>('get_logo').then((logo) => {
      if (logo) setLogoBase64(logo)
    }).catch(() => {})
  }, [reset])

  const onSubmit = async (data: CrecheForm) => {
    setSaving(true)
    try {
      await invoke('salvar_creche', {
        creche: {
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
          senha_admin: null,
          onboarding_completo: true,
          valor_padrao_mensalidade: data.valor_padrao_mensalidade ?? 0,
          dia_vencimento: data.dia_vencimento ?? 5,
          taxa_matricula: data.taxa_matricula ?? 0,
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
        senha_admin: null,
        onboarding_completo: true,
        valor_padrao_mensalidade: data.valor_padrao_mensalidade ?? 0,
        dia_vencimento: data.dia_vencimento ?? 5,
        taxa_matricula: data.taxa_matricula ?? 0,
      })
      setSaving(false)
    } catch {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) return
    setPasswordSaving(true)
    try {
      await invoke('atualizar_senha_admin', { novaSenha: newPassword })
      setPasswordSuccess(true)
      setNewPassword('')
      setTimeout(() => {
        setPasswordSuccess(false)
        setShowPasswordModal(false)
      }, 2000)
    } catch {
      setPasswordSaving(false)
    }
  }

  const copyAddress = () => {
    const endereco = `http://${redeIp}:${redePorta}`
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(endereco)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = endereco
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    copiar()
  }

  const handleToggleRede = async (habilitada: boolean) => {
    setRedeSalvando(true)
    setRedeErro('')
    setRedeMensagem('')
    try {
      await invoke('rede_local_set', {
        config: { habilitada, porta: redePorta, ip: redeIp },
      })
      setRedePermitida(habilitada)
      setRedeMensagem(
        habilitada
          ? 'Servidor ativado. Conecte-se na mesma rede e abra o endereço abaixo em outro aparelho.'
          : 'Acesso pela rede desativado.'
      )
    } catch (err) {
      setRedeErro(String(err))
    } finally {
      setRedeSalvando(false)
    }
  }

  const handleSalvarRede = async () => {
    if (redePorta < 1024 || redePorta > 65535) {
      setRedeErro('A porta deve estar entre 1024 e 65535.')
      return
    }
    setRedeSalvando(true)
    setRedeErro('')
    setRedeMensagem('')
    try {
      await invoke('rede_local_set', {
        config: { habilitada: redePermitida, porta: redePorta, ip: redeIp },
      })
      setRedeMensagem('Configuração de rede salva.')
    } catch (err) {
      setRedeErro(String(err))
    } finally {
      setRedeSalvando(false)
    }
  }

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setLogoBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveLogo = async () => {
    if (!logoBase64) return
    setLogoSaving(true)
    try {
      await invoke('salvar_logo', { logoBase64 })
      setLogo(logoBase64)
      setLogoSaving(false)
    } catch {
      setLogoSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      await invoke('reset_all_data_and_init')
    } catch {
    }
    resetAll()
  }

  if (loading) {
    return <div className="p-6 animate-pulse"><div className="h-8 bg-gray-200 rounded w-48 mb-6" /><div className="h-64 bg-gray-200 rounded" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações da Instituição</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Instituição</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instituição *</label>
              <input autoComplete="off" type="text" {...register('nome')} className={INPUT_CLASS} />
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
              <input autoComplete="off" type="text" {...register('endereco')} className={INPUT_CLASS} />
              {errors.endereco && <p className="mt-1 text-sm text-red-600">{errors.endereco.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input autoComplete="off" type="text" {...register('numero')} className={INPUT_CLASS} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input autoComplete="off" type="text" {...register('bairro')} className={INPUT_CLASS} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
              <input autoComplete="off" type="text" {...register('cidade')} className={INPUT_CLASS} />
              {errors.cidade && <p className="mt-1 text-sm text-red-600">{errors.cidade.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <select {...register('estado')} className={INPUT_CLASS}>
                {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
              {errors.estado && <p className="mt-1 text-sm text-red-600">{errors.estado.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail da Instituição *</label>
              <input autoComplete="off" type="email" {...register('email')} className={INPUT_CLASS} placeholder="contato@instituicao.com.br" />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
          </div>
        </div>

          {/* Logo da Instituição */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo da Instituição</h2>
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0 bg-gray-50">
                {logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-2">Nenhuma logo</span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <input autoComplete="off" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleLogoFile} className="hidden" />
                  Selecionar imagem
                </label>
                {logoFileName && <p className="text-xs text-gray-500">{logoFileName}</p>}
                {logoBase64 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveLogo}
                      disabled={logoSaving}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      {logoSaving ? 'Salvando...' : 'Salvar Logo'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLogoBase64(null)
                        setLogoFileName(null)
                        setLogo(null)
                        try { await invoke('salvar_logo', { logoBase64: '' }) } catch {}
                      }}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500">Formatos aceitos: PNG, JPG, GIF, WebP. A imagem será exibida no dashboard e nas telas de login.</p>
              </div>
            </div>
          </div>

          {/* Configurações Financeiras */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de Matrícula (R$)</label>
                <Controller
                  name="taxa_matricula"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? 0}
                      onChange={(val) => field.onChange(val)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0,00"
                    />
                  )}
                />
                {errors.taxa_matricula && (
                  <p className="mt-1 text-sm text-red-600">{errors.taxa_matricula.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Valor cobrado no momento da matrícula do aluno</p>
              </div>
            </div>
          </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => setShowPasswordModal(true)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Alterar Senha Admin
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acesso em Rede Local</h2>
        {estaNoNavegador() ? (
          <div className="space-y-3 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              Você está acessando o sistema pelo navegador em:
            </p>
            <code className="block bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-mono">
              {window.location.origin}
            </code>
            <p className="text-sm text-gray-600">
              Os ajustes do servidor de rede devem ser feitos no computador que hospeda o sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Permitir acesso na rede</span>
              <button
                type="button"
                disabled={redeSalvando}
                onClick={() => handleToggleRede(!redePermitida)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${redePermitida ? 'bg-gray-900' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${redePermitida ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interface de rede (IP)</label>
                <select
                  value={redeIp}
                  onChange={(e) => setRedeIp(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {ipsLocais.length === 0 && <option value="">Nenhum IP encontrado</option>}
                  {ipsLocais.map((ip) => (
                    <option key={ip} value={ip}>{ip}</option>
                  ))}
                </select>
                {ipsLocais.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">Nenhum IP de rede local foi encontrado.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={redePorta}
                  onChange={(e) => setRedePorta(Number(e.target.value))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            {redeErro && <p className="text-sm text-red-600">{redeErro}</p>}
            {redeMensagem && <p className="text-sm text-green-600">{redeMensagem}</p>}
            <div className="flex gap-3">
              <Button onClick={handleSalvarRede} disabled={redeSalvando} variant="outline" size="sm">
                {redeSalvando ? 'Salvando...' : 'Salvar configuração'}
              </Button>
            </div>
            {(redePermitida || redeIp || ipLocal) && (
              <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <code className="flex-1 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-mono">
                    http://{redeIp || ipLocal}:{redePorta}
                  </code>
                  <Button onClick={copyAddress} variant="outline" size="sm">
                    {copied ? 'Copiado!' : 'Copiar endereço'}
                  </Button>
                </div>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Conecte-se à mesma rede Wi-Fi</li>
                  <li>Abra o navegador (celular, tablet ou outro computador)</li>
                  <li>Cole o endereço acima e faça login normalmente</li>
                  <li>Se não abrir, libere a porta {redePorta} no firewall do Windows</li>
                </ol>
                <p className="text-xs text-gray-500">
                  O servidor é reiniciado automaticamente sempre que o aplicativo abre. O acesso pelo navegador usa o
                  login do sistema com token de segurança (validade de 12 horas).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Tour Guiado</h2>
        <p className="text-sm text-gray-600 mb-4">Reinicie o tour guiado para ver as principais funcionalidades do sistema novamente.</p>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem('cuidar-tour-complete')
            window.location.href = '/dashboard'
          }}
        >
          Reiniciar Tour
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Limpar dados do sistema</h2>
        <p className="text-sm text-gray-600 mb-4">Remove todos os dados do sistema permanentemente. Esta ação não pode ser desfeita.</p>
        <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
          Limpar dados do sistema
        </Button>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Limpar dados do sistema</DialogTitle>
            <DialogDescription>
              Remove todos os dados do sistema permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha Admin</h2>
            <input autoComplete="off"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (min 8 caracteres)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            {passwordSuccess && (
              <p className="text-sm text-green-600 mb-4">Senha alterada com sucesso!</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={passwordSaving || newPassword.length < 8}
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                {passwordSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordSuccess(false); setNewPassword('') }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

