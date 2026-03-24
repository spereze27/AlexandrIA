import type { FormField } from '../../../types/form';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function MultiSelectField({ field, value, onChange, lang }: Props) {
  const options = field.options || [];
  const selected = (value as string[]) || [];

  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <p className="text-xs text-gray-400 mb-2">
        {lang === 'es' ? 'Selecciona todas las que apliquen' : 'Select all that apply'}
      </p>
      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                isChecked
                  ? 'border-brand-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(option.value)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-800">{option.label[lang]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
