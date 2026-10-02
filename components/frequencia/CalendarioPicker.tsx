'use client'

import { useEffect, useRef, useState } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type PickerMode = 'date' | 'month' | 'year'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatValue(mode: PickerMode, value: Date): string {
  if (mode === 'date') {
    return value.toLocaleDateString('pt-BR')
  }
  if (mode === 'month') {
    return `${MESES[value.getMonth()]}/${value.getFullYear()}`
  }
  return String(value.getFullYear())
}

interface CalendarioPickerProps {
  mode: PickerMode
  value: Date
  onChange: (date: Date) => void
  placeholder?: string
  className?: string
}

export default function CalendarioPicker({ mode, value, onChange, placeholder, className }: CalendarioPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (v: Date) => {
    onChange(v)
    setOpen(false)
  }

  const view = mode === 'date' ? 'month' : mode === 'month' ? 'year' : 'decade'
  const maxDetail = mode === 'date' ? 'month' : mode === 'month' ? 'year' : 'decade'
  const minDetail = mode === 'date' ? 'month' : mode === 'month' ? 'year' : 'decade'

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-[90px] text-left">{formatValue(mode, value)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 rounded-xl border border-border bg-card p-2 shadow-xl dark:shadow-black/40 erp-calendar">
          <Calendar
            value={value}
            view={view}
            minDetail={minDetail as 'month' | 'year' | 'decade'}
            maxDetail={maxDetail as 'month' | 'year' | 'decade'}
            onClickMonth={(v: Date) => handleChange(v)}
            onClickYear={(v: Date) => handleChange(v)}
            onChange={(v) => {
              if (mode === 'date' && v) handleChange(v as Date)
            }}
            locale="pt-BR"
          />
        </div>
      )}
      {placeholder && !value && <span className="sr-only">{placeholder}</span>}
    </div>
  )
}