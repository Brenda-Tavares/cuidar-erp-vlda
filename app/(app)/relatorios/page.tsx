'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, BarChart3, Briefcase, DollarSign, Users } from 'lucide-react'
import Link from 'next/link'

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Visualize relatórios e análises da instituição educacional
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Alunos */}
        <Link href="/relatorios/alunos" className="group">
          <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alunos</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Dados cadastrais e distribuição por turma
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Frequência */}
        <Link href="/relatorios/frequencia" className="group">
          <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Frequência</CardTitle>
              <BarChart3 className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Relatório de presença dos alunos por período e turma
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Financeiro */}
        <Link href="/relatorios/financeiro" className="group">
          <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Financeiro</CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Resumo de receitas, mensalidades pendentes e histórico
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Funcionários */}
        <Link href="/relatorios/funcionarios" className="group">
          <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Funcionários</CardTitle>
              <Briefcase className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Lista completa de funcionários, cargos e dados cadastrais
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 5: Ocorrências */}
        <Link href="/relatorios/ocorrencias" className="group">
          <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ocorrências</CardTitle>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Histórico de ocorrências reportadas por aluno e período
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
