/** TypeScript types matching the backend Pydantic schemas. */

export interface LocalizedText {
  es: string;
  en: string;
}

export interface FieldOption {
  value: string;
  label: LocalizedText;
}

export interface ValidationRule {
  pattern?: string;
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

export interface ConditionalLogic {
  depends_on: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in';
  value: string | string[];
}

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'single_select' | 'multi_select' | 'photo' | 'gps' | 'signature' | 'date' | 'conditional_text';
  label: LocalizedText;
  required: boolean;
  placeholder?: LocalizedText;
  options?: FieldOption[];
  validation?: ValidationRule;
  conditional?: ConditionalLogic;
  metadata?: string[];
  auto_capture?: boolean;
  max_photos?: number;
}

export interface FormSection {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  fields: FormField[];
}

export interface FormSchema {
  sections: FormSection[];
  settings: {
    bilingual: boolean;
    primary_language: string;
    require_gps: boolean;
    require_timestamp: boolean;
  };
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  schema: FormSchema;
  sheets_id?: string;
  sheets_url?: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  submission_count: number;
}

export interface FormListItem {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  submission_count: number;
}

export interface Submission {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  gps_lat?: number;
  gps_lng?: number;
  submitted_by: string;
  submitted_at: string;
  synced_to_sheets: boolean;
}

// Dashboard types
export interface DashboardStats {
  total_submissions: number;
  ready_for_execution: number;
  requires_review: number;
  not_executable: number;
  pending: number;
}

export interface MapPoint {
  submission_id: string;
  lat: number;
  lng: number;
  pole_id?: string;
  status: 'ready' | 'review' | 'not_executable' | 'pending';
  severity: 'green' | 'yellow' | 'red' | 'gray';
  issues: string[];
}

export interface DashboardData {
  stats: DashboardStats;
  map_points: MapPoint[];
}

// Agent types
export interface AgentRequest {
  prompt: string;
  form_name?: string;
}

export interface AgentResponse {
  form_name: string;
  schema: FormSchema;
  warnings: string[];
  agent_log: string[];
}

// Auth
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Widget catalog for Form Builder palette
export const WIDGET_CATALOG: { type: FormField['type']; label: string; icon: string }[] = [
  { type: 'text', label: 'Text Input', icon: '📝' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'single_select', label: 'Single Select', icon: '⭕' },
  { type: 'multi_select', label: 'Multi Select', icon: '☑️' },
  { type: 'photo', label: 'Photo Capture', icon: '📸' },
  { type: 'gps', label: 'GPS Location', icon: '📍' },
  { type: 'signature', label: 'Signature', icon: '✍️' },
  { type: 'date', label: 'Date Picker', icon: '📅' },
  { type: 'conditional_text', label: 'Conditional Text', icon: '🔀' },
];
