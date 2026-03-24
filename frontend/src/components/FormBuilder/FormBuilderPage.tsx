import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFormBuilderStore } from '../../store';
import { formsApi, agentApi } from '../../services/api';
import WidgetPalette from './WidgetPalette';
import Canvas from './Canvas';
import FieldConfig from './FieldConfig';
import AgentInput from './AgentInput';

export default function FormBuilderPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const store = useFormBuilderStore();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'manual' | 'agent'>('manual');

  // Load existing form if editing
  useEffect(() => {
    if (formId) {
      formsApi.get(formId).then((res) => {
        store.loadSchema(res.data.name, res.data.description || '', res.data.schema);
      });
    } else {
      store.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const handleSave = async () => {
    if (!store.formName.trim()) {
      alert('El nombre del formulario es requerido');
      return;
    }

    setSaving(true);
    try {
      const schema = store.getSchema();
      if (formId) {
        await formsApi.update(formId, { name: store.formName, description: store.formDescription, schema });
      } else {
        const res = await formsApi.create({ name: store.formName, description: store.formDescription, schema });
        navigate(`/builder/${res.data.id}`, { replace: true });
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAgentGenerate = async (prompt: string) => {
    const res = await agentApi.generate({ prompt, form_name: store.formName || undefined });
    store.loadSchema(res.data.form_name, '', res.data.schema);
    if (res.data.warnings.length > 0) {
      alert('Advertencias del agente:\n' + res.data.warnings.join('\n'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
            ← Volver
          </button>
          <input
            type="text"
            value={store.formName}
            onChange={(e) => store.setFormName(e.target.value)}
            placeholder="Nombre del formulario..."
            className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-64"
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                store.language === 'es' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => store.setLanguage('es')}
            >
              ES
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                store.language === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => store.setLanguage('en')}
            >
              EN
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'manual'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('manual')}
        >
          Constructor manual
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'agent'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('agent')}
        >
          Generar con IA
        </button>
      </div>

      {/* Body */}
      {tab === 'agent' ? (
        <AgentInput onGenerate={handleAgentGenerate} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Widget palette */}
          <aside className="w-56 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
            <WidgetPalette />
          </aside>

          {/* Center: Canvas */}
          <main className="flex-1 overflow-y-auto p-6">
            <Canvas />
          </main>

          {/* Right: Field config */}
          <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
            <FieldConfig />
          </aside>
        </div>
      )}
    </div>
  );
}
