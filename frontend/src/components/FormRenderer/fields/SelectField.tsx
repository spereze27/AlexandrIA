import type { FormField } from '../../../types/form';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function SelectField({ field, value, onChange, lang }: Props) {
  const options = field.options || [];
  const selected = value as string | undefined;

  // Use radio buttons for <= 6 options, dropdown for more
  if (options.length <= 6) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label[lang]}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected === option.value
                  ? 'border-brand-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name={field.id}
                value={option.value}
                checked={selected === option.value}
                onChange={() => onChange(option.value)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-800">{option.label[lang]}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={selected || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
      >
        <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
