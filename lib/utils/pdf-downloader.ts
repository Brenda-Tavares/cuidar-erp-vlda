/**
 * PDF Download Utility com suporte a "Save As" nativo do Tauri
 */

import type { JSPDFInstance } from './pdf-generator'
import { salvarPDF } from './save-with-dialog'

export interface PDFExportOptions {
  titulo: string
  periodo?: string
}

export async function downloadPDF(pdf: JSPDFInstance, opcoes: PDFExportOptions) {
  const nomeArquivo = `${opcoes.titulo.replace(/\s/g, '_')}.pdf`
  
  try {
    const blob = pdf.output('blob')
    const buffer = await blob.arrayBuffer()
    const path = await salvarPDF(new Uint8Array(buffer), nomeArquivo)
    if (path) {
      return true
    }
    return false
  } catch (error) {
    console.error('Erro ao salvar PDF:', error)
    return false
  }
}
