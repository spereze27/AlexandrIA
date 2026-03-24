import { useFormBuilderStore } from '../../store';
import type { FormField } from '../../types/form';

const TYPE_LABELS: Record<FormField['type'], string> = {
  text: 'Texto',
  number: 'Número',
  single_select: 'Selección única',
  multi_select: 'Selección múltiple',
  photo: 'Foto',
  gps: 'GPS',
  signature: 'Firma',
  date: 'Fecha',
  conditional_text: 'Texto condicional',
};

const TYPE_ICONS: Record<FormField['type'], string> = {
  text: '📝', number: '🔢', single_select: '⭕', multi_select: '☑️',
  photo: '📸', gps: '📍', signature: '✍️', date: '📅', conditional_text: '🔀',
};

export default function Canvas() {
  const {
    sections, language, selectedFieldId, selectedSectionId,
    selectField, removeField, removeSection, updateSection,
  } = useFormBuilderStore();

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">Agrega widgets desde el panel izquierdo</p>
          <p className="text-xs mt-1">o usa la pestaña "Generar con IA"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {sections.map((section) => (
        <div
          key={section.id}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          {/* Section header */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <input
              type="text"
              value={section.title[language]}
              onChange={(e) => {
                const newTitle = { ...section.title, [language]: e.target.value };
                updateSection(section.id, { title: newTitle });
              }}
              placeholder="Nombre de la sección..."
              className="font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
            />
            <button
              onClick={() => removeSection(section.id)}
              className="text-gray-400 hover:text-red-500 text-sm ml-2"
              title="Eliminar sección"
            >
              ✕
            </button>
          </div>

          {/* Fields */}
          <div className="divide-y divide-gray-100">
            {section.fields.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Arrastra o agrega campos aquí
              </div>
            ) : (
              section.fields.map((field) => {
                const isSelected = selectedFieldId === field.id && selectedSectionId === section.id;

                return (
                  <div
                    key={field.id}
                    onClick={() => selectField(field.id, section.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 group ${
                      isSelected
                        ? 'bg-blue-50 border-l-4 border-l-brand-500'
                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <span className="text-lg shrink-0">{TYPE_ICONS[field.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {field.label[language] || `(${TYPE_LABELS[field.type]} sin nombre)`}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>{TYPE_LABELS[field.type]}</span>
                        {field.required && (
                          <span className="text-red-400 font-medium">Requerido</span>
                        )}
                        {field.conditional && (
                          <span className="text-amber-500">Condicional</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(section.id, field.id);
                      }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
