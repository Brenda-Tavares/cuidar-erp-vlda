'use client'

import { useEffect } from 'react'
import { invoke } from '@/lib/tauri-invoke'

export function GlobalErrorLogger() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      try {
        invoke('log_frontend_error', {
          message: event.message || 'window.onerror (sem mensagem)',
          stack: event.error?.stack ? String(event.error.stack) : undefined,
        }).catch(() => {})
      } catch {
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : JSON.stringify(reason) || 'unhandledrejection (sem detalhes)'
        invoke('log_frontend_error', {
          message: `Promise rejeitada: ${message}`,
          stack: reason instanceof Error ? reason.stack : undefined,
        }).catch(() => {})
      } catch {
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
