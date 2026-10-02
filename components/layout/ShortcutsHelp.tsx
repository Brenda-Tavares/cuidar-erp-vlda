'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  description: string
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['?'], description: 'Abrir esta ajuda de atalhos' },
  { keys: ['Ctrl', 'N'], description: 'Novo registro (alunos, turmas, etc.)' },
  { keys: ['Ctrl', 'S'], description: 'Salvar formulário atual' },
  { keys: ['Ctrl', 'K'], description: 'Busca rápida / comandos' },
  { keys: ['Esc'], description: 'Fechar modal / cancelar' },
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Pressione os atalhos abaixo para navegar mais rápido
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.description}</span>
              <div className="flex gap-1">
                {item.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="px-2 py-0.5 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
