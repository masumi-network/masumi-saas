"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JobInputSchemaType } from "@/lib/schemas/job-input-schema";
import { isOptional, isSingleOption } from "@/lib/schemas/job-input-schema";

interface JobInputRendererProps {
  jobInputSchema: JobInputSchemaType;
  value: string | number | boolean | string[];
  onChange: (value: string | number | boolean | string[]) => void;
  disabled?: boolean;
}

export default function JobInputRenderer({
  jobInputSchema,
  value,
  onChange,
  disabled = false,
}: JobInputRendererProps) {
  const { id, name, type, data } = jobInputSchema;
  const isFieldOptional = isOptional(jobInputSchema);
  const description =
    data && "description" in data ? (data.description as string) : undefined;
  const placeholder =
    data && "placeholder" in data ? (data.placeholder as string) : undefined;

  // Types that render their label inline (not above the field)
  const inlineLabelTypes = new Set(["boolean", "checkbox"]);
  // Types that are not user-visible form fields
  const noLabelTypes = new Set(["none", "hidden"]);

  function renderField() {
    switch (type) {
      // --- Text-like inputs (rendered as <input type="..."> ) ---
      case "text":
      case "string":
        return (
          <Input
            id={id}
            type="text"
            placeholder={placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "email":
        return (
          <Input
            id={id}
            type="email"
            placeholder={placeholder ?? "email@example.com"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "password":
        return (
          <Input
            id={id}
            type="password"
            placeholder={placeholder ?? "••••••••"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "tel":
        return (
          <Input
            id={id}
            type="tel"
            placeholder={placeholder ?? "+1-234-567-8900"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "url":
        return (
          <Input
            id={id}
            type="url"
            placeholder={placeholder ?? "https://example.com"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "search":
        return (
          <Input
            id={id}
            type="search"
            placeholder={placeholder ?? "Search..."}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={id}
            placeholder={placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      // --- Number ---
      case "number":
        return (
          <Input
            id={id}
            type="number"
            placeholder={placeholder}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              onChange(isNaN(num) ? 0 : num);
            }}
            disabled={disabled}
          />
        );

      // --- Boolean / Checkbox  ---
      case "boolean":
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={typeof value === "boolean" ? value : false}
              onCheckedChange={(checked) => onChange(checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={id} className="font-normal cursor-pointer">
              {description ?? name}
            </Label>
          </div>
        );

      // --- Date / Time types ---
      case "date":
        return (
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "datetime-local":
        return (
          <Input
            id={id}
            type="datetime-local"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "time":
        return (
          <Input
            id={id}
            type="time"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "month":
        return (
          <Input
            id={id}
            type="month"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case "week":
        return (
          <Input
            id={id}
            type="week"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      // --- Color picker ---
      case "color":
        return (
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="color"
              value={typeof value === "string" ? value : "#000000"}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-10 w-14 rounded-md border border-input cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground font-mono">
              {typeof value === "string" ? value : "#000000"}
            </span>
          </div>
        );

      // --- Range slider ---
      case "range": {
        const rangeData = data as
          | {
              min?: string;
              max?: string;
              step?: string;
              default?: string;
              description?: string;
            }
          | undefined;
        const min = rangeData?.min ?? "0";
        const max = rangeData?.max ?? "100";
        const step = rangeData?.step ?? "1";
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={typeof value === "string" ? value : min}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
              />
              <span className="text-sm font-mono text-muted-foreground min-w-[3ch] text-right">
                {typeof value === "string" ? value : min}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        );
      }

      // --- Option (single select dropdown / multi-select checkboxes) ---
      case "option": {
        if (isSingleOption(jobInputSchema)) {
          return (
            <Select
              value={typeof value === "string" ? value : ""}
              onValueChange={(val) => onChange(val)}
              disabled={disabled}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {jobInputSchema.data.values.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        // Multi-select: checkboxes
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {jobInputSchema.data.values.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${opt}`}
                  checked={selectedValues.includes(opt)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, opt]);
                    } else {
                      onChange(selectedValues.filter((v) => v !== opt));
                    }
                  }}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${id}-${opt}`}
                  className="font-normal cursor-pointer"
                >
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      // --- Radio (single-select with radio buttons) ---
      case "radio": {
        const currentValue = typeof value === "string" ? value : "";
        return (
          <div className="space-y-2">
            {jobInputSchema.data.values.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`${id}-${opt}`}
                  name={id}
                  value={opt}
                  checked={currentValue === opt}
                  onChange={() => onChange(opt)}
                  disabled={disabled}
                  className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Label
                  htmlFor={`${id}-${opt}`}
                  className="font-normal cursor-pointer"
                >
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      // --- File upload ---
      case "file":
        return (
          <Input
            id={id}
            type="file"
            accept={
              data && "accept" in data ? (data.accept as string) : undefined
            }
            onChange={() => {
              // File handling is preview-only — no actual upload
            }}
            disabled={disabled}
          />
        );

      // --- Hidden field ---
      case "hidden": {
        const hiddenValue =
          data && "value" in data ? (data.value as string) : "";
        return (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {"Hidden value:"}
            </span>
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
              {hiddenValue || "(empty)"}
            </code>
          </div>
        );
      }

      // --- None (static text / instructions) ---
      case "none":
        return (
          <p className="text-sm text-muted-foreground">
            {description ?? "No input required"}
          </p>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-2">
      {/* Standard label (above the field) */}
      {!inlineLabelTypes.has(type) && !noLabelTypes.has(type) && (
        <Label htmlFor={id}>
          {name}
          {!isFieldOptional && (
            <span className="text-destructive ml-0.5">{"*"}</span>
          )}
        </Label>
      )}
      {/* None type shows label without required marker */}
      {type === "none" && <Label>{name}</Label>}
      {/* Hidden type shows a muted label */}
      {type === "hidden" && (
        <Label className="text-muted-foreground">
          {name}
          <span className="text-xs ml-1">{"(hidden)"}</span>
        </Label>
      )}

      {renderField()}

      {/* Description below the field (skipped for boolean/checkbox which show it inline, and none/hidden types) */}

      {!inlineLabelTypes.has(type) &&
        !noLabelTypes.has(type) &&
        description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
    </div>
  );
}
