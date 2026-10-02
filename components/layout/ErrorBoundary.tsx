'use client'

import React, { ReactNode, ErrorInfo } from 'react'
import { invoke } from '@/lib/tauri-invoke'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })

    try {
      invoke('log_frontend_error', {
        message: `[ErrorBoundary] ${error.message}`,
        stack: `${error.stack ?? 'sem stack'}\n${errorInfo.componentStack ?? ''}`,
      }).catch(() => {})
    } catch {
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Oops! Algo deu errado</h1>
              <p className="text-gray-600 text-center mb-4">
                Desculpe, um erro inesperado ocorreu. Por favor, tente recarregar a página ou volte para o dashboard.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 p-4 bg-gray-100 rounded text-sm">
                  <summary className="font-semibold cursor-pointer text-gray-900 mb-2">Detalhes do Erro (Dev)</summary>
                  <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
