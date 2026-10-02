'use client'

import { useState, useEffect, useRef } from 'react'
import { invoke, estaNoNavegador, enviarUploadWeb } from '@/lib/tauri-invoke'
import { HardDrive, Plus, RotateCw, Trash2, Download, CheckCircle2, XCircle, AlertTriangle, Clock, Database, Settings2, RefreshCw, Upload } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { open, save } from '@tauri-apps/plugin-dialog'

interface BackupInfo {
  id: number
  filename: string
  file_path: string
  file_size: number
  checksum: string
  backup_type: string
  created_at: string
  created_by: number | null
  is_valid: boolean
  notes: string | null
}

interface BackupSettings {
  id: number
  auto_backup_enabled: boolean
  backup_interval_hours: number
  retention_days: number
  backup_path: string | null
  last_backup_at: string | null
  next_backup_at: string | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const PARTES_BACKUP = [
  { valor: 'geral', label: 'Todos os dados (backup geral)' },
  { valor: 'alunos', label: 'Alunos' },
  { valor: 'turmas', label: 'Turmas' },
  { valor: 'frequencias', label: 'Frequências' },
  { valor: 'ocorrencias', label: 'Ocorrências' },
  { valor: 'funcionarios', label: 'Funcionários' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'configuracoes', label: 'Configurações' },
]

function timestampNome(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

/** Junta pasta + nome de arquivo com separador Windows, sem duplicar barras. */
function juntarCaminhoWindows(pasta: string, arquivo: string): string {
  return `${pasta.replace(/[\\/]+$/, '')}\\${arquivo}`
}

export default function BackupsPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 0

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null)
  const [restoreDoubleConfirm, setRestoreDoubleConfirm] = useState('')
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace')

  const [modalBackupAberto, setModalBackupAberto] = useState(false)
  const [escopoSelecionado, setEscopoSelecionado] = useState('geral')

  useEffect(() => {
    loadBackups()
    loadSettings()
  }, [])

  async function loadBackups() {
    try {
      const result = await invoke<BackupInfo[]>('listar_backups')
      setBackups(result)
    } catch { /* ignora */ }
  }

  async function loadSettings() {
    try {
      const result = await invoke<BackupSettings>('get_backup_settings')
      setSettings(result)
    } catch { /* ignora */ }
  }

  async function confirmarBackupDoEscopo() {
    const escopo = escopoSelecionado
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (estaNoNavegador()) {
        await invoke('criar_backup_manual', { userId })
        setMessage('Backup geral criado com sucesso!')
      } else {
        const parte = escopo === 'geral' ? null : escopo
        const pastaPadrao = await invoke<string>('obter_pasta_backup_padrao', { parte })
        const nomeSugerido = `backup${escopo === 'geral' ? '' : `_${escopo}`}_${timestampNome()}.db`
        let caminho: string | null = null
        try {
          caminho = await save({
            defaultPath: juntarCaminhoWindows(pastaPadrao, nomeSugerido),
            filters: [{ name: 'Banco de dados', extensions: ['db'] }],
          })
        } catch {
          caminho = null
        }
        if (!caminho) {
          setLoading(false)
          return
        }
        await invoke('criar_backup_personalizado', { caminho, parte, userId })
        setMessage(`Backup salvo em: ${caminho}`)
      }
      setModalBackupAberto(false)
      loadBackups()
      loadSettings()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleValidateBackup(backupId: number) {
    try {
      const valid = await invoke<boolean>('validar_backup', { backupId })
      loadBackups()
      if (valid) {
        setMessage('Backup válido!')
      } else {
        setError('Backup corrompido ou arquivo não encontrado.')
      }
    } catch (err) {
      setError(String(err))
    }
  }

  async function handleDeleteBackup(backupId: number) {
    if (!confirm('Tem certeza que deseja excluir este backup?')) return
    try {
      await invoke('deletar_backup', { backupId })
      setMessage('Backup excluído.')
      loadBackups()
    } catch (err) {
      setError(String(err))
    }
  }

  async function handleImportBackup() {
    try {
      let caminho: string | null = null

      if (estaNoNavegador()) {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.db'
        const arquivo = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] ?? null)
          input.click()
        })
        if (!arquivo) return
        setLoading(true)
        setError('')
        const upload = await enviarUploadWeb(arquivo)
        if (!upload.ok) {
          setError(upload.erro || 'Erro ao enviar o arquivo.')
          setLoading(false)
          return
        }
        caminho = upload.caminho ?? null
      } else {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Backups (.db)', extensions: ['db'] }],
          title: 'Selecione o arquivo de backup (.db)',
        })
        if (!selected || typeof selected !== 'string') return
        caminho = selected
      }

      if (!caminho) return
      setLoading(true)
      setError('')
      try {
        const result = await invoke<BackupInfo>('importar_backup', { userId, caminho })
        setMessage(`Backup '${result.filename}' importado com sucesso!`)
        loadBackups()
        loadSettings()
        if (confirm(`Backup importado com sucesso!\n\nDeseja restaurar os dados deste backup agora?`)) {
          setRestoreConfirm(result.id)
          setRestoreDoubleConfirm('')
          setRestoreMode('replace')
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    } catch (err) {
      setError(String(err))
    }
  }

  async function handleRestoreBackup() {
    if (restoreDoubleConfirm !== 'CONFIRMAR') {
      setError('Digite CONFIRMAR para confirmar a restauração.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await invoke<string>('restaurar_backup', { backupId: restoreConfirm, userId, mode: restoreMode })
      setMessage(result)
      setRestoreConfirm(null)
      setRestoreDoubleConfirm('')
      setRestoreMode('replace')
      loadBackups()
      loadSettings()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateSettings() {
    if (!settings) return
    setLoading(true)
    setError('')
    try {
      await invoke('update_backup_settings', { settings })
      setMessage('Configurações salvas!')
      setShowSettings(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRunAutoBackup() {
    try {
      const result = await invoke<BackupInfo | null>('executar_backup_automatico')
      if (result) {
        setMessage('Backup automático executado!')
      } else {
        setMessage('Nenhum backup necessário no momento.')
      }
      loadBackups()
      loadSettings()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="space-y-8">
      {modalBackupAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!loading) setModalBackupAberto(false) }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Criar Backup</h3>
            <p className="text-sm text-muted-foreground">
              Escolha o que será exportado. Na próxima janela você escolhe onde salvar — já aberta na pasta padrão dessa categoria.
            </p>
            <select
              value={escopoSelecionado}
              onChange={(e) => setEscopoSelecionado(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent dark:border-gray-600"
            >
              {PARTES_BACKUP.map((p) => (
                <option key={p.valor} value={p.valor}>{p.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalBackupAberto(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBackupDoEscopo}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de backups do banco de dados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalBackupAberto(true)}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Criar Backup
          </button>
          <button
            onClick={handleImportBackup}
            disabled={loading}
            className="flex items-center gap-2 border dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Upload className="h-4 w-4" />
            Importar Backup
          </button>
          <button
            onClick={handleRunAutoBackup}
            className="flex items-center gap-2 border dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className="h-4 w-4" />
            Verificar Auto
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 border dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 ${showSettings ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
          >
            <Settings2 className="h-4 w-4" />
            Configurações
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 flex items-center gap-4">
          <Database className="h-8 w-8 text-blue-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total de Backups</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{backups.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 flex items-center gap-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Válidos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{backups.filter(b => b.is_valid).length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 flex items-center gap-4">
          <Clock className="h-8 w-8 text-gray-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Último Backup</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
              {settings?.last_backup_at
                ? new Date(settings.last_backup_at).toLocaleString('pt-BR')
                : 'Nunca'}
            </p>
          </div>
        </div>
      </div>

      {showSettings && settings && (
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateSettings() }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configurações de Backup Automático</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Backup Automático</label>
                <select
                  value={settings.auto_backup_enabled ? '1' : '0'}
                  onChange={e => setSettings({ ...settings, auto_backup_enabled: e.target.value === '1' })}
                  className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="1">Ativado</option>
                  <option value="0">Desativado</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Intervalo (horas)</label>
                <input autoComplete="off"
                  type="number"
                  min={1}
                  value={settings.backup_interval_hours}
                  onChange={e => setSettings({ ...settings, backup_interval_hours: parseInt(e.target.value) || 24 })}
                  className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Retenção (dias)</label>
                <input autoComplete="off"
                  type="number"
                  min={1}
                  value={settings.retention_days}
                  onChange={e => setSettings({ ...settings, retention_days: parseInt(e.target.value) || 30 })}
                  className="block w-full mt-1 border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="border dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lista de Backups</h2>
        </div>
        {backups.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500">
            <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum backup encontrado. Crie seu primeiro backup!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Validado</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate" title={backup.filename}>
                    {backup.filename}
                    {backup.notes?.startsWith('parte:') && (
                      <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        {backup.notes.replace('parte: ', '')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      backup.backup_type === 'auto'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : backup.backup_type === 'importado'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    }`}>
                      {backup.backup_type === 'auto' ? 'Automático' : backup.backup_type === 'importado' ? 'Importado' : 'Manual'}
                    </span>
                  </TableCell>
                  <TableCell>{formatBytes(backup.file_size)}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(backup.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-center">
                    {backup.is_valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 inline" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleValidateBackup(backup.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        title="Validar checksum"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setRestoreConfirm(backup.id); setRestoreDoubleConfirm(''); setRestoreMode('replace') }}
                        className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                        title="Restaurar"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {restoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restaurar Backup</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Escolha como deseja restaurar. Um backup de segurança será criado automaticamente antes da restauração.
            </p>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${restoreMode === 'replace' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                <input autoComplete="off"
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Substituir</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">Apaga os dados atuais e insere apenas as informações deste backup.</span>
                </span>
              </label>
              <label className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${restoreMode === 'merge' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                <input autoComplete="off"
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Acrescentar (mesclar)</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">Adiciona apenas o que ainda não existe no programa, mantendo os dados atuais.</span>
                </span>
              </label>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Digite <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-bold">CONFIRMAR</code> para prosseguir:
            </p>
            <input autoComplete="off"
              type="text"
              value={restoreDoubleConfirm}
              onChange={e => setRestoreDoubleConfirm(e.target.value)}
              className="block w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="CONFIRMAR"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRestoreConfirm(null); setRestoreDoubleConfirm('') }}
                className="border dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={loading || restoreDoubleConfirm !== 'CONFIRMAR'}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Restaurando...' : 'Restaurar Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

