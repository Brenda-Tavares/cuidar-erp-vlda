import { invoke, estaNoNavegador } from '@/lib/tauri-invoke'
import { save } from '@tauri-apps/plugin-dialog'

export type CategoriaExportacao =
  | 'relatorios_alunos'
  | 'relatorios_frequencia'
  | 'relatorios_funcionarios'
  | 'relatorios_financeiros'
  | 'relatorios_financeiros_alunos'
  | 'relatorios_ocorrencias'
  | 'relatorios_audit_log'
  | 'comprovantes_despesas'
  | 'comprovantes_receitas'

type FileFilter = { name: string; extensions: string[] }

const FILTROS_POR_EXTENSAO: Record<string, FileFilter[]> = {
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  xlsx: [{ name: 'Excel', extensions: ['xlsx'] }],
  csv: [{ name: 'CSV', extensions: ['csv'] }],
}

function extensaoDe(nomeArquivo: string): string {
  const i = nomeArquivo.lastIndexOf('.')
  return i >= 0 ? nomeArquivo.slice(i + 1).toLowerCase() : ''
}

/** Junta pasta + nome de arquivo com separador Windows, sem duplicar barras. */
function juntarCaminhoWindows(pasta: string, arquivo: string): string {
  return `${pasta.replace(/[\\/]+$/, '')}\\${arquivo}`
}

function baixarArquivo(conteudo: Uint8Array, nome: string) {
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

/**
 * Exporta um arquivo abrindo o diálogo "Salvar como" JÁ posicionado na pasta
 * padrão da categoria (Documentos\Cuidar-ERP\...). Retorna o caminho salvo
 * ou null se o usuário cancelar.
 */
export async function exportarParaPasta(
  categoria: CategoriaExportacao,
  nomeArquivo: string,
  conteudo: Blob | ArrayBuffer
): Promise<string | null> {
  const buffer = conteudo instanceof Blob
    ? await conteudo.arrayBuffer()
    : conteudo
  const conteudoUint8 = new Uint8Array(buffer)

  if (estaNoNavegador()) {
    baixarArquivo(conteudoUint8, nomeArquivo)
    return nomeArquivo
  }

  try {
    const pastaPadrao = await invoke<string>('obter_pasta_exportacao', { categoria })
    let caminho: string | null = null
    try {
      caminho = await save({
        defaultPath: juntarCaminhoWindows(pastaPadrao, nomeArquivo),
        filters: FILTROS_POR_EXTENSAO[extensaoDe(nomeArquivo)] ?? [],
      })
    } catch {
      caminho = null
    }
    if (!caminho) return null

    await invoke('salvar_arquivo_em', {
      caminho,
      conteudo: Array.from(conteudoUint8),
    })
    return caminho
  } catch (error) {
    console.error('Erro ao exportar arquivo:', error)
    return null
  }
}

export async function abrirPasta(caminho: string): Promise<void> {
  await invoke('abrir_pasta_no_explorador', { caminho })
}

export async function inicializarPastas(): Promise<void> {
  try {
    await invoke('inicializar_estrutura_pastas')
  } catch (error) {
    console.error('Erro ao inicializar pastas:', error)
  }
}
