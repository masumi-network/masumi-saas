"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { requestMagicLinkSignInAction } from "@/lib/actions/auth.action";
import { objectToFormData } from "@/lib/form-data";
import { zodResolver } from "@/lib/form-zod-resolver";
import {
  type MagicLinkSignInInput,
  magicLinkSignInSchema,
} from "@/lib/schemas";

const defaultValues: MagicLinkSignInInput = {
  email: "",
};

export type SigninMagicLinkFormHandle = {
  getValues: () => MagicLinkSignInInput;
  reset: (values?: MagicLinkSignInInput) => void;
};

export type SigninMagicLinkFormProps = {
  seedFromPassword?: Partial<MagicLinkSignInInput> | null;
  safeCallbackUrl: string | undefined;
  onMagicLinkSent: (email: string) => void;
};

export const SigninMagicLinkForm = forwardRef<
  SigninMagicLinkFormHandle,
  SigninMagicLinkFormProps
>(function SigninMagicLinkForm(
  { seedFromPassword, safeCallbackUrl, onMagicLinkSent },
  ref,
) {
  const t = useTranslations("Auth.SignIn");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<MagicLinkSignInInput>({
    resolver: zodResolver(magicLinkSignInSchema),
    defaultValues,
  });

  useImperativeHandle(ref, () => ({
    getValues: () => form.getValues(),
    reset: (values) => form.reset(values ?? defaultValues),
  }));

  useEffect(() => {
    if (!seedFromPassword) return;
    form.reset({
      ...defaultValues,
      ...seedFromPassword,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFromPassword]);

  async function onSubmit(data: MagicLinkSignInInput) {
    setIsLoading(true);
    try {
      const result = await requestMagicLinkSignInAction(
        objectToFormData(data),
        safeCallbackUrl,
      );

      if ("error" in result) {
        toast.error(tErrors(result.errorKey));
        return;
      }

      if ("success" in result && result.success) {
        const successMessage = result.resultKey
          ? tResults(result.resultKey)
          : t("magicLinkSuccess");
        toast.success(successMessage);
        onMagicLinkSent(result.email ?? data.email);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col items-center gap-2 w-full"
      >
        <p className="mx-auto w-full max-w-md text-center text-sm text-muted-foreground">
          {t("magicLinkDescription")}
        </p>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="sr-only">{t("email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("email")}
                  autoComplete="email"
                  className="bg-background"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4 items-center w-full mt-4">
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <Spinner size={16} className="mr-2" />
                {t("magicLinkSubmitting")}
              </>
            ) : (
              t("magicLinkSubmit")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
});
