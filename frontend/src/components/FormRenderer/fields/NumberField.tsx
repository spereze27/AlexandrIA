import type { FormField } from '../../../types/form';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function NumberField({ field, value, onChange, lang }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="number"
        value={(value as number) ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        min={field.validation?.min_value}
        max={field.validation?.max_value}
        placeholder={field.placeholder?.[lang] || ''}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
