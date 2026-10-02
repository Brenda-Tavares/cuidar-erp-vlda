'use client'

interface JustificativaFaltaSelectorProps {
  tipoJustificativa: string
  justificativaTexto: string
  onTipoChange: (value: string) => void
  onTextoChange: (value: string) => void
  disabled?: boolean
}

const OPCOES = [
  { value: 'atestado_medico', label: 'Atestado médico' },
  { value: 'falecimento_parentes', label: 'Falecimento de parentes' },
  { value: 'situacoes_circunstanciais', label: 'Situações circunstanciais' },
  { value: 'outros', label: 'Outros' },
]

export default function JustificativaFaltaSelector({
  tipoJustificativa,
  justificativaTexto,
  onTipoChange,
  onTextoChange,
  disabled = false,
}: JustificativaFaltaSelectorProps) {
  const radioGroupId = 'justificativa-radio-group'

  return (
    <div className={`space-y-3 mt-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <label className="text-sm font-medium text-gray-700" id={`${radioGroupId}-label`}>
        Justificativa da Falta
      </label>
      <div
        role="radiogroup"
        aria-labelledby={`${radioGroupId}-label`}
        className="space-y-1.5"
      >
        {OPCOES.map((opcao) => (
          <label
            key={opcao.value}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              tipoJustificativa === opcao.value
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                : 'border-gray-200 hover:bg-gray-50'
            } ${disabled ? 'pointer-events-none' : ''}`}
          >
            <input autoComplete="off"
              type="radio"
              name="tipo-justificativa"
              value={opcao.value}
              checked={tipoJustificativa === opcao.value}
              onChange={(e) => onTipoChange(e.target.value)}
              disabled={disabled}
              aria-label={opcao.label}
              className="h-4 w-4 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            />
            <span className="text-sm text-gray-900">{opcao.label}</span>
          </label>
        ))}
      </div>

      {tipoJustificativa === 'outros' && (
        <div>
          <label htmlFor="justificativa-texto" className="text-xs text-gray-500 mb-1 block">
            Descreva o motivo da falta
          </label>
          <textarea
            id="justificativa-texto"
            value={justificativaTexto}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                onTextoChange(e.target.value)
              }
            }}
            placeholder="Descreva o motivo da falta..."
            disabled={disabled}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            aria-describedby="justificativa-char-count"
          />
          <p id="justificativa-char-count" className="text-xs text-gray-400 mt-1 text-right">
            {justificativaTexto.length}/500
          </p>
        </div>
      )}
    </div>
  )
}

