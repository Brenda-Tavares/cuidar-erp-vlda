import Link from 'next/link';
import { branding } from '@/config/branding'

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md space-y-6 p-6">
        <h1 className="text-2xl font-bold text-gray-800">Sobre o Sistema</h1>
        <p className="text-gray-700">
          Cuidar ERP é um sistema de gestão para creches desenvolvido para atender às necessidades
          de pequenas instituições de ensino infantil. Ele permite o controle de alunos, turmas,
          responsáveis, mensalidades, frequência e ocorrências.
        </p>
        <h2 className="text-xl font-semibold text-gray-800 mt-4">Funcionalidades</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Cadastro e gestão de alunos (crianças)</li>
          <li>Controle de turmas e professores</li>
          <li>Gestão de responsáveis</li>
          <li>Controle de mensalidades e pagamentos</li>
          <li>Registro de frequência (entrada e saída)</li>
          <li>Registro de ocorrências e observações</li>
          <li>Relatórios básicos</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-800 mt-4">Tecnologias Utilizadas</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Next.js 16.2.6 (App Router)</li>
          <li>React 19</li>
          <li>Tailwind CSS</li>
          <li>SQLite (via better-sqlite3)</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-800 mt-4">Créditos</h2>
        <p className="text-gray-700">
          © {new Date().getFullYear()} · {branding.desenvolvedor}
        </p>
        <p className="text-gray-500 text-sm">
          Todos os direitos reservados
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
