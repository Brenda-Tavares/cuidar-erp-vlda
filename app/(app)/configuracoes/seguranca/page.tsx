'use client'

import { useState, useEffect } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { History, Monitor, Check, AlertCircle, Eye, EyeOff, Key } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function SegurancaPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 0

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [passwordCurrent, setPasswordCurrent] = useState('')
  const [passwordNew, setPasswordNew] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const [sessions, setSessions] = useState<any[]>([])
  const [loginHistory, setLoginHistory] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    loadSessions()
    loadLoginHistory()
  }, [userId])

  async function loadSessions() {
    try {
      const result = await invoke<any[]>('get_active_sessions', { userId })
      setSessions(result)
    } catch { /* ignora */ }
  }

  async function loadLoginHistory() {
    if (!user?.username) return
    try {
      const result = await invoke<any[]>('get_login_history', { username: user.username })
      setLoginHistory(result)
    } catch { /* ignora */ }
  }

  async function handleRevokeSession(sessionId: number) {
    try {
      await invoke('revoke_session', { sessionId, userId })
      loadSessions()
      setMessage('Sessão revogada.')
    } catch (err) {
      setError(String(err))
    }
  }

  async function handleChangePassword() {
    if (passwordNew.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (passwordNew !== passwordConfirm) {
      setError('As senhas não conferem.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await invoke('atualizar_senha_admin', { senhaAtual: passwordCurrent, novaSenha: passwordNew })
      setMessage('Senha alterada com sucesso!')
      setPasswordCurrent('')
      setPasswordNew('')
      setPasswordConfirm('')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight dark:text-gray-100">Segurança</h1>
        <p className="text-muted-foreground mt-1">Configurações de autenticação e segurança da conta</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {message && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex gap-3">
          <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold dark:text-gray-100">Alterar Senha</h2>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleChangePassword() }}>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium dark:text-gray-300">Senha Atual</label>
                <div className="relative">
                  <input autoComplete="off"
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordCurrent}
                    onChange={e => setPasswordCurrent(e.target.value)}
                    className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium dark:text-gray-300">Nova Senha</label>
                <input autoComplete="off"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordNew}
                  onChange={e => setPasswordNew(e.target.value)}
                  className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className="text-sm font-medium dark:text-gray-300">Confirmar Nova Senha</label>
                <input autoComplete="off"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !passwordCurrent || !passwordNew || !passwordConfirm}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </div>
          </form>
        </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold dark:text-gray-100">Sessões Ativas</h2>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma sessão ativa encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispositivo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.device_info || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{s.ip_address || '—'}</TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{new Date(s.last_activity).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium"
                    >
                      Revogar
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold dark:text-gray-100">Histórico de Login</h2>
        </div>

        {loginHistory.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum login registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginHistory.map((h: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{new Date(h.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    {h.success ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">Sucesso</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">Falha</span>
                    )}
                  </TableCell>
                  <TableCell>{h.failure_reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

