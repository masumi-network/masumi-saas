"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { AgentFormFields } from "./register-agent-form-model";
import type { RegisterAgentController } from "./use-register-agent-controller";

function ExampleOutputsFields({
  form: outputsForm,
  t: outputsT,
}: {
  form: UseFormReturn<AgentFormFields>;
  t: (key: string) => string;
}) {
  const { fields, append, remove } = useFieldArray({
    control: outputsForm.control,
    name: "exampleOutputs",
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <FormLabel>{outputsT("exampleOutputs")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", url: "", mimeType: "" })}
        >
          {outputsT("addExample")}
        </Button>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="relative flex items-center rounded-md border border-border/60 bg-background p-4 gap-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 mb-0">
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.name`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={outputsT("exampleOutputNamePlaceholder")}
                      {...f}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.url`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={outputsT("exampleOutputUrlPlaceholder")}
                      {...f}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={outputsForm.control}
              name={`exampleOutputs.${index}.mimeType`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={outputsT("exampleOutputMimePlaceholder")}
                      {...f}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// Collapsible block of optional URLs, capability and example outputs.
export function RegisterAgentAdditionalFields({
  controller,
}: {
  controller: RegisterAgentController;
}) {
  const {
    t,
    form,
    registrationKind,
    additionalFieldsExpanded,
    setAdditionalFieldsExpanded,
  } = controller;

  return (
    <div>
      <div className="py-4">
        <button
          type="button"
          className="flex w-full items-center gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-expanded={additionalFieldsExpanded}
          onClick={() => setAdditionalFieldsExpanded((prev) => !prev)}
        >
          <Separator className="flex-1" />
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap">
            {t("additionalFields")}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                additionalFieldsExpanded && "rotate-180",
              )}
              aria-hidden
            />
            <span className="sr-only">
              {additionalFieldsExpanded
                ? t("additionalFieldsCollapse")
                : t("additionalFieldsExpand")}
            </span>
          </span>
          <Separator className="flex-1" />
        </button>
      </div>

      <div
        className="grid-expand-wrapper"
        data-expanded={additionalFieldsExpanded ? "true" : "false"}
      >
        <div className="grid-expand-inner">
          <div className="space-y-6 pb-4">
            <FormField
              control={form.control}
              name="termsOfUseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("termsOfUseUrl")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t("termsOfUseUrlPlaceholder")}
                      {...field}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="privacyPolicyUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("privacyPolicyUrl")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t("privacyPolicyUrlPlaceholder")}
                      {...field}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="otherUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("otherUrl")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t("otherUrlPlaceholder")}
                      {...field}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="capabilityName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("capabilityName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("capabilityNamePlaceholder")}
                        {...field}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capabilityVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("capabilityVersion")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("capabilityVersionPlaceholder")}
                        {...field}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {registrationKind === "STANDARD" ? (
              <ExampleOutputsFields
                form={form as unknown as UseFormReturn<AgentFormFields>}
                t={t}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
