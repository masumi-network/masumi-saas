"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelp, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { agentApiClient } from "@/lib/api/agent.client";

import { AgentIconPicker } from "./agent-icon-picker";

const CURRENCY_SYMBOL = "$";

type RegisterAgentFormType = AgentFormFields & { apiUrl: string };

interface RegisterAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export type AgentFormFields = {
  name: string;
  summary?: string;
  description?: string;
  isFree: boolean;
  prices: Array<{ amount: string }>;
  tags?: string;
  icon?: string;
  authorName?: string;
  authorEmail?: string;
  organization?: string;
  contactOther?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  capabilityName?: string;
  capabilityVersion?: string;
  exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
};

export function ExampleOutputsFields({
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
          className="relative rounded-md border border-border/60 bg-background p-4 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            className="absolute top-2 right-2"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function PricingFields({
  form: pricingForm,
  t: pricingT,
}: {
  form: UseFormReturn<AgentFormFields>;
  t: (key: string) => string;
}) {
  const { fields, append, remove } = useFieldArray({
    control: pricingForm.control,
    name: "prices",
  });
  const isFree = pricingForm.watch("isFree");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel>{pricingT("prices")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFree}
          onClick={() => append({ amount: "" })}
        >
          {pricingT("addPrice")}
        </Button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2 items-start">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-muted-foreground text-sm shrink-0">
              {CURRENCY_SYMBOL}
            </span>
            <FormField
              control={pricingForm.control}
              name={`prices.${index}.amount`}
              render={({ field: amountField }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      disabled={isFree}
                      {...amountField}
                      className="h-11"
                      onChange={(e) => amountField.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isFree}
              onClick={() => remove(index)}
              className="shrink-0 mt-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {pricingForm.formState.errors.prices && (
        <p className="text-sm text-destructive">
          {pricingForm.formState.errors.prices.message}
        </p>
      )}
    </div>
  );
}

export function RegisterAgentDialog({
  open,
  onClose,
  onSuccess,
}: RegisterAgentDialogProps) {
  const t = useTranslations("App.Agents.Register");

  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const registerAgentSchema = z
    .object({
      name: z.string().min(1, t("nameRequired")).max(250, t("nameMaxLength")),
      summary: z
        .string()
        .max(250, t("summaryMaxLength"))
        .optional()
        .or(z.literal("")),
      description: z
        .string()
        .max(5000, t("descriptionMaxLength"))
        .optional()
        .or(z.literal("")),
      apiUrl: z
        .string()
        .url(t("apiUrlInvalid"))
        .refine(
          (val) => val.startsWith("http://") || val.startsWith("https://"),
          {
            message: t("apiUrlProtocol"),
          },
        ),
      isFree: z.boolean(),
      prices: z.array(z.object({ amount: z.string() })),
      tags: z.string().optional(),
      icon: z.string().max(2000).optional(),
      authorName: z.string().max(250).optional(),
      authorEmail: z
        .union([z.literal(""), z.string().email().max(250)])
        .optional(),
      organization: z.string().max(250).optional(),
      contactOther: z.string().max(250).optional(),
      termsOfUseUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      privacyPolicyUrl: z
        .union([z.literal(""), z.string().url().max(250)])
        .optional(),
      otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
      capabilityName: z.string().max(250).optional(),
      capabilityVersion: z.string().max(250).optional(),
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
    .refine(
      (data) => {
        if (data.isFree) return true;
        const filled = (data.prices ?? []).filter((p) => p.amount?.trim());
        return filled.length > 0;
      },
      { message: t("priceAmountRequired"), path: ["prices"] },
    );

  const form = useForm<RegisterAgentFormType>({
    resolver: zodResolver(registerAgentSchema),
    defaultValues: {
      name: "",
      summary: "",
      description: "",
      apiUrl: "",
      isFree: false,
      prices: [{ amount: "" }],
      tags: "",
      icon: "bot",
      authorName: "",
      authorEmail: "",
      organization: "",
      contactOther: "",
      termsOfUseUrl: "",
      privacyPolicyUrl: "",
      otherUrl: "",
      capabilityName: "",
      capabilityVersion: "",
      exampleOutputs: [],
    },
  });

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
      form.setValue("tags", [...tags, tag].join(", "));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags.join(", "));
  };

  const onSubmit = async (data: RegisterAgentFormType) => {
    setIsLoading(true);
    try {
      const pricing = data.isFree
        ? { pricingType: "Free" as const }
        : {
            pricingType: "Fixed" as const,
            prices: (data.prices ?? [])
              .filter((p) => p.amount?.trim())
              .map((p) => ({ amount: p.amount.trim(), currency: "USD" })),
          };

      const exampleOutputs =
        data.exampleOutputs
          ?.filter((e) => e.name?.trim() && e.url?.trim() && e.mimeType?.trim())
          .map((e) => ({
            name: e.name.trim(),
            url: e.url.trim(),
            mimeType: e.mimeType.trim(),
          })) ?? [];

      const result = await agentApiClient.registerAgent({
        name: data.name,
        summary: data.summary?.trim() || undefined,
        description: data.description?.trim() || undefined,
        apiUrl: data.apiUrl,
        pricing: data.isFree
          ? pricing
          : (pricing.prices?.length ?? 0) > 0
            ? pricing
            : undefined,
        tags: tags.join(", "),
        icon: data.icon?.trim() || undefined,
        authorName: data.authorName?.trim() || undefined,
        authorEmail: data.authorEmail?.trim() || undefined,
        organization: data.organization?.trim() || undefined,
        contactOther: data.contactOther?.trim() || undefined,
        termsOfUseUrl: data.termsOfUseUrl?.trim() || undefined,
        privacyPolicyUrl: data.privacyPolicyUrl?.trim() || undefined,
        otherUrl: data.otherUrl?.trim() || undefined,
        capabilityName: data.capabilityName?.trim() || undefined,
        capabilityVersion: data.capabilityVersion?.trim() || undefined,
        exampleOutputs: exampleOutputs.length > 0 ? exampleOutputs : undefined,
      });

      if (result.success) {
        toast.success(t("success"));
        form.reset();
        setTags([]);
        setTagInput("");
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || t("error"));
      }
    } catch (error) {
      toast.error(t("error"));
      console.error("Failed to register agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isLoading) return;
    if (!newOpen) {
      form.reset({
        name: "",
        summary: "",
        description: "",
        apiUrl: "",
        isFree: false,
        prices: [{ amount: "" }],
        tags: "",
        icon: "bot",
        authorName: "",
        authorEmail: "",
        organization: "",
        contactOther: "",
        termsOfUseUrl: "",
        privacyPolicyUrl: "",
        otherUrl: "",
        capabilityName: "",
        capabilityVersion: "",
        exampleOutputs: [],
      });
      setTags([]);
      setTagInput("");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0">
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("title")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Icon section */}
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <AgentIconPicker
                    value={field.value ?? "bot"}
                    onChange={field.onChange}
                    onClearError={() => form.clearErrors("icon")}
                    onClearIcon={() => form.setValue("icon", "bot")}
                    translations={{
                      icon: t("icon"),
                      iconTooltip: t("iconTooltip"),
                      iconDescription: t("iconDescription"),
                      iconCustomUrlPlaceholder: t("iconCustomUrlPlaceholder"),
                      scrollLeft: t("scrollLeft"),
                      scrollRight: t("scrollRight"),
                      iconClear: t("iconClear"),
                    }}
                  />
                )}
              />

              <Separator />

              {/* Basic info */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("namePlaceholder")}
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
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("summary")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("summaryPlaceholder")}
                          {...field}
                          className="h-11"
                          maxLength={251}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {(field.value ?? "").length}
                        {" / "}
                        {250}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>{t("description")}</FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                              <CircleHelp className="h-4 w-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("descriptionRichTextHint")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <FormControl>
                        <RichTextEditor
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={t("descriptionPlaceholder")}
                          minHeight="min-h-28"
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
                      <FormLabel>{t("apiUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={t("apiUrlPlaceholder")}
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
                  name="isFree"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        {t("isFree")}
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <PricingFields
                  form={form as unknown as UseFormReturn<AgentFormFields>}
                  t={t}
                />
              </div>

              <Separator />

              {/* Tags */}
              <FormItem>
                <FormLabel>{t("tags")}</FormLabel>
                <div className="flex gap-2 items-center">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={t("tagsPlaceholder")}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="secondary"
                    className="shrink-0"
                  >
                    {t("addTag")}
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="gap-1.5 py-1.5 pl-2.5 pr-1 text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </FormItem>

              <div className="flex items-center gap-4 pt-2">
                <Separator className="flex-1" />
                <h3 className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {t("additionalFields")}
                </h3>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authorName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("authorNamePlaceholder")}
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
                  name="authorEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authorEmail")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("authorEmailPlaceholder")}
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
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("organization")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("organizationPlaceholder")}
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
                  name="contactOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contactOther")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("contactOtherPlaceholder")}
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
                <ExampleOutputsFields
                  form={form as unknown as UseFormReturn<AgentFormFields>}
                  t={t}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOnOpenChange(false)}
                disabled={isLoading}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading && <Spinner size={16} className="mr-2" />}
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
