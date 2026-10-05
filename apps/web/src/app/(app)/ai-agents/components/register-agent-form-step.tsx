"use client";

import { ArrowRight, Plug, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogContentPanel,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { X402Logo } from "@/components/x402/x402-logo";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

import { AgentIconPicker } from "./agent-icon-picker";
import { MainnetCreditsRequiredNotice } from "./mainnet-credits-required-notice";
import { RegisterAgentAdditionalFields } from "./register-agent-additional-fields";
import { RegisterAgentStandardFields } from "./register-agent-standard-fields";
import { RegisterAgentX402Section } from "./register-agent-x402-section";
import type { RegisterAgentController } from "./use-register-agent-controller";

export function RegisterAgentFormStep({
  controller,
}: {
  controller: RegisterAgentController;
}) {
  const {
    t,
    form,
    registrationKind,
    registerDialogBodyRef,
    mainnetCreditsGate,
    isLoading,
    tags,
    tagInput,
    setTagInput,
    handleAddTag,
    handleRemoveTag,
    handleRegistrationKindChange,
    handleRegistrationDialogOpenChange,
    goToReview,
  } = controller;

  return (
    <DialogContentPanel
      key="register-agent-form"
      className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
      closeButtonClassName="top-8 right-4 -translate-y-1/2"
    >
      <div
        className={cn(
          "shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12",
          dialogHeaderEnterClass,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {t("formDescription")}
          </DialogDescription>
        </DialogHeader>
      </div>

      <Form {...form}>
        <form
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <DialogBody ref={registerDialogBodyRef} className="space-y-8">
            <MainnetCreditsRequiredNotice />
            <FormField
              control={form.control}
              name="registrationKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("registrationKind")}</FormLabel>
                  <FormControl>
                    <div
                      className="flex rounded-lg border bg-muted/30 p-1"
                      role="radiogroup"
                      aria-label={t("registrationKind")}
                    >
                      {(
                        [
                          {
                            value: "STANDARD" as const,
                            titleKey: "registrationKindStandardTitle",
                            leading: (
                              <Plug className="h-4 w-4 shrink-0" aria-hidden />
                            ),
                          },
                          {
                            value: "X402_HTTP" as const,
                            titleKey: "registrationKindX402Title",
                            leading: (
                              <X402Logo className="-mb-px h-4 w-auto shrink-0" />
                            ),
                          },
                        ] as const
                      ).map((opt) => {
                        const selected = field.value === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={cn(
                              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              selected
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={() => {
                              field.onChange(opt.value);
                              handleRegistrationKindChange(opt.value);
                            }}
                          >
                            {opt.leading}
                            {t(opt.titleKey)}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {registrationKind === "X402_HTTP" ? (
              <RegisterAgentX402Section controller={controller} />
            ) : null}

            <Separator />

            {/* Icon section */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <AgentIconPicker
                  value={field.value ?? "bot"}
                  onChange={field.onChange}
                  onClearError={() => form.clearErrors("icon")}
                  translations={{
                    iconDescription: t("iconDescription"),
                    iconSearchPlaceholder: t("iconSearchPlaceholder"),
                    iconSearchEmpty: t("iconSearchEmpty"),
                    scrollLeft: t("scrollLeft"),
                    scrollRight: t("scrollRight"),
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("descriptionPlaceholder")}
                        {...field}
                        className="min-h-24 resize-none"
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

              {registrationKind === "STANDARD" ? (
                <RegisterAgentStandardFields controller={controller} />
              ) : null}
            </div>

            <Separator />

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={() => (
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <RegisterAgentAdditionalFields controller={controller} />
          </DialogBody>

          <DialogFooter className="shrink-0 w-full justify-between border-t bg-background px-6 py-4">
            <div className="flex shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRegistrationDialogOpenChange(false)}
                disabled={isLoading}
              >
                {t("cancel")}
              </Button>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={
                  isLoading ||
                  mainnetCreditsGate.isBlocked ||
                  mainnetCreditsGate.isPending
                }
                className="group gap-2"
                onClick={goToReview}
              >
                {t("continue")}
                <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 transition-all duration-200 ease-out motion-reduce:transition-none opacity-100 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:group-hover:translate-x-0 motion-reduce:group-active:translate-x-0"
                  />
                </span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Form>
    </DialogContentPanel>
  );
}
