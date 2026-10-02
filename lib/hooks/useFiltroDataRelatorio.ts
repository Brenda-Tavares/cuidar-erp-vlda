'use client'

import { useState } from 'react'

export function useFiltroDataRelatorio(_relatorioType: string = 'default') {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [dataInicio, setDataInicio] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState<string>(today.toISOString().split('T')[0])
  const [usarFiltro, setUsarFiltro] = useState<boolean>(false)

  return {
    dataInicio,
    dataFim,
    usarFiltro,
    setDataInicio,
    setDataFim,
    setUsarFiltro,
  }
}
