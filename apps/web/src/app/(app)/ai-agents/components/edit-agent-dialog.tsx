"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentIconPicker } from "./agent-icon-picker";
import {
  type AgentFormFields,
  ExampleOutputsFields,
  PricingFields,
} from "./register-agent-dialog";

interface EditAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  agent: Agent;
}

function parseAgentMetadata(agent: Agent): Partial<AgentFormFields> {
  const meta: Partial<AgentFormFields> = {};
  if (!agent.metadata) return meta;
  try {
    const parsed = JSON.parse(agent.metadata) as Record<string, unknown>;
    if (typeof parsed.authorName === "string")
      meta.authorName = parsed.authorName;
    if (typeof parsed.authorEmail === "string")
      meta.authorEmail = parsed.authorEmail;
    if (typeof parsed.organization === "string")
      meta.organization = parsed.organization;
    if (typeof parsed.contactOther === "string")
      meta.contactOther = parsed.contactOther;
    if (typeof parsed.termsOfUseUrl === "string")
      meta.termsOfUseUrl = parsed.termsOfUseUrl;
    if (typeof parsed.privacyPolicyUrl === "string")
      meta.privacyPolicyUrl = parsed.privacyPolicyUrl;
    if (typeof parsed.otherUrl === "string") meta.otherUrl = parsed.otherUrl;
    if (typeof parsed.capabilityName === "string")
      meta.capabilityName = parsed.capabilityName;
    if (typeof parsed.capabilityVersion === "string")
      meta.capabilityVersion = parsed.capabilityVersion;
    if (
      Array.isArray(parsed.exampleOutputs) &&
      parsed.exampleOutputs.every(
        (e): e is { name: string; url: string; mimeType: string } =>
          e != null &&
          typeof e === "object" &&
          typeof (e as { name?: unknown }).name === "string" &&
          typeof (e as { url?: unknown }).url === "string" &&
          typeof (e as { mimeType?: unknown }).mimeType === "string",
      )
    ) {
      meta.exampleOutputs = parsed.exampleOutputs;
    }
  } catch {
    // ignore parse errors
  }
  return meta;
}

export function EditAgentDialog({
  open,
  onClose,
  onSuccess,
  agent,
}: EditAgentDialogProps) {
  const t = useTranslations("App.Agents.Edit");
  const tRegister = useTranslations("App.Agents.Register");

  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const editAgentSchema = z
    .object({
      name: z
        .string()
        .min(1, tRegister("nameRequired"))
        .max(250, tRegister("nameMaxLength")),
      summary: z
        .string()
        .max(250, tRegister("summaryMaxLength"))
        .optional()
        .or(z.literal("")),
      description: z
        .string()
        .max(5000, tRegister("descriptionMaxLength"))
        .optional()
        .or(z.literal("")),
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
      { message: tRegister("priceAmountRequired"), path: ["prices"] },
    );

  const metadata = parseAgentMetadata(agent);
  const pricing = agent.pricing as
    | { pricingType: "Free" }
    | { pricingType: "Fixed"; prices: Array<{ amount: string }> }
    | null;
  const isFree = !pricing || pricing.pricingType === "Free";
  const prices =
    pricing?.pricingType === "Fixed" && pricing.prices?.length
      ? pricing.prices.map((p) => ({ amount: p.amount }))
      : [{ amount: "" }];

  const form = useForm<AgentFormFields>({
    resolver: zodResolver(editAgentSchema),
    defaultValues: {
      name: agent.name,
      summary: agent.summary ?? "",
      description: agent.description ?? "",
      isFree,
      prices,
      tags: agent.tags?.join(", ") ?? "",
      icon: agent.icon ?? "bot",
      authorName: metadata.authorName ?? "",
      authorEmail: metadata.authorEmail ?? "",
      organization: metadata.organization ?? "",
      contactOther: metadata.contactOther ?? "",
      termsOfUseUrl: metadata.termsOfUseUrl ?? "",
      privacyPolicyUrl: metadata.privacyPolicyUrl ?? "",
      otherUrl: metadata.otherUrl ?? "",
      capabilityName: metadata.capabilityName ?? "",
      capabilityVersion: metadata.capabilityVersion ?? "",
      exampleOutputs: metadata.exampleOutputs ?? [],
    },
  });

  useEffect(() => {
    if (open && agent) {
      const meta = parseAgentMetadata(agent);
      const p = agent.pricing as
        | { pricingType: "Free" }
        | { pricingType: "Fixed"; prices: Array<{ amount: string }> }
        | null;
      const free = !p || p.pricingType === "Free";
      const pr =
        p?.pricingType === "Fixed" && p.prices?.length
          ? p.prices.map((x) => ({ amount: x.amount }))
          : [{ amount: "" }];
      form.reset({
        name: agent.name,
        summary: agent.summary ?? "",
        description: agent.description ?? "",
        isFree: free,
        prices: pr,
        tags: agent.tags?.join(", ") ?? "",
        icon: agent.icon ?? "bot",
        authorName: meta.authorName ?? "",
        authorEmail: meta.authorEmail ?? "",
        organization: meta.organization ?? "",
        contactOther: meta.contactOther ?? "",
        termsOfUseUrl: meta.termsOfUseUrl ?? "",
        privacyPolicyUrl: meta.privacyPolicyUrl ?? "",
        otherUrl: meta.otherUrl ?? "",
        capabilityName: meta.capabilityName ?? "",
        capabilityVersion: meta.capabilityVersion ?? "",
        exampleOutputs: meta.exampleOutputs ?? [],
      });
      setTags(agent.tags ?? []);
    }
  }, [open, agent, form]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag];
      setTags(newTags);
      setTagInput("");
      form.setValue("tags", newTags.join(", "));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags.join(", "));
  };

  const onSubmit = async (data: AgentFormFields) => {
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

      const result = await agentApiClient.updateAgent(agent.id, {
        name: data.name,
        summary: data.summary?.trim() || null,
        description: data.description?.trim() || null,
        tags: tags,
        icon: data.icon?.trim() || null,
        pricing: data.isFree
          ? pricing
          : (pricing.prices?.length ?? 0) > 0
            ? pricing
            : null,
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
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || t("error"));
      }
    } catch (error) {
      toast.error(t("error"));
      console.error("Failed to update agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isLoading) return;
    if (!newOpen) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
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
                      icon: tRegister("icon"),
                      iconTooltip: tRegister("iconTooltip"),
                      iconDescription: tRegister("iconDescription"),
                      iconCustomUrlPlaceholder: tRegister(
                        "iconCustomUrlPlaceholder",
                      ),
                      scrollLeft: tRegister("scrollLeft"),
                      scrollRight: tRegister("scrollRight"),
                      iconClear: tRegister("iconClear"),
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
                      <FormLabel>{tRegister("name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("namePlaceholder")}
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
                      <FormLabel>{tRegister("summary")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("summaryPlaceholder")}
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
                        <FormLabel>{tRegister("description")}</FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                              <CircleHelp className="h-4 w-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {tRegister("descriptionRichTextHint")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <FormControl>
                        <RichTextEditor
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={tRegister("descriptionPlaceholder")}
                          minHeight="min-h-28"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-4">
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
                        {tRegister("isFree")}
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <PricingFields form={form} t={tRegister} />
              </div>

              <Separator />

              {/* Tags */}
              <FormItem>
                <FormLabel>{tRegister("tags")}</FormLabel>
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
                    placeholder={tRegister("tagsPlaceholder")}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="secondary"
                    className="shrink-0"
                  >
                    {tRegister("addTag")}
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
                  {tRegister("additionalFields")}
                </h3>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tRegister("authorName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("authorNamePlaceholder")}
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
                      <FormLabel>{tRegister("authorEmail")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={tRegister("authorEmailPlaceholder")}
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
                      <FormLabel>{tRegister("organization")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("organizationPlaceholder")}
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
                      <FormLabel>{tRegister("contactOther")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tRegister("contactOtherPlaceholder")}
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
                      <FormLabel>{tRegister("termsOfUseUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("termsOfUseUrlPlaceholder")}
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
                      <FormLabel>{tRegister("privacyPolicyUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("privacyPolicyUrlPlaceholder")}
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
                      <FormLabel>{tRegister("otherUrl")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={tRegister("otherUrlPlaceholder")}
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
                        <FormLabel>{tRegister("capabilityName")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tRegister("capabilityNamePlaceholder")}
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
                        <FormLabel>{tRegister("capabilityVersion")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tRegister(
                              "capabilityVersionPlaceholder",
                            )}
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <ExampleOutputsFields form={form} t={tRegister} />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOnOpenChange(false)}
                disabled={isLoading}
              >
                {tRegister("cancel")}
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
