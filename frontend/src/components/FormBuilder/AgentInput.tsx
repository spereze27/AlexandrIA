import { useState } from 'react';

interface Props {
  onGenerate: (prompt: string) => Promise<void>;
}

export default function AgentInput({ onGenerate }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setLogs(['Enviando al agente LangGraph...']);

    try {
      await onGenerate(prompt);
      setLogs((prev) => [...prev, '✅ Formulario generado exitosamente']);
    } catch (err) {
      setLogs((prev) => [...prev, `❌ Error: ${err}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🤖</div>
          <h2 className="text-xl font-semibold text-gray-900">Generar formulario con IA</h2>
          <p className="text-sm text-gray-500 mt-1">
            Describe el formulario que necesitas y el agente lo construirá automáticamente
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Describe tu formulario aquí. Ejemplo:\n\n📋 FORMULARIO SITE SURVEY\nPOLE TRANSFER + POLE REMOVAL\n\n🔹 1. IDENTIFICACIÓN\nPole ID (del Excel)\nDirección / Address\nGPS automático\n📸 Foto general del poste (required)\n\n🔹 2. ESTADO DEL POSTE\nSeleccionar una:\n- Pendiente transferencia\n- Ya transferido\n- Poste retirado\n...`}
          rows={14}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-4 w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
              </svg>
              Generando formulario...
            </>
          ) : (
            '🚀 Generar formulario'
          )}
        </button>

        {/* Agent logs */}
        {logs.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
