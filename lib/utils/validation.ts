/**
 * Form Validation Utilities
 * Senior-grade validation functions for CPF, phone, email, dates, and text fields
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validates Brazilian CPF format and calculus
 * Blocks: all zeros, all same digits, invalid format
 */
export function validateCPF(cpf: string): ValidationResult {
  if (!cpf) return { isValid: false, error: 'CPF é obrigatório' }

  const cleaned = cpf.replace(/\D/g, '')

  if (cleaned.length !== 11) {
    return { isValid: false, error: 'CPF deve ter 11 dígitos' }
  }

  if (/^(\d)\1{10}$/.test(cleaned)) {
    return { isValid: false, error: 'CPF inválido' }
  }

  let sum = 0
  let remainder = 0

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0

  if (remainder !== parseInt(cleaned.substring(9, 10))) {
    return { isValid: false, error: 'CPF inválido' }
  }

  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0

  if (remainder !== parseInt(cleaned.substring(10, 11))) {
    return { isValid: false, error: 'CPF inválido' }
  }

  return { isValid: true }
}

/**
 * Validates Brazilian phone number
 * Format: (XX) XXXXX-XXXX — 11 dígitos (DDD + 9)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { isValid: false, error: 'Telefone é obrigatório' }

  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length !== 11) {
    return { isValid: false, error: 'Telefone deve ter 11 dígitos, ex: (48) 99999-9999' }
  }

  if (cleaned[0] === '0' || cleaned[0] === '1') {
    return { isValid: false, error: 'Telefone inválido' }
  }

  const areaCode = parseInt(cleaned.substring(0, 2))
  if (areaCode < 11 || areaCode > 99) {
    return { isValid: false, error: 'DDD inválido' }
  }

  if (cleaned[2] !== '9') {
    return { isValid: false, error: 'Telefone celular deve começar com 9 após o DDD, ex: (48) 99999-9999' }
  }

  return { isValid: true }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { isValid: false, error: 'Email é obrigatório' }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Email inválido' }
  }

  if (email.length > 255) {
    return { isValid: false, error: 'Email muito longo' }
  }

  return { isValid: true }
}

/**
 * Validates date of birth
 * Rules: must be in past, min age 0, max age 120
 */
export function validateDateOfBirth(dateStr: string): ValidationResult {
  if (!dateStr) return { isValid: false, error: 'Data de nascimento é obrigatória' }

  const date = new Date(dateStr)

  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Data inválida' }
  }

  const today = new Date()
  if (date > today) {
    return { isValid: false, error: 'Data de nascimento não pode ser no futuro' }
  }

  const age = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    const calculatedAge = age - 1
    if (calculatedAge < 0) {
      return { isValid: false, error: 'Data de nascimento inválida' }
    }
  }

  if (age > 120) {
    return { isValid: false, error: 'Data de nascimento inválida' }
  }

  return { isValid: true }
}

/**
 * Validates text length
 */
export function validateTextLength(text: string, min: number = 1, max: number = 500): ValidationResult {
  if (!text || text.trim().length === 0) {
    return { isValid: false, error: `Campo é obrigatório` }
  }

  if (text.length < min) {
    return { isValid: false, error: `Mínimo de ${min} caracteres` }
  }

  if (text.length > max) {
    return { isValid: false, error: `Máximo de ${max} caracteres` }
  }

  return { isValid: true }
}

/**
 * Validates name field (Portuguese names)
 * Rules: min 2 chars, max 100 chars, only letters and spaces
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Nome é obrigatório' }
  }

  if (name.length < 2) {
    return { isValid: false, error: 'Nome deve ter pelo menos 2 caracteres' }
  }

  if (name.length > 100) {
    return { isValid: false, error: 'Nome pode ter no máximo 100 caracteres' }
  }

  if (!/^[a-zA-Z\s\-áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$/.test(name)) {
    return { isValid: false, error: 'Nome pode conter apenas letras, espaços e hífens' }
  }

  return { isValid: true }
}

/**
 * Validates required field
 */
export function validateRequired(value: string | number | undefined, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '' || value === 0) {
    return { isValid: false, error: `${fieldName} é obrigatório` }
  }

  return { isValid: true }
}

/**
 * Formats CPF to display format: XXX.XXX.XXX-XX
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Formats phone to display format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}
