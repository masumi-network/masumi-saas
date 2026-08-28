"use client";

import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AgentIconPicker } from "@/app/ai-agents/components/agent-icon-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { zodResolver } from "@/lib/form-zod-resolver";
import { agentMetadataSchema } from "@/lib/schemas/agent";
import { cn } from "@/lib/utils";

type EditAgentFormValues = {
  name: string;
  description?: string;
  apiUrl: string;
  tags?: string;
  icon?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  capabilityName?: string;
  capabilityVersion?: string;
  exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
};

function parseAgentMetadata(agent: Agent): Record<string, unknown> {
  if (!agent.metadata) return {};
  try {
    const parsed = JSON.parse(agent.metadata) as unknown;
    const result = agentMetadataSchema.safeParse(parsed);
    return result.success ? (result.data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function ExampleOutputsFields({
  form,
  t,
}: {
  form: UseFormReturn<EditAgentFormValues>;
  t: (key: string) => string;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "exampleOutputs",
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <FormLabel>{t("exampleOutputs")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", url: "", mimeType: "" })}
        >
          {t("addExample")}
        </Button>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="relative flex items-center gap-2 rounded-md border border-border/60 bg-background p-4"
        >
          <div className="mb-0 grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name={`exampleOutputs.${index}.name`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t("exampleOutputNamePlaceholder")}
                      {...f}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`exampleOutputs.${index}.url`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t("exampleOutputUrlPlaceholder")}
                      {...f}
                      className="h-11 font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`exampleOutputs.${index}.mimeType`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t("exampleOutputMimePlaceholder")}
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
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function buildDefaultValues(agent: Agent): EditAgentFormValues {
  const metadata = parseAgentMetadata(agent);

  return {
    name: agent.name,
    description: agent.description ?? "",
    apiUrl: agent.apiUrl,
    tags: agent.tags.join(", "),
    icon: agent.icon ?? "bot",
    termsOfUseUrl: (metadata.termsOfUseUrl as string | undefined) ?? "",
    privacyPolicyUrl: (metadata.privacyPolicyUrl as string | undefined) ?? "",
    otherUrl: (metadata.otherUrl as string | undefined) ?? "",
    capabilityName: (metadata.capabilityName as string | undefined) ?? "",
    capabilityVersion: (metadata.capabilityVersion as string | undefined) ?? "",
    exampleOutputs:
      (metadata.exampleOutputs as EditAgentFormValues["exampleOutputs"]) ?? [],
  };
}

export function EditAgentDialog({
  agent,
  open,
  onOpenChange,
  onUpdated,
}: {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (agent: Agent) => void;
}) {
  const t = useTranslations("App.Agents.Edit");
  const tRegister = useTranslations("App.Agents.Register");
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(agent.tags);

  const editAgentSchema = z
    .object({
      name: z
        .string()
        .min(1, tRegister("nameRequired"))
        .max(250, tRegister("nameMaxLength")),
      description: z
        .string()
        .max(250, tRegister("descriptionMaxLength"))
        .optional()
        .or(z.literal("")),
      apiUrl: z
        .string()
        .min(1, tRegister("apiUrlInvalid"))
        .refine(
          (val) => {
            try {
              const parsed = new URL(val);
              return (
                parsed.protocol === "http:" || parsed.protocol === "https:"
              );
            } catch {
              return false;
            }
          },
          { message: tRegister("apiUrlInvalid") },
        ),
      tags: z.string().optional(),
      icon: z.string().max(2000).optional(),
      termsOfUseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      privacyPolicyUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
      capabilityName: z.string().max(250).optional().or(z.literal("")),
      capabilityVersion: z.string().max(250).optional().or(z.literal("")),
      exampleOutputs: z
        .array(
          z.object({
            name: z.string().max(60),
            url: z.string(),
            mimeType: z.string().max(60),
          }),
        )
        .optional(),
    })
    .superRefine((_data, ctx) => {
      if (tags.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: tRegister("tagsRequired"),
          path: ["tags"],
        });
      }
    });

  const form = useForm<EditAgentFormValues>({
    resolver: zodResolver(editAgentSchema),
    defaultValues: buildDefaultValues(agent),
  });

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(agent));
      setTags(agent.tags);
      setTagInput("");
    }
  }, [open, agent, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    onOpenChange(nextOpen);
  };

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    const nextTags = [...tags, value];
    setTags(nextTags);
    form.setValue("tags", nextTags.join(", "), { shouldValidate: true });
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    const nextTags = tags.filter((entry) => entry !== tag);
    setTags(nextTags);
    form.setValue("tags", nextTags.join(", "), { shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      const result = await agentApiClient.updateAgent(agent.id, {
        name: values.name.trim(),
        description: values.description?.trim() || "",
        tags: tags.join(", "),
        apiUrl: values.apiUrl.trim(),
        icon: values.icon,
        termsOfUseUrl: values.termsOfUseUrl,
        privacyPolicyUrl: values.privacyPolicyUrl,
        otherUrl: values.otherUrl,
        capabilityName: values.capabilityName,
        capabilityVersion: values.capabilityVersion,
        exampleOutputs: values.exampleOutputs,
      });

      if (!result.success) {
        toast.error(result.error ?? t("error"));
        return;
      }

      toast.success(t("success"));
      onUpdated(result.data);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div
          className={cn(
            "shrink-0 border-b bg-masumi-gradient px-6 py-4 pr-12",
            dialogHeaderEnterClass,
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("title")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="space-y-4 overflow-y-auto py-5">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <AgentIconPicker
                    value={field.value ?? "bot"}
                    onChange={field.onChange}
                    onClearError={() => form.clearErrors("icon")}
                    disabled={isSaving}
                    translations={{
                      icon: tRegister("icon"),
                      iconTooltip: tRegister("iconTooltip"),
                      iconDescription: tRegister("iconDescription"),
                      iconSearchPlaceholder: tRegister("iconSearchPlaceholder"),
                      iconSearchEmpty: tRegister("iconSearchEmpty"),
                      scrollLeft: tRegister("scrollLeft"),
                      scrollRight: tRegister("scrollRight"),
                    }}
                  />
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tRegister("name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tRegister("namePlaceholder")}
                        {...field}
                        className="h-11"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tRegister("description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={tRegister("descriptionPlaceholder")}
                        {...field}
                        className="min-h-[72px] resize-none"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tRegister("apiUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tRegister("apiUrlPlaceholder")}
                        {...field}
                        className="h-11 font-mono text-sm"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={() => (
                  <FormItem>
                    <FormLabel>{tRegister("tags")}</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder={tRegister("tagsPlaceholder")}
                        className="h-11"
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        onClick={handleAddTag}
                        variant="secondary"
                        className="shrink-0"
                        disabled={isSaving}
                      >
                        {tRegister("addTag")}
                      </Button>
                    </div>
                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="gap-1.5 py-1.5 pl-2.5 pr-1 text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="rounded-full p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive"
                              disabled={isSaving}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 pt-2">
                <Separator className="flex-1" />
                <h3 className="whitespace-nowrap text-sm font-medium text-muted-foreground">
                  {tRegister("additionalFields")}
                </h3>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="termsOfUseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tRegister("termsOfUseUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("termsOfUseUrlPlaceholder")}
                          {...field}
                          className="h-11 font-mono text-sm"
                          disabled={isSaving}
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
                      <FormLabel>{tRegister("privacyPolicyUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("privacyPolicyUrlPlaceholder")}
                          {...field}
                          className="h-11 font-mono text-sm"
                          disabled={isSaving}
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
                      <FormLabel>{tRegister("otherUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("otherUrlPlaceholder")}
                          {...field}
                          className="h-11 font-mono text-sm"
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capabilityName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tRegister("capabilityName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("capabilityNamePlaceholder")}
                          {...field}
                          className="h-11"
                          disabled={isSaving}
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
                      <FormLabel>{tRegister("capabilityVersion")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister(
                            "capabilityVersionPlaceholder",
                          )}
                          {...field}
                          className="h-11"
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <ExampleOutputsFields form={form} t={tRegister} />
            </DialogBody>

            <DialogFooter className="shrink-0 flex justify-end gap-2 border-t bg-background px-6 py-3">
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {tRegister("cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="w-fit"
                disabled={isSaving}
              >
                {isSaving ? <Spinner size={16} className="mr-2" /> : null}
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
