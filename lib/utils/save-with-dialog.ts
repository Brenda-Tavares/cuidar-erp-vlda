import { save } from '@tauri-apps/plugin-dialog'
import { invoke, estaNoNavegador } from '@/lib/tauri-invoke'

type FileFilter = { name: string; extensions: string[] }

const FILTRO_PDF: FileFilter[] = [{ name: 'PDF', extensions: ['pdf'] }]
const FILTRO_XLSX: FileFilter[] = [{ name: 'Excel', extensions: ['xlsx'] }]
const FILTRO_CSV: FileFilter[] = [{ name: 'CSV', extensions: ['csv'] }]

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

async function salvarComDialog(
  conteudo: Uint8Array,
  nomeSugerido: string,
  filtros: FileFilter[]
): Promise<string | null> {
  if (estaNoNavegador()) {
    baixarArquivo(conteudo, nomeSugerido)
    return nomeSugerido
  }
  try {
    const path = await save({
      defaultPath: nomeSugerido,
      filters: filtros,
    })
    if (!path) return null
    await invoke('salvar_arquivo_em', {
      caminho: path,
      conteudo: Array.from(conteudo),
    })
    return path
  } catch {
    return null
  }
}

export async function salvarPDF(buffer: Uint8Array, nome: string) {
  return salvarComDialog(buffer, nome, FILTRO_PDF)
}

export async function salvarXLSX(buffer: Uint8Array, nome: string) {
  return salvarComDialog(buffer, nome, FILTRO_XLSX)
}

export async function salvarCSV(buffer: Uint8Array, nome: string) {
  return salvarComDialog(buffer, nome, FILTRO_CSV)
}