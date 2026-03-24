import type { FormField } from '../../../types/form';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function TextField({ field, value, onChange, lang }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder?.[lang] || ''}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
