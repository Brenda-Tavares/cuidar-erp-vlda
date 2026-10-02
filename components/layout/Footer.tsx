import { branding } from '@/config/branding'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-3 px-6">
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© {branding.ano} · {branding.desenvolvedor}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Todos os direitos reservados</p>
      </div>
    </footer>
  )
}
