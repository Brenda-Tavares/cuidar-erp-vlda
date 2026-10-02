'use client'

import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function formatCentavos(centavos: number): string {
  const reais = centavos / 100
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function CurrencyInput({ value, onChange, placeholder, className, disabled }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value === 0) {
      setDisplayValue('')
    } else {
      const centavos = Math.round(value * 100)
      setDisplayValue(formatCentavos(centavos))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')

    if (digits === '') {
      setDisplayValue('')
      onChange(0)
      return
    }

    const centavos = parseInt(digits, 10)
    setDisplayValue(formatCentavos(centavos))
    onChange(centavos / 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()

      const digits = displayValue.replace(/\D/g, '')
      if (digits.length > 0) {
        const newDigits = digits.slice(0, -1)
        if (newDigits === '') {
          setDisplayValue('')
          onChange(0)
        } else {
          const centavos = parseInt(newDigits, 10)
          setDisplayValue(formatCentavos(centavos))
          onChange(centavos / 100)
        }
      }
    }
  }

  return (
    <input autoComplete="off"
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder || '0,00'}
      className={className}
      disabled={disabled}
    />
  )
}

