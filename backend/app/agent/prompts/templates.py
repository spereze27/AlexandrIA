"""Prompt templates for LangGraph form generation agent nodes."""

PARSE_REQUIREMENTS_PROMPT = """\
You are an expert form designer for field inspection and electrical installation workflows.

Analyze the following user description and extract a structured representation of the form they want to create.

## Rules
- Identify ALL sections and their fields
- Detect if the form is bilingual (look for "/" separating languages)
- Mark fields as required if indicated by keywords like "required", "obligatorio", "📸" with (required)
- Identify field options when listed (e.g., "Select one:", bullet points)
- Distinguish between single-select (pick one) and multi-select (pick many) based on context clues like "Select all that apply" vs "Select one"
- Identify special field types: photos, GPS, signatures, conditional fields
- Identify conditional logic (e.g., "If Others → Specify")

## User description:
{user_input}

## Output format (respond ONLY with valid JSON, no markdown):
{{
  "form_name": "Short descriptive name",
  "languages": ["es", "en"],
  "sections": [
    {{
      "title": {{"es": "Section title in Spanish", "en": "Section title in English"}},
      "description": null,
      "fields": [
        {{
          "description": "What this field captures",
          "label_es": "Label in Spanish",
          "label_en": "Label in English",
          "required": true,
          "has_options": true,
          "options": [
            {{"value": "option_key", "label_es": "...", "label_en": "..."}}
          ],
          "is_multi_select": false,
          "is_photo": false,
          "is_gps": false,
          "is_signature": false,
          "photo_metadata": ["timestamp", "gps"],
          "conditional_on": null,
          "conditional_value": null,
          "notes": "Any special instructions"
        }}
      ]
    }}
  ]
}}
"""

CLASSIFY_FIELDS_PROMPT = """\
You are a form widget classification engine. Given a list of parsed field descriptions, assign the correct widget type to each field.

## Widget catalog
| Type | Use when |
|------|----------|
| text | Free text input (names, addresses, IDs, specifications) |
| number | Numeric values |
| single_select | Choose exactly one option from a list |
| multi_select | Choose one or more options from a list |
| photo | Camera capture with optional metadata (timestamp, GPS) |
| gps | Automatic GPS coordinate capture |
| signature | Digital signature pad |
| date | Date picker |
| conditional_text | Text field shown conditionally based on another field's value |

## Rules
- Generate a unique snake_case `id` for each field based on its purpose
- If a field has options and is single choice → single_select
- If a field has options and allows multiple → multi_select
- If description mentions photo/camera/📸 → photo
- If description mentions GPS/location/coordinates → gps
- If description mentions signature/firma → signature
- If a field appears only when another field has a specific value → set conditional logic
- Set `auto_capture: true` for GPS fields that should capture automatically
- For photo fields, include metadata requirements (timestamp, gps)
- Set appropriate validation rules (patterns, min/max)

## Parsed fields:
{parsed_fields}

## Output format (respond ONLY with valid JSON array, no markdown):
[
  {{
    "id": "field_snake_case_id",
    "type": "text|number|single_select|multi_select|photo|gps|signature|date|conditional_text",
    "label": {{"es": "...", "en": "..."}},
    "required": true,
    "placeholder": {{"es": "...", "en": "..."}} or null,
    "options": [{{"value": "key", "label": {{"es": "...", "en": "..."}}}}] or null,
    "validation": {{"pattern": "...", "min_length": null, "max_length": null}} or null,
    "metadata": ["timestamp", "gps"] or null,
    "auto_capture": false,
    "max_photos": 1,
    "conditional": {{"depends_on": "field_id", "operator": "equals", "value": "option_value"}} or null
  }}
]
"""

STRUCTURE_FORM_PROMPT = """\
You are a form structure optimizer. Given classified fields organized by sections, produce the final form schema.

## Rules
- Group fields logically within their sections
- Ensure photo fields that should appear together are in the same section
- Place identification fields first, then inspection fields, then results/signatures last
- Ensure conditional fields are placed AFTER the field they depend on
- Add a `settings` object with form-level configuration
- Every section must have at least one field
- The form should flow naturally for a field technician using a mobile device

## Sections with classified fields:
{sections_with_fields}

## Form name: {form_name}
## Languages detected: {languages}

## Output format (respond ONLY with valid JSON, no markdown):
{{
  "sections": [
    {{
      "id": "section_snake_case_id",
      "title": {{"es": "...", "en": "..."}},
      "description": {{"es": "...", "en": "..."}} or null,
      "fields": [
        {{
          "id": "field_id",
          "type": "...",
          "label": {{"es": "...", "en": "..."}},
          "required": true,
          "placeholder": null,
          "options": null,
          "validation": null,
          "metadata": null,
          "auto_capture": false,
          "max_photos": 1,
          "conditional": null
        }}
      ]
    }}
  ],
  "settings": {{
    "bilingual": true,
    "primary_language": "es",
    "require_gps": true,
    "require_timestamp": true
  }}
}}
"""

VALIDATE_FORM_PROMPT = """\
You are a form schema validator. Check the following form schema for completeness and correctness.

## Validation rules
1. Every section must have at least one field
2. Every field must have a valid type from: text, number, single_select, multi_select, photo, gps, signature, date, conditional_text
3. single_select and multi_select fields MUST have at least 2 options
4. Fields with conditional logic must reference an existing field_id in depends_on
5. The depends_on field must appear BEFORE the conditional field
6. Required photo fields must have metadata specified
7. No duplicate field IDs across the entire form
8. All labels must have both 'es' and 'en' keys if bilingual is true
9. GPS fields should have auto_capture set to true
10. The form must end with a result/status section or signature section

## Form schema to validate:
{form_schema}

## Output format (respond ONLY with valid JSON, no markdown):
{{
  "valid": true,
  "errors": ["Critical issues that must be fixed"],
  "warnings": ["Non-critical suggestions for improvement"],
  "fixes_applied": ["Automatic fixes made to the schema"]
}}
"""
