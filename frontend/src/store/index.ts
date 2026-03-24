/** Global state management with Zustand. */

import { create } from 'zustand';
import type { User, FormSchema, FormSection, FormField } from '../types/form';

// ── Auth Store ──────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (token, user) => {
    localStorage.setItem('access_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

// ── Form Builder Store ──────────────────────────────────────────────────────

interface FormBuilderState {
  formName: string;
  formDescription: string;
  sections: FormSection[];
  selectedFieldId: string | null;
  selectedSectionId: string | null;
  language: 'es' | 'en';

  // Actions
  setFormName: (name: string) => void;
  setFormDescription: (desc: string) => void;
  addSection: (section: FormSection) => void;
  removeSection: (sectionId: string) => void;
  updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
  addField: (sectionId: string, field: FormField) => void;
  removeField: (sectionId: string, fieldId: string) => void;
  updateField: (sectionId: string, fieldId: string, updates: Partial<FormField>) => void;
  moveField: (sourceSectionId: string, destSectionId: string, sourceIndex: number, destIndex: number) => void;
  selectField: (fieldId: string | null, sectionId: string | null) => void;
  setLanguage: (lang: 'es' | 'en') => void;
  loadSchema: (name: string, description: string, schema: FormSchema) => void;
  getSchema: () => FormSchema;
  reset: () => void;
}

export const useFormBuilderStore = create<FormBuilderState>((set, get) => ({
  formName: '',
  formDescription: '',
  sections: [],
  selectedFieldId: null,
  selectedSectionId: null,
  language: 'es',

  setFormName: (name) => set({ formName: name }),
  setFormDescription: (desc) => set({ formDescription: desc }),

  addSection: (section) =>
    set((s) => ({ sections: [...s.sections, section] })),

  removeSection: (sectionId) =>
    set((s) => ({
      sections: s.sections.filter((sec) => sec.id !== sectionId),
      selectedFieldId: null,
      selectedSectionId: null,
    })),

  updateSection: (sectionId, updates) =>
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, ...updates } : sec,
      ),
    })),

  addField: (sectionId, field) =>
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, fields: [...sec.fields, field] } : sec,
      ),
    })),

  removeField: (sectionId, fieldId) =>
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === sectionId
          ? { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) }
          : sec,
      ),
      selectedFieldId: null,
    })),

  updateField: (sectionId, fieldId, updates) =>
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              fields: sec.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
            }
          : sec,
      ),
    })),

  moveField: (sourceSectionId, destSectionId, sourceIndex, destIndex) =>
    set((s) => {
      const newSections = [...s.sections];

      const sourceSection = newSections.find((sec) => sec.id === sourceSectionId);
      const destSection = newSections.find((sec) => sec.id === destSectionId);
      if (!sourceSection || !destSection) return s;

      const [movedField] = sourceSection.fields.splice(sourceIndex, 1);
      destSection.fields.splice(destIndex, 0, movedField);

      return { sections: newSections };
    }),

  selectField: (fieldId, sectionId) =>
    set({ selectedFieldId: fieldId, selectedSectionId: sectionId }),

  setLanguage: (lang) => set({ language: lang }),

  loadSchema: (name, description, schema) =>
    set({
      formName: name,
      formDescription: description,
      sections: schema.sections,
      selectedFieldId: null,
      selectedSectionId: null,
    }),

  getSchema: (): FormSchema => {
    const { sections } = get();
    return {
      sections,
      settings: {
        bilingual: true,
        primary_language: 'es',
        require_gps: true,
        require_timestamp: true,
      },
    };
  },

  reset: () =>
    set({
      formName: '',
      formDescription: '',
      sections: [],
      selectedFieldId: null,
      selectedSectionId: null,
    }),
}));
