import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { formsApi, submissionsApi } from '../../services/api';
import { savePendingSubmission, getCachedForm, cacheForm } from '../../services/offline';
import type { FormSchema, FormField } from '../../types/form';
import TextField from './fields/TextField';
import NumberField from './fields/NumberField';
import SelectField from './fields/SelectField';
import MultiSelectField from './fields/MultiSelectField';
import PhotoField from './fields/PhotoField';
import GPSField from './fields/GPSField';
import SignatureField from './fields/SignatureField';
import DateField from './fields/DateField';

type FieldValues = Record<string, unknown>;

function shouldShowField(field: FormField, values: FieldValues): boolean {
  if (!field.conditional) return true;
  const depValue = values[field.conditional.depends_on];
  switch (field.conditional.operator) {
    case 'equals':
      return depValue === field.conditional.value;
    case 'not_equals':
      return depValue !== field.conditional.value;
    case 'contains':
      return typeof depValue === 'string' && depValue.includes(String(field.conditional.value));
    case 'in':
      return Array.isArray(field.conditional.value) && field.conditional.value.includes(String(depValue));
    default:
      return true;
  }
}

const FIELD_COMPONENTS: Record<string, React.ComponentType<{ field: FormField; value: unknown; onChange: (v: unknown) => void; lang: 'es' | 'en' }>> = {
  text: TextField,
  number: NumberField,
  single_select: SelectField,
  multi_select: MultiSelectField,
  photo: PhotoField,
  gps: GPSField,
  signature: SignatureField,
  date: DateField,
  conditional_text: TextField,
};

export default function FormRendererPage() {
  const { formId } = useParams<{ formId: string }>();
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [formName, setFormName] = useState('');
  const [values, setValues] = useState<FieldValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!formId) return;

    formsApi.getPublic(formId)
      .then((res) => {
        setSchema(res.data.schema);
        setFormName(res.data.name);
        cacheForm(res.data);
      })
      .catch(async () => {
        // Offline fallback
        const cached = await getCachedForm(formId);
        if (cached) {
          setSchema(cached.schema as FormSchema);
          setFormName(cached.name);
        }
      });
  }, [formId]);

  const handleChange = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const validate = (): boolean => {
    if (!schema) return false;
    const newErrors: Record<string, string> = {};

    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (!shouldShowField(field, values)) continue;
        if (field.required) {
          const val = values[field.id];
          if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
            newErrors[field.id] = lang === 'es' ? 'Campo requerido' : 'Required field';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !formId) return;
    setSubmitting(true);

    const gpsValue = values['gps_location'] as { lat: number; lng: number } | undefined;

    try {
      if (navigator.onLine) {
        await submissionsApi.create({
          form_id: formId,
          data: values,
          gps_lat: gpsValue?.lat,
          gps_lng: gpsValue?.lng,
        });
      } else {
        await savePendingSubmission(formId, values, gpsValue?.lat, gpsValue?.lng);
      }
      setSubmitted(true);
    } catch (err) {
      // Save offline if API fails
      await savePendingSubmission(formId, values, gpsValue?.lat, gpsValue?.lng);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {lang === 'es' ? 'Formulario enviado' : 'Form submitted'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {navigator.onLine
              ? lang === 'es' ? 'Se ha sincronizado con el servidor' : 'Synced to server'
              : lang === 'es' ? 'Se enviará cuando haya conexión' : 'Will sync when online'}
          </p>
          <button
            onClick={() => { setSubmitted(false); setValues({}); }}
            className="bg-brand-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {lang === 'es' ? 'Nuevo registro' : 'New entry'}
          </button>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Cargando formulario...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{formName}</h1>
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0 ml-3">
            <button
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${lang === 'es' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => setLang('es')}
            >ES</button>
            <button
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => setLang('en')}
            >EN</button>
          </div>
        </div>
      </header>

      {/* Form body */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {schema.sections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
              <h2 className="font-semibold text-blue-900 text-sm">{section.title[lang]}</h2>
              {section.description?.[lang] && (
                <p className="text-xs text-blue-700 mt-0.5">{section.description[lang]}</p>
              )}
            </div>

            <div className="p-4 space-y-4">
              {section.fields.map((field) => {
                if (!shouldShowField(field, values)) return null;
                const Component = FIELD_COMPONENTS[field.type];
                if (!Component) return null;

                return (
                  <div key={field.id}>
                    <Component
                      field={field}
                      value={values[field.id]}
                      onChange={(v) => handleChange(field.id, v)}
                      lang={lang}
                    />
                    {errors[field.id] && (
                      <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Submit button fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? (lang === 'es' ? 'Enviando...' : 'Submitting...')
              : (lang === 'es' ? 'Enviar formulario' : 'Submit form')}
          </button>
        </div>
      </div>
    </div>
  );
}
