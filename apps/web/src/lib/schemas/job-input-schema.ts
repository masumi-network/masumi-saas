import { z } from "zod";

// --- Validation rule schemas ---

const validationRuleSchema = z.object({
  validation: z.string().min(1),
  value: z.string(),
});

// --- Base schema (shared fields) ---

const baseFields = {
  id: z.string().min(1),
  name: z.string().min(1),
};

// --- Text-like fields share a common data shape ---

const textLikeDataSchema = z
  .object({
    placeholder: z.string().optional(),
    description: z.string().optional(),
    default: z.string().optional(),
  })
  .optional();

const jobInputTextSchema = z.object({
  ...baseFields,
  type: z.literal("text"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputStringSchema = z.object({
  ...baseFields,
  type: z.literal("string"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputEmailSchema = z.object({
  ...baseFields,
  type: z.literal("email"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputPasswordSchema = z.object({
  ...baseFields,
  type: z.literal("password"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputTelSchema = z.object({
  ...baseFields,
  type: z.literal("tel"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputUrlSchema = z.object({
  ...baseFields,
  type: z.literal("url"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputSearchSchema = z.object({
  ...baseFields,
  type: z.literal("search"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

// Textarea
const jobInputTextareaSchema = z.object({
  ...baseFields,
  type: z.literal("textarea"),
  data: textLikeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

// Number
const jobInputNumberSchema = z.object({
  ...baseFields,
  type: z.literal("number"),
  data: z
    .object({
      placeholder: z.string().optional(),
      description: z.string().optional(),
      default: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Boolean
const jobInputBooleanSchema = z.object({
  ...baseFields,
  type: z.literal("boolean"),
  data: z
    .object({
      description: z.string().optional(),
      default: z.boolean().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Checkbox (single boolean toggle, like "agree to terms")
const jobInputCheckboxSchema = z.object({
  ...baseFields,
  type: z.literal("checkbox"),
  data: z
    .object({
      description: z.string().optional(),
      default: z.boolean().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Date / DateTime / Time types
const dateTimeDataSchema = z
  .object({
    description: z.string().optional(),
    default: z.string().optional(),
  })
  .optional();

const jobInputDateSchema = z.object({
  ...baseFields,
  type: z.literal("date"),
  data: dateTimeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputDatetimeLocalSchema = z.object({
  ...baseFields,
  type: z.literal("datetime-local"),
  data: dateTimeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputTimeSchema = z.object({
  ...baseFields,
  type: z.literal("time"),
  data: dateTimeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputMonthSchema = z.object({
  ...baseFields,
  type: z.literal("month"),
  data: dateTimeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

const jobInputWeekSchema = z.object({
  ...baseFields,
  type: z.literal("week"),
  data: dateTimeDataSchema,
  validations: z.array(validationRuleSchema).optional(),
});

// Color picker
const jobInputColorSchema = z.object({
  ...baseFields,
  type: z.literal("color"),
  data: z
    .object({
      default: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Range slider
const jobInputRangeSchema = z.object({
  ...baseFields,
  type: z.literal("range"),
  data: z
    .object({
      min: z.string().optional(),
      max: z.string().optional(),
      step: z.string().optional(),
      default: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Option (select / multi-select)
const jobInputOptionSchema = z.object({
  ...baseFields,
  type: z.literal("option"),
  data: z.object({
    values: z.array(z.string()).min(1),
    description: z.string().optional(),
    default: z.string().optional(),
  }),
  validations: z.array(validationRuleSchema).optional(),
});

// Radio (single-select with radio buttons)
const jobInputRadioSchema = z.object({
  ...baseFields,
  type: z.literal("radio"),
  data: z.object({
    values: z.array(z.string()).min(1),
    description: z.string().optional(),
    default: z.string().optional(),
  }),
  validations: z.array(validationRuleSchema).optional(),
});

// File upload
const jobInputFileSchema = z.object({
  ...baseFields,
  type: z.literal("file"),
  data: z
    .object({
      description: z.string().optional(),
      accept: z.string().optional(),
      maxSize: z.string().optional(),
      outputFormat: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// Hidden field
const jobInputHiddenSchema = z.object({
  ...baseFields,
  type: z.literal("hidden"),
  data: z
    .object({
      value: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// None (static text / instructions)
const jobInputNoneSchema = z.object({
  ...baseFields,
  type: z.literal("none"),
  data: z
    .object({
      description: z.string().optional(),
    })
    .optional(),
  validations: z.array(validationRuleSchema).optional(),
});

// --- Union schema (all 20 types) ---

export const jobInputSchema = z.discriminatedUnion("type", [
  jobInputTextSchema,
  jobInputStringSchema,
  jobInputTextareaSchema,
  jobInputNumberSchema,
  jobInputBooleanSchema,
  jobInputCheckboxSchema,
  jobInputEmailSchema,
  jobInputPasswordSchema,
  jobInputTelSchema,
  jobInputUrlSchema,
  jobInputSearchSchema,
  jobInputDateSchema,
  jobInputDatetimeLocalSchema,
  jobInputTimeSchema,
  jobInputMonthSchema,
  jobInputWeekSchema,
  jobInputColorSchema,
  jobInputRangeSchema,
  jobInputOptionSchema,
  jobInputRadioSchema,
  jobInputFileSchema,
  jobInputHiddenSchema,
  jobInputNoneSchema,
]);

export type JobInputSchemaType = z.infer<typeof jobInputSchema>;

// --- Helper functions ---

/** Check if a field has the `optional: "true"` validation */
export function isOptional(schema: JobInputSchemaType): boolean {
  return (
    schema.validations?.some(
      (v) => v.validation === "optional" && v.value === "true",
    ) ?? false
  );
}

/** Check if an option/radio field is single-select (min=1, max=1) */
export function isSingleOption(schema: JobInputSchemaType): boolean {
  if (schema.type !== "option") return false;
  const min = schema.validations?.find((v) => v.validation === "min");
  const max = schema.validations?.find((v) => v.validation === "max");
  return min?.value === "1" && max?.value === "1";
}

/** Get the default value for a field type */
export function getDefaultValue(
  schema: JobInputSchemaType,
): string | number | boolean | string[] {
  switch (schema.type) {
    case "text":
    case "string":
    case "email":
    case "password":
    case "tel":
    case "url":
    case "search":
    case "textarea":
      return (
        (schema.data && "default" in schema.data && schema.data.default) ?? ""
      );

    case "number":
      return 0;

    case "boolean":
    case "checkbox":
      return schema.data?.default ?? false;

    case "date":
    case "datetime-local":
    case "time":
    case "month":
    case "week":
      return (
        (schema.data && "default" in schema.data && schema.data.default) ?? ""
      );

    case "color":
      return (
        (schema.data && "default" in schema.data && schema.data.default) ??
        "#000000"
      );

    case "range": {
      const defaultVal =
        schema.data && "default" in schema.data
          ? schema.data.default
          : undefined;
      const minVal =
        schema.data && "min" in schema.data ? schema.data.min : undefined;
      return defaultVal ?? minVal ?? "50";
    }

    case "option": {
      if (isSingleOption(schema)) {
        return schema.data.default ?? "";
      }
      return schema.data.default ? [schema.data.default] : [];
    }

    case "radio":
      return schema.data.default ?? "";

    case "file":
    case "hidden":
    case "none":
      return "";
  }
}
