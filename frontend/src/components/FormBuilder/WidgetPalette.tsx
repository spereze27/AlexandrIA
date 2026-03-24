import { useFormBuilderStore } from '../../store';
import { WIDGET_CATALOG } from '../../types/form';
import { v4 as uuidv4 } from 'uuid';
import type { FormField, FormSection } from '../../types/form';

export default function WidgetPalette() {
  const { sections, addSection, addField } = useFormBuilderStore();

  const handleAddField = (type: FormField['type']) => {
    // If no sections exist, create one first
    if (sections.length === 0) {
      const sectionId = `section_${uuidv4().slice(0, 8)}`;
      const section: FormSection = {
        id: sectionId,
        title: { es: 'Nueva sección', en: 'New section' },
        fields: [],
      };
      addSection(section);
      setTimeout(() => addFieldToSection(sectionId, type), 0);
    } else {
      // Add to last section
      const lastSection = sections[sections.length - 1];
      addFieldToSection(lastSection.id, type);
    }
  };

  const addFieldToSection = (sectionId: string, type: FormField['type']) => {
    const fieldId = `${type}_${uuidv4().slice(0, 8)}`;
    const field: FormField = {
      id: fieldId,
      type,
      label: { es: '', en: '' },
      required: false,
      ...(type === 'single_select' || type === 'multi_select'
        ? { options: [{ value: 'option_1', label: { es: 'Opción 1', en: 'Option 1' } }] }
        : {}),
      ...(type === 'photo' ? { metadata: ['timestamp', 'gps'], max_photos: 1 } : {}),
      ...(type === 'gps' ? { auto_capture: true } : {}),
    };
    addField(sectionId, field);
  };

  const handleAddSection = () => {
    const sectionId = `section_${uuidv4().slice(0, 8)}`;
    addSection({
      id: sectionId,
      title: { es: 'Nueva sección', en: 'New section' },
      fields: [],
    });
  };

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Widgets
      </h3>

      <div className="space-y-1.5">
        {WIDGET_CATALOG.map((widget) => (
          <button
            key={widget.type}
            onClick={() => handleAddField(widget.type)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-brand-700 transition-colors text-left"
          >
            <span className="text-base">{widget.icon}</span>
            <span>{widget.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleAddSection}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <span className="text-base">📂</span>
          <span>Agregar sección</span>
        </button>
      </div>
    </div>
  );
}
