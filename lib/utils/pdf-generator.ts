export type JSPDFInstance = import('jspdf').default

let _jsPDF: typeof import('jspdf').default | null = null

export async function getJSDP(): Promise<typeof import('jspdf').default> {
  if (!_jsPDF) {
    const mod = await import('jspdf')
    _jsPDF = mod.default
  }
  return _jsPDF!
}

export async function createDoc(): Promise<JSPDFInstance> {
  const jsPDF = await getJSDP()
  return new jsPDF()
}

export async function autoTable(doc: JSPDFInstance, options: Record<string, unknown>): Promise<void> {
  const mod = await import('jspdf-autotable')
  mod.default(doc, options)
}

