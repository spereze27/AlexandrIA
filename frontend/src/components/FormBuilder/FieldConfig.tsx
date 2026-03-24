import { useFormBuilderStore } from '../../store';
import { v4 as uuidv4 } from 'uuid';

export default function FieldConfig() {
  const { sections, selectedFieldId, selectedSectionId, updateField, language } = useFormBuilderStore();

  // Find selected field
  const section = sections.find((s) => s.id === selectedSectionId);
  const field = section?.fields.find((f) => f.id === selectedFieldId);

  if (!field || !section) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center mt-12">
        Selecciona un campo para editar sus propiedades
      </div>
    );
  }

  const update = (updates: Record<string, unknown>) => {
    updateField(section.id, field.id, updates);
  };

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Propiedades del campo
      </h3>

      {/* Field ID */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">ID del campo</label>
        <input
          type="text"
          value={field.id}
          onChange={(e) => update({ id: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
        />
      </div>

      {/* Label ES */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Label (ES)</label>
        <input
          type="text"
          value={field.label.es}
          onChange={(e) => update({ label: { ...field.label, es: e.target.value } })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
          placeholder="Etiqueta en español..."
        />
      </div>

      {/* Label EN */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Label (EN)</label>
        <input
          type="text"
          value={field.label.en}
          onChange={(e) => update({ label: { ...field.label, en: e.target.value } })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
          placeholder="Label in English..."
        />
      </div>

      {/* Required toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-700">Campo requerido</span>
      </label>

      {/* Options editor for select fields */}
      {(field.type === 'single_select' || field.type === 'multi_select') && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Opciones</label>
          <div className="space-y-2">
            {(field.options || []).map((option, i) => (
              <div key={option.value} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={option.label[language]}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[i] = {
                        ...newOptions[i],
                        label: { ...newOptions[i].label, [language]: e.target.value },
                      };
                      update({ options: newOptions });
                    }}
                    placeholder={`Opción ${i + 1}...`}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                  />
                </div>
                <button
                  onClick={() => {
                    const newOptions = (field.options || []).filter((_, idx) => idx !== i);
                    update({ options: newOptions });
                  }}
                  className="text-gray-400 hover:text-red-500 text-xs mt-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const newOption = {
                value: `option_${uuidv4().slice(0, 6)}`,
                label: { es: '', en: '' },
              };
              update({ options: [...(field.options || []), newOption] });
            }}
            className="text-xs text-brand-600 hover:text-brand-800 mt-2 font-medium"
          >
            + Agregar opción
          </button>
        </div>
      )}

      {/* Photo settings */}
      {field.type === 'photo' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max fotos</label>
            <input
              type="number"
              value={field.max_photos || 1}
              onChange={(e) => update({ max_photos: parseInt(e.target.value) || 1 })}
              min={1}
              max={10}
              className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-brand-400"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={field.metadata?.includes('gps') ?? false}
              onChange={(e) => {
                const meta = new Set(field.metadata || []);
                if (e.target.checked) meta.add('gps'); else meta.delete('gps');
                update({ metadata: Array.from(meta) });
              }}
              className="rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm text-gray-700">Incluir GPS en foto</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={field.metadata?.includes('timestamp') ?? false}
              onChange={(e) => {
                const meta = new Set(field.metadata || []);
                if (e.target.checked) meta.add('timestamp'); else meta.delete('timestamp');
                update({ metadata: Array.from(meta) });
              }}
              className="rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm text-gray-700">Incluir timestamp</span>
          </label>
        </>
      )}

      {/* GPS settings */}
      {field.type === 'gps' && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={field.auto_capture ?? true}
            onChange={(e) => update({ auto_capture: e.target.checked })}
            className="rounded border-gray-300 text-brand-600"
          />
          <span className="text-sm text-gray-700">Captura automática</span>
        </label>
      )}

      {/* Conditional logic */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Lógica condicional</label>
        {field.conditional ? (
          <div className="space-y-2 bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              Mostrar cuando <strong>{field.conditional.depends_on}</strong>{' '}
              {field.conditional.operator} <strong>{String(field.conditional.value)}</strong>
            </p>
            <button
              onClick={() => update({ conditional: undefined })}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Quitar condición
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin condición — siempre visible</p>
        )}
      </div>
    </div>
  );
}
