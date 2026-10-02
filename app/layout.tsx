import './globals.css'
import { Poppins } from 'next/font/google'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { GlobalErrorLogger } from '@/components/layout/GlobalErrorLogger'
import { ToastProvider } from '@/lib/context/ToastContext'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cuidar ERP',
  description: 'Sistema de Gestão para Instituições Educacionais',
  icons: {
    icon: '/favicon.ico',
  },
}

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <ToastProvider>
          <ErrorBoundary>
            {children}
            <GlobalErrorLogger />
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  )
}
