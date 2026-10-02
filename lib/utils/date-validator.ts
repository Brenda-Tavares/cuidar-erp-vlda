/**
 * Validação Inteligente de Datas com suporte a Anos Bissextos
 * Arquivo: lib/utils/date-validator.ts
 */

/**
 * Verifica se um ano é bissexto
 * Regras:
 * - Divisível por 4 = bissexto
 * - Divisível por 100 = NÃO bissexto (exceção)
 * - Divisível por 400 = bissexto (exceção da exceção)
 */
export function isAnoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
}

/**
 * Retorna o número máximo de dias em um mês
 */
export function getDiasDoMes(mes: number, ano: number): number {
  const mesesCom31Dias = [1, 3, 5, 7, 8, 10, 12]
  const mesesCom30Dias = [4, 6, 9, 11]

  if (mesesCom31Dias.includes(mes)) return 31
  if (mesesCom30Dias.includes(mes)) return 30
  if (mes === 2) return isAnoBissexto(ano) ? 29 : 28
  return 0
}

/**
 * Valida e corrige uma data inserida pelo usuário
 * Aceita: "DD/MM/YYYY" ou "DD-MM-YYYY"
 * 
 * Exemplos:
 * - "30/02/2024" → "29/02/2024" (bissexto)
 * - "30/02/2025" → "28/02/2025" (não bissexto)
 * - "31/04/2024" → "30/04/2024" (abril tem 30 dias)
 * - "31/13/2024" → invalid (mês inválido)
 */
export function validarECorrigirData(dataStr: string): {
  valido: boolean
  data: string | null
  erro?: string
  corrigido: boolean
} {
  if (!dataStr || typeof dataStr !== 'string') {
    return { valido: false, data: null, erro: 'Data inválida', corrigido: false }
  }

  const separador = dataStr.includes('-') ? '-' : '/'
  const partes = dataStr.split(separador)

  if (partes.length !== 3) {
    return { valido: false, data: null, erro: 'Formato inválido (use DD/MM/YYYY)', corrigido: false }
  }

  let dia = parseInt(partes[0], 10)
  let mes = parseInt(partes[1], 10)
  let ano = parseInt(partes[2], 10)

  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
    return { valido: false, data: null, erro: 'Data contém números inválidos', corrigido: false }
  }

  if (mes < 1 || mes > 12) {
    return { valido: false, data: null, erro: `Mês inválido: ${mes}`, corrigido: false }
  }

  const diasDoMes = getDiasDoMes(mes, ano)
  let corrigido = false

  if (dia < 1) {
    return { valido: false, data: null, erro: `Dia inválido: ${dia}`, corrigido: false }
  }

  if (dia > diasDoMes) {
    dia = diasDoMes
    corrigido = true
  }

  if (ano < 1900 || ano > 2100) {
    return { valido: false, data: null, erro: `Ano inválido: ${ano}`, corrigido: false }
  }

  const diaFormatado = String(dia).padStart(2, '0')
  const mesFormatado = String(mes).padStart(2, '0')
  const dataCorrigida = `${diaFormatado}${separador}${mesFormatado}${separador}${ano}`

  return {
    valido: true,
    data: dataCorrigida,
    corrigido,
    erro: corrigido ? `Data corrigida: ${partes.join(separador)} → ${dataCorrigida}` : undefined,
  }
}

/**
 * Converte data do formato DD/MM/YYYY para YYYY-MM-DD (ISO)
 */
export function dataParaISO(dataStr: string): string {
  const separador = dataStr.includes('-') ? '-' : '/'
  const [dia, mes, ano] = dataStr.split(separador)
  return `${ano}-${mes}-${dia}`
}

/**
 * Converte data do formato YYYY-MM-DD para DD/MM/YYYY
 */
export function isoParaData(isoStr: string): string {
  const [ano, mes, dia] = isoStr.split('-')
  return `${dia}/${mes}/${ano}`
}

