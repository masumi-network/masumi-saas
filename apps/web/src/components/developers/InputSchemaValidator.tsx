"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useState } from "react";

import type { JobInputSchemaType } from "@/lib/schemas/job-input-schema";
import { jobInputSchema } from "@/lib/schemas/job-input-schema";

import JobInputsFormRenderer from "./JobInputsFormRenderer";

// Dynamic import to prevent SSR crash — Monaco requires browser APIs
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] border rounded-lg bg-muted/20">
      <p className="text-sm text-muted-foreground">{"Loading editor…"}</p>
    </div>
  ),
});

// --- Predefined examples ---

const EXAMPLES = [
  {
    label: "With Optional Wrapper",
    value: JSON.stringify(
      {
        input_data: [
          {
            id: "project-name",
            type: "string",
            name: "Project Name",
            data: {
              placeholder: "Enter project name",
              description: "The name of your project",
            },
            validations: [
              { validation: "min", value: "3" },
              { validation: "max", value: "50" },
            ],
          },
          {
            id: "description",
            type: "textarea",
            name: "Description",
            data: {
              placeholder: "Describe your project",
              description: "Brief description of the project (optional)",
            },
            validations: [{ validation: "optional", value: "true" }],
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    label: "Text Inputs",
    value: JSON.stringify(
      [
        {
          id: "username",
          type: "text",
          name: "Username",
          data: {
            placeholder: "Enter username",
            description: "3-20 characters",
          },
          validations: [
            { validation: "min", value: "3" },
            { validation: "max", value: "20" },
          ],
        },
        {
          id: "email",
          type: "email",
          name: "Contact Email",
          data: { placeholder: "user@example.com" },
          validations: [{ validation: "format", value: "email" }],
        },
        {
          id: "password",
          type: "password",
          name: "Password",
          data: { description: "Minimum 8 characters" },
          validations: [
            { validation: "min", value: "8" },
            { validation: "max", value: "128" },
          ],
        },
        {
          id: "phone",
          type: "tel",
          name: "Phone Number",
          data: {
            placeholder: "+1-234-567-8900",
            description: "Include country code",
          },
        },
        {
          id: "website",
          type: "url",
          name: "Website",
          data: { placeholder: "https://example.com" },
          validations: [{ validation: "format", value: "url" }],
        },
        {
          id: "search",
          type: "search",
          name: "Search Query",
          data: {
            placeholder: "Search for services...",
            description: "Enter keywords",
          },
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "Number Input",
    value: JSON.stringify(
      {
        id: "age",
        type: "number",
        name: "Age",
        data: { description: "Must be 18 or older" },
        validations: [
          { validation: "min", value: "18" },
          { validation: "max", value: "120" },
          { validation: "format", value: "integer" },
        ],
      },
      null,
      2,
    ),
  },
  {
    label: "Date & Time",
    value: JSON.stringify(
      [
        {
          id: "birth-date",
          type: "date",
          name: "Birth Date",
          validations: [
            { validation: "min", value: "1900-01-01" },
            { validation: "max", value: "2024-12-31" },
          ],
        },
        {
          id: "appointment",
          type: "datetime-local",
          name: "Appointment Time",
          data: { description: "Select date and time" },
        },
        {
          id: "start-time",
          type: "time",
          name: "Start Time",
          validations: [
            { validation: "min", value: "09:00" },
            { validation: "max", value: "17:00" },
          ],
        },
        {
          id: "billing-month",
          type: "month",
          name: "Billing Month",
          data: { description: "Select month and year" },
        },
        {
          id: "week-select",
          type: "week",
          name: "Week Selection",
          validations: [{ validation: "min", value: "2024-W01" }],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "Color & Range",
    value: JSON.stringify(
      [
        {
          id: "theme-color",
          type: "color",
          name: "Theme Color",
          data: {
            default: "#1a73e8",
            description: "Choose your preferred color",
          },
        },
        {
          id: "priority-level",
          type: "range",
          name: "Priority Level",
          data: {
            min: "1",
            max: "10",
            step: "1",
            default: "5",
            description: "1 (low) to 10 (high)",
          },
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "Option & Radio",
    value: JSON.stringify(
      [
        {
          id: "country",
          type: "option",
          name: "Country",
          data: {
            values: ["United States", "United Kingdom", "Canada", "Germany"],
            description: "Select your country",
          },
          validations: [
            { validation: "min", value: "1" },
            { validation: "max", value: "1" },
          ],
        },
        {
          id: "skills",
          type: "option",
          name: "Skills (multi-select)",
          data: {
            values: ["JavaScript", "Python", "Rust", "Go", "TypeScript"],
            description: "Select 1-3 skills",
          },
          validations: [
            { validation: "min", value: "1" },
            { validation: "max", value: "3" },
          ],
        },
        {
          id: "payment",
          type: "radio",
          name: "Payment Method",
          data: {
            values: ["Credit Card", "PayPal", "Bank Transfer"],
            default: "Credit Card",
          },
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "Boolean & Checkbox",
    value: JSON.stringify(
      [
        {
          id: "newsletter",
          type: "boolean",
          name: "Subscribe to Newsletter",
          data: { description: "Receive weekly updates", default: false },
        },
        {
          id: "terms",
          type: "checkbox",
          name: "Terms and Conditions",
          data: { description: "I agree to the terms", default: false },
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "File Input",
    value: JSON.stringify(
      {
        id: "document",
        type: "file",
        name: "Project Document",
        data: {
          description: "Upload project documentation (PDF/Word, max 4.5MB)",
          accept: ".pdf,.doc,.docx",
          maxSize: "4718592",
          outputFormat: "url",
        },
      },
      null,
      2,
    ),
  },
  {
    label: "Hidden Field",
    value: JSON.stringify(
      {
        id: "session-id",
        type: "hidden",
        name: "Session ID",
        data: { value: "abc123xyz" },
      },
      null,
      2,
    ),
  },
  {
    label: "All Field Types",
    value: JSON.stringify(
      [
        {
          id: "instructions",
          type: "none",
          name: "Instructions",
          data: { description: "Please fill out all required fields below." },
        },
        {
          id: "full-name",
          type: "text",
          name: "Full Name",
          data: { placeholder: "John Doe", description: "Your full name" },
          validations: [
            { validation: "min", value: "2" },
            { validation: "max", value: "50" },
          ],
        },
        {
          id: "bio",
          type: "textarea",
          name: "Bio",
          data: {
            placeholder: "Tell us about yourself...",
            description: "Max 500 chars",
          },
          validations: [
            { validation: "max", value: "500" },
            { validation: "optional", value: "true" },
          ],
        },
        {
          id: "age",
          type: "number",
          name: "Age",
          data: { description: "Must be 18+" },
          validations: [
            { validation: "min", value: "18" },
            { validation: "format", value: "integer" },
          ],
        },
        {
          id: "email",
          type: "email",
          name: "Email Address",
          data: { placeholder: "user@example.com" },
          validations: [{ validation: "format", value: "email" }],
        },
        {
          id: "password",
          type: "password",
          name: "Password",
          data: { description: "8-128 characters" },
          validations: [
            { validation: "min", value: "8" },
            { validation: "max", value: "128" },
          ],
        },
        {
          id: "phone",
          type: "tel",
          name: "Phone",
          data: { placeholder: "+1-234-567-8900" },
        },
        {
          id: "website",
          type: "url",
          name: "Website",
          data: { placeholder: "https://example.com" },
          validations: [
            { validation: "format", value: "url" },
            { validation: "optional", value: "true" },
          ],
        },
        {
          id: "birth-date",
          type: "date",
          name: "Birth Date",
          validations: [
            { validation: "min", value: "1900-01-01" },
            { validation: "max", value: "2024-12-31" },
          ],
        },
        {
          id: "meeting-time",
          type: "datetime-local",
          name: "Meeting Time",
          data: { description: "Pick a date and time" },
        },
        {
          id: "start-time",
          type: "time",
          name: "Start Time",
          validations: [
            { validation: "min", value: "09:00" },
            { validation: "max", value: "17:00" },
          ],
        },
        {
          id: "billing-month",
          type: "month",
          name: "Billing Month",
        },
        {
          id: "work-week",
          type: "week",
          name: "Work Week",
        },
        {
          id: "theme-color",
          type: "color",
          name: "Theme Color",
          data: { default: "#1a73e8", description: "Choose your color" },
        },
        {
          id: "priority",
          type: "range",
          name: "Priority",
          data: {
            min: "1",
            max: "10",
            step: "1",
            default: "5",
            description: "1=low, 10=high",
          },
        },
        {
          id: "country",
          type: "option",
          name: "Country",
          data: {
            values: ["United States", "United Kingdom", "Canada"],
            description: "Select your country",
          },
          validations: [
            { validation: "min", value: "1" },
            { validation: "max", value: "1" },
          ],
        },
        {
          id: "payment",
          type: "radio",
          name: "Payment Method",
          data: {
            values: ["Credit Card", "PayPal", "Bank Transfer"],
            default: "Credit Card",
          },
        },
        {
          id: "resume",
          type: "file",
          name: "Resume",
          data: {
            description: "PDF only",
            accept: ".pdf",
            outputFormat: "url",
          },
        },
        {
          id: "search",
          type: "search",
          name: "Search",
          data: { placeholder: "Search..." },
          validations: [{ validation: "optional", value: "true" }],
        },
        {
          id: "terms",
          type: "checkbox",
          name: "Terms",
          data: { description: "I agree to the terms and conditions" },
        },
        {
          id: "newsletter",
          type: "boolean",
          name: "Newsletter",
          data: { description: "Subscribe to updates", default: true },
        },
        {
          id: "session",
          type: "hidden",
          name: "Session ID",
          data: { value: "auto-generated-session-id" },
        },
      ],
      null,
      2,
    ),
  },
];

const DEFAULT_SCHEMA = EXAMPLES[0].value;

// --- Validation function ---

interface ValidationResult {
  valid: boolean;
  errors: { message: string; line?: number }[];
  parsedSchemas?: JobInputSchemaType[];
}

function validateSchemaWithZod(input: string): ValidationResult {
  // 1. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown JSON parse error";
    let line: number | undefined;

    // Extract line number from V8 error format: "at position N"
    if (e instanceof Error) {
      const match = e.message.match(/at position (\d+)/);
      if (match) {
        const pos = parseInt(match[1], 10);
        line = input.slice(0, pos).split("\n").length;
      }
    }

    return {
      valid: false,
      errors: [{ message: `Invalid JSON: ${errorMessage}`, line }],
    };
  }

  // 2. Normalize to array of schemas
  let schemasToValidate: unknown[];

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "input_data" in parsed &&
    Array.isArray((parsed as Record<string, unknown>).input_data)
  ) {
    schemasToValidate = (parsed as Record<string, unknown>)
      .input_data as unknown[];
  } else if (Array.isArray(parsed)) {
    schemasToValidate = parsed;
  } else {
    schemasToValidate = [parsed];
  }

  if (schemasToValidate.length === 0) {
    return {
      valid: false,
      errors: [
        { message: "Schema array is empty. Add at least one input field." },
      ],
    };
  }

  // 3. Validate each schema
  const validSchemas: JobInputSchemaType[] = [];
  const errors: { message: string; line?: number }[] = [];

  schemasToValidate.forEach((schema, index) => {
    const result = jobInputSchema.safeParse(schema);
    if (result.success) {
      validSchemas.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        const path =
          issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
        const prefix =
          schemasToValidate.length > 1 ? `Field ${index + 1}` : "Field";
        errors.push({
          message: `${prefix}${path}: ${issue.message}`,
        });
      }
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], parsedSchemas: validSchemas };
}

// --- Main component ---

export function InputSchemaValidator() {
  const [jsonInput, setJsonInput] = useState<string>(DEFAULT_SCHEMA);
  const { resolvedTheme } = useTheme();
  const [selectedExample, setSelectedExample] = useState<string>(
    EXAMPLES[0].label,
  );

  // Memoized validation — runs on every jsonInput change
  const validation = useMemo(
    () => validateSchemaWithZod(jsonInput),
    [jsonInput],
  );

  const handleSelectExample = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSelectedExample(val);
      const found = EXAMPLES.find((ex) => ex.label === val);
      if (found) {
        setJsonInput(found.value);
      }
    },
    [],
  );

  // Dynamic editor height: 20px per line, clamped between 200px and 700px
  const editorHeight = useMemo(() => {
    const lineCount = jsonInput.split("\n").length;
    const calculated = Math.max(200, Math.min(700, lineCount * 20 + 40));
    return calculated;
  }, [jsonInput]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {"Validate your Masumi input schemas against the "}
        <strong>{"MIP-003"}</strong>
        {" specification and see how they will render in Sokosumi."}
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT: Editor Panel */}
        <div className="flex-1 border rounded-lg p-4 bg-background overflow-hidden flex flex-col gap-2 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{"Input Schema"}</span>
            <select
              value={selectedExample}
              onChange={handleSelectExample}
              className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
            >
              {EXAMPLES.map((ex) => (
                <option key={ex.label} value={ex.label}>
                  {ex.label}
                </option>
              ))}
            </select>
          </div>

          {/* Monaco Editor — height adapts to content */}
          <div>
            <MonacoEditor
              height={`${editorHeight}px`}
              defaultLanguage="json"
              value={jsonInput}
              onChange={(value) => setJsonInput(value ?? "")}
              theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
                tabSize: 2,
                lineNumbers: "on",
                renderLineHighlight: "line",
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>
        </div>

        {/* RIGHT: Validation Result / Form Preview */}
        <div className="flex-1 border rounded-lg p-4 bg-background overflow-auto flex flex-col gap-4 min-w-0">
          {validation.valid ? (
            <>
              <div className="text-green-600 dark:text-green-400 font-semibold text-sm">
                {"Schema is valid!"}
              </div>
              <JobInputsFormRenderer
                jobInputSchemas={validation.parsedSchemas ?? []}
              />
            </>
          ) : (
            <>
              <div className="text-destructive font-semibold text-sm">
                {"Schema is invalid:"}
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {validation.errors.map((err, i) => (
                  <li key={i} className="text-sm">
                    {err.line !== undefined && (
                      <span className="text-xs text-muted-foreground mr-1">
                        {"(line "}
                        {err.line}
                        {")"}
                      </span>
                    )}
                    {err.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
