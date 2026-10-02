const REDE_TOKEN_KEY = 'cuidar_erp_rede_token'

let moduloTauri: typeof import('@tauri-apps/api/core') | null = null

async function invokeTauri<T>(cmd: string, args: Record<string, unknown> | undefined): Promise<T> {
  if (!moduloTauri) {
    moduloTauri = await import('@tauri-apps/api/core')
  }
  return moduloTauri.invoke<T>(cmd, args)
}

export function estaNoNavegador(): boolean {
  return typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)
}

function baixarBytes(conteudo: Uint8Array, nome: string) {
  const blob = new Blob([conteudo])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!estaNoNavegador()) {
    return invokeTauri<T>(cmd, args)
  }

  if (cmd === 'abrir_pasta_no_explorador') {
    return undefined as T
  }
  if (cmd === 'get_ip_local') {
    return window.location.hostname as T
  }
  if (cmd === 'listar_ips_locais') {
    return [window.location.hostname] as T
  }
  if (cmd === 'salvar_arquivo_na_pasta') {
    const nome = (args?.nome_arquivo as string) || 'arquivo'
    const conteudo = (args?.conteudo as number[] | Uint8Array | undefined) ?? []
    baixarBytes(new Uint8Array(conteudo), nome)
    return nome as T
  }

  const token = localStorage.getItem(REDE_TOKEN_KEY)
  const resposta = await fetch('/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ comando: cmd, argumentos: args ?? {} }),
  })
  const dados: { ok: boolean; dados?: T; erro?: string } = await resposta.json()

  if (!dados.ok) {
    if (dados.erro === 'Não autenticado. Faça login novamente.') {
      localStorage.removeItem(REDE_TOKEN_KEY)
      localStorage.removeItem('cuidar_erp_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    throw new Error(dados.erro || 'Erro ao comunicar com o servidor')
  }

  if (
    cmd === 'login' &&
    dados.dados &&
    typeof dados.dados === 'object' &&
    'web_token' in (dados.dados as object)
  ) {
    const tokenWeb = (dados.dados as { web_token?: string }).web_token
    if (tokenWeb) {
      localStorage.setItem(REDE_TOKEN_KEY, tokenWeb)
    }
  }
  if (cmd === 'logout') {
    localStorage.removeItem(REDE_TOKEN_KEY)
  }

  return dados.dados as T
}

export async function enviarUploadWeb(
  arquivo: File
): Promise<{ ok: boolean; caminho?: string; erro?: string }> {
  const token = localStorage.getItem(REDE_TOKEN_KEY)
  const form = new FormData()
  form.append('arquivo', arquivo)
  const resposta = await fetch('/upload', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })
  return resposta.json()
}