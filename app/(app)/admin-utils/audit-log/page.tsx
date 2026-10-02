'use client'

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { Search, Filter, X, Download, Eye, ChevronLeft, ChevronRight, AlertCircle, ShieldCheck } from 'lucide-react'
import { exportarParaPasta } from '@/lib/utils/export-manager'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface AuditLog {
  id: number
  user_id: number | null
  username: string | null
  action: string
  table_name: string | null
  record_id: number | null
  old_values: string | null
  new_values: string | null
  description: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface AuditLogStats {
  total_logs: number
  logs_por_action: [string, number][]
  logs_por_tabela: [string, number][]
  periodo_dias: number
}

interface FilterState {
  action: string
  table_name: string
  search: string
  periodo: number
}

const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT']
const TABLES = ['', 'alunos', 'funcionarios', 'mensalidades', 'company_expenses', 'company_revenues', 'arquivos', 'turmas', 'cargos', 'servicos']

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  EXPORT: 'bg-orange-100 text-orange-800',
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatJson(jsonStr: string | null): string {
  if (!jsonStr) return ''
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2)
  } catch {
    return jsonStr
  }
}

function highlightDiff(oldV: string | null, newV: string | null) {
  const oldObj = oldV ? tryParse(oldV) : null
  const newObj = newV ? tryParse(newV) : null
  if (!oldObj && !newObj) return null

  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])
  const rows: JSX.Element[] = []

  keys.forEach((key) => {
    const oldVal = oldObj?.[key]
    const newVal = newObj?.[key]
    const changed = oldVal !== newVal
    rows.push(
      <tr key={key} className={changed ? 'bg-yellow-50' : ''}>
        <td className="px-3 py-1.5 text-sm font-mono text-gray-600 border-b">{key}</td>
        <td className="px-3 py-1.5 text-sm font-mono border-b">
          <span className={changed ? 'line-through text-red-600' : 'text-gray-800'}>{String(oldVal ?? '—')}</span>
        </td>
        <td className="px-3 py-1.5 text-sm font-mono border-b">
          <span className={changed ? 'text-green-700 font-semibold' : 'text-gray-800'}>{String(newVal ?? '—')}</span>
        </td>
      </tr>
    )
  })

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50">
          <th className="px-3 py-1.5 text-left font-semibold text-gray-600 border-b">Campo</th>
          <th className="px-3 py-1.5 text-left font-semibold text-red-600 border-b">Valor Antigo</th>
          <th className="px-3 py-1.5 text-left font-semibold text-green-600 border-b">Valor Novo</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  )
}

function tryParse(str: string): Record<string, unknown> | null {
  try { return JSON.parse(str) } catch { return null }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditLogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<FilterState>({ action: '', table_name: '', search: '', periodo: 7 })
  const [page, setPage] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const PER_PAGE = 50

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data_inicio = new Date(Date.now() - filters.periodo * 86400000).toISOString().replace('T', ' ').substring(0, 19)
      const filter: Record<string, unknown> = {}
      if (filters.action) filter.action = filters.action
      if (filters.table_name) filter.table_name = filters.table_name
      if (filters.search) filter.search = filters.search
      filter.data_inicio = data_inicio

      const [result, statsResult] = await Promise.all([
        invoke<AuditLog[]>('listar_audit_logs', { filter }),
        invoke<AuditLogStats>('get_audit_log_stats', { dias: filters.periodo }),
      ])
      setLogs(result)
      setStats(statsResult)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [filters.action, filters.table_name, filters.search, filters.periodo])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(logs.length / PER_PAGE)
  const paginatedLogs = logs.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  function clearFilters() {
    setFilters({ action: '', table_name: '', search: '', periodo: 7 })
    setPage(0)
  }

  async function exportCSV() {
    const headers = ['Código', 'Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Registro', 'Descrição']
    const rows = logs.map(l => [
      l.id, l.created_at, l.username || 'Sistema', l.action,
      l.table_name || '', l.record_id ?? '', l.description || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const nomeArquivo = `audit_log_${filters.periodo}dias.csv`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    await exportarParaPasta('relatorios_audit_log', nomeArquivo, blob)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Log do Sistema</h1>
          <p className="text-muted-foreground mt-1">Rastreabilidade de ações críticas no sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total de Logs</p>
          <p className="text-2xl font-bold mt-1">{stats?.total_logs ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Últimos {filters.periodo} dias</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Ação Mais Frequente</p>
          <p className="text-2xl font-bold mt-1">
            {stats?.logs_por_action?.[0]?.[0] ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats?.logs_por_action?.[0]?.[1] ?? 0} ocorrências
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Tabela Mais Modificada</p>
          <p className="text-2xl font-bold mt-1">
            {stats?.logs_por_tabela?.[0]?.[0] ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats?.logs_por_tabela?.[0]?.[1] ?? 0} registros
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Tipos de Ação</p>
          <div className="mt-1 space-y-1">
            {stats?.logs_por_action?.slice(0, 3).map(([a, c]) => (
              <div key={a} className="flex justify-between text-sm">
                <span className="text-gray-600">{a}</span>
                <span className="font-semibold">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium">Filtros</span>
          </div>

          <select
            value={filters.action}
            onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0) }}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900"
          >
            {ACTIONS.map(a => (
              <option key={a} value={a}>{a || 'Todas as Ações'}</option>
            ))}
          </select>

          <select
            value={filters.table_name}
            onChange={e => { setFilters(f => ({ ...f, table_name: e.target.value })); setPage(0) }}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900"
          >
            {TABLES.map(t => (
              <option key={t} value={t}>{t || 'Todas as Tabelas'}</option>
            ))}
          </select>

          <select
            value={filters.periodo}
            onChange={e => { setFilters(f => ({ ...f, periodo: Number(e.target.value) })); setPage(0) }}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900"
          >
            <option value={1}>Último dia</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input autoComplete="off"
              type="text"
              placeholder="Buscar na descrição..."
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0) }}
              className="border rounded-lg pl-9 pr-3 py-1.5 text-sm w-full bg-white text-gray-900"
            />
          </div>

          <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Limpar
          </button>

          <button onClick={exportCSV} className="ml-auto text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Nenhum log encontrado para os filtros aplicados.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>{log.username || 'Sistema'}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.table_name || '—'}</TableCell>
                    <TableCell>{log.record_id ?? '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.description || '—'}</TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-sm text-gray-500">
                Mostrando {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, logs.length)} de {logs.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">{page + 1}/{totalPages || 1}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Detalhes do Log #{selectedLog.id}</h2>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Data/Hora</p>
                  <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Ação</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[selectedLog.action] || 'bg-gray-100 text-gray-800'}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Usuário</p>
                  <p className="font-medium">{selectedLog.username || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Entidade / Código</p>
                  <p className="font-medium font-mono">{selectedLog.table_name || '—'} / {selectedLog.record_id ?? '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Descrição</p>
                  <p className="font-medium">{selectedLog.description || '—'}</p>
                </div>
              </div>

              {(selectedLog.old_values || selectedLog.new_values) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Alterações (Diferenças)</h3>
                  {highlightDiff(selectedLog.old_values, selectedLog.new_values) ?? (
                    <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                      {formatJson(selectedLog.new_values || selectedLog.old_values)}
                    </pre>
                  )}
                </div>
              )}

              {!selectedLog.old_values && !selectedLog.new_values && (
                <p className="text-sm text-gray-400 italic">Nenhum dado adicional registrado para esta ação.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

