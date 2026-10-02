/**
 * Utilitário seguro para formatação de datas
 * Validações incluídas para evitar Invalid Date errors
 */

/**
 * Formata data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY)
 * Com validação de entrada
 */
export function formatDataBR(dateStr: string | undefined | null): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return '-'
  }

  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr
    }

    const parts = dateStr.split('-')
    if (parts.length !== 3 || parts[0].length !== 4) {
      return dateStr // Retorna original se não conseguir parsear
    }

    const [year, month, day] = parts
    
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    const d = parseInt(day, 10)

    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      return dateStr
    }

    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
  } catch {
    return dateStr || '-'
  }
}

/**
 * Converte string de data para Date object com fallback seguro
 */
export function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null
  }

  try {
    const date = new Date(dateStr + 'T00:00:00Z')
    
    if (isNaN(date.getTime())) {
      return null
    }

    return date
  } catch {
    return null
  }
}

/**
 * Formata data para exibição em tabelas e gráficos
 */
export function formatDataExibicao(dateStr: string | undefined | null): string {
  const date = parseDate(dateStr)
  if (!date) {
    return '-'
  }

  try {
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '-'
  }
}

/**
 * Formata valor monetário
 */
export function formatMoeda(valor: number | undefined | null): string {
  if (typeof valor !== 'number' || isNaN(valor)) {
    return 'R$ 0,00'
  }

  try {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  } catch {
    return `R$ ${valor.toFixed(2)}`
  }
}

/**
 * Formata percentual com limite de casas decimais
 */
export function formatPercentual(valor: number | undefined | null, casas: number = 2): string {
  if (typeof valor !== 'number' || isNaN(valor)) {
    return '0%'
  }

  try {
    return `${valor.toFixed(casas)}%`
  } catch {
    return '0%'
  }
}

/**
 * Valida se string é data válida em formato ISO
 */
export function isValidDateISO(dateStr: string): boolean {
  if (typeof dateStr !== 'string') {
    return false
  }

  const parts = dateStr.split('-')
  if (parts.length !== 3) {
    return false
  }

  const [year, month, day] = parts
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)

  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}
