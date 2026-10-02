export interface Cargo {
  id: number
  nome: string
  descricao: string | null
  salario_base: number | null
  status: 'ativo' | 'inativo'
}

