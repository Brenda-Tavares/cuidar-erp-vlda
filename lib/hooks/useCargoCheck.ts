'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri-invoke'

interface Cargo {
  id: number
  nome: string
  descricao: string | null
  salario_base: number | null
  status: string
}

interface UseCargoCheckResult {
  cargosCount: number
  isLoading: boolean
  error: string | null
  cargos: Cargo[]
  refetch: () => void
}

export function useCargoCheck(): UseCargoCheckResult {
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCargos = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await invoke<Cargo[]>('listar_cargos')
      setCargos(result || [])
    } catch (err) {
      console.error('Erro ao carregar cargos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar cargos')
      setCargos([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCargos()
  }, [])

  return {
    cargosCount: cargos.length,
    isLoading,
    error,
    cargos,
    refetch: fetchCargos,
  }
}
