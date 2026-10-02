'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Building2, Save } from 'lucide-react'
import { useState } from 'react'

interface CrecheData {
  nome: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
}

export default function ConfigPage() {
  const [data] = useState<CrecheData>({
    nome: 'Instituição Educacional Municipal Pequeno Aprender',
    cnpj: '12.345.678/0001-90',
    endereco: 'Rua das Flores, 123 - Centro',
    telefone: '(71) 99999-8888',
    email: 'contato@pequenoaprender.com.br',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados da instituição
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2.5 text-indigo-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Dados da Instituição</CardTitle>
              <CardDescription>
                Informações cadastrais da instituição
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nome da Instituição
              </label>
              <input autoComplete="off"
                defaultValue={data.nome}
                placeholder="Nome da instituição"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                CNPJ
              </label>
              <input autoComplete="off"
                defaultValue={data.cnpj}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Telefone
              </label>
              <input autoComplete="off"
                defaultValue={data.telefone}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Endereço
              </label>
              <input autoComplete="off"
                defaultValue={data.endereco}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                E-mail
              </label>
              <input autoComplete="off"
                type="email"
                defaultValue={data.email}
                placeholder="email@instituicao.com.br"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

