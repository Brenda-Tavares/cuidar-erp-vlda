export interface EscalaTrabalho {
  id: number
  nome: string
  dias_semana: string
  hora_entrada: string
  hora_saida: string
  descricao: string | null
  status: 'ativo' | 'inativo'
}
