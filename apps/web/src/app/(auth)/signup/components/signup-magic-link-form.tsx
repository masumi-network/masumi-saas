"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { requestMagicLinkSignUpAction } from "@/lib/actions/auth.action";
import { PRIVACY_POLICY_URL } from "@/lib/config/privacy-policy-url";
import { objectToFormData } from "@/lib/form-data";
import { zodResolver } from "@/lib/form-zod-resolver";
import {
  type MagicLinkSignUpInput,
  magicLinkSignUpSchema,
} from "@/lib/schemas";

const defaultValues: MagicLinkSignUpInput = {
  name: "",
  email: "",
  termsAccepted: false,
};

export type SignupMagicLinkFormHandle = {
  getValues: () => MagicLinkSignUpInput;
  reset: (values?: MagicLinkSignUpInput) => void;
};

export type SignupMagicLinkFormProps = {
  seedFromPassword?: Partial<MagicLinkSignUpInput> | null;
  onMagicLinkSent: (email: string) => void;
};

export const SignupMagicLinkForm = forwardRef<
  SignupMagicLinkFormHandle,
  SignupMagicLinkFormProps
>(function SignupMagicLinkForm({ seedFromPassword, onMagicLinkSent }, ref) {
  const t = useTranslations("Auth.SignUp");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<MagicLinkSignUpInput>({
    resolver: zodResolver(magicLinkSignUpSchema),
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

  const termsAccepted = useWatch({
    control: form.control,
    name: "termsAccepted",
  });

  async function onSubmit(data: MagicLinkSignUpInput) {
    setIsLoading(true);
    try {
      const result = await requestMagicLinkSignUpAction(objectToFormData(data));

      if ("error" in result) {
        const errorMessage = result.errorKey
          ? tErrors(result.errorKey)
          : result.error;
        toast.error(errorMessage);
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
          name="name"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="sr-only">{t("name")}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder={t("name")}
                  autoComplete="name"
                  className="bg-background"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <FormField
          control={form.control}
          name="termsAccepted"
          render={({ field }) => (
            <FormItem className="w-full flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal">
                  {t("termsAccepted")}{" "}
                  <Link
                    href={PRIVACY_POLICY_URL}
                    target="_blank"
                    className="underline hover:text-foreground"
                  >
                    {t("privacyPolicy")}
                  </Link>
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4 items-center w-full mt-4">
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isLoading || !termsAccepted}
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
