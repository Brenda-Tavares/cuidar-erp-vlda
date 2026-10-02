'use client'

import { useEffect } from 'react'

type ShortcutHandler = () => void

export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  handler: ShortcutHandler
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  deps: React.DependencyList = []
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isInput = (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable
      )

      if (!e.key) return

      for (const s of shortcuts) {
        const ctrlOrCmd = s.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey
        const keyMatch = e.key && s.key && e.key.toLowerCase() === s.key.toLowerCase()

        if (ctrlOrCmd && shiftMatch && altMatch && keyMatch) {
          if (s.ctrl && isInput) continue
          e.preventDefault()
          s.handler()
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, deps)
}
