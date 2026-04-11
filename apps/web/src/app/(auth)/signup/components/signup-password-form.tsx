"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { signUpAction } from "@/lib/actions/auth.action";
import { objectToFormData } from "@/lib/form-data";
import { zodResolver } from "@/lib/form-zod-resolver";
import { type SignUpInput, signUpSchema } from "@/lib/schemas";

const PRIVACY_POLICY_URL =
  "https://www.house-of-communication.com/de/en/footer/privacy-policy.html";

const defaultValues: SignUpInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

export type SignupPasswordFormHandle = {
  getValues: () => SignUpInput;
};

export type SignupPasswordFormProps = {
  seedFromMagicLink?: Partial<SignUpInput> | null;
};

export const SignupPasswordForm = forwardRef<
  SignupPasswordFormHandle,
  SignupPasswordFormProps
>(function SignupPasswordForm({ seedFromMagicLink }, ref) {
  const t = useTranslations("Auth.SignUp");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues,
  });

  useImperativeHandle(ref, () => ({
    getValues: () => form.getValues(),
  }));

  useEffect(() => {
    if (!seedFromMagicLink) return;
    form.reset({
      ...defaultValues,
      ...seedFromMagicLink,
      password: "",
      confirmPassword: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFromMagicLink]);

  const termsAccepted = useWatch({
    control: form.control,
    name: "termsAccepted",
  });

  async function onSubmit(data: SignUpInput) {
    setIsLoading(true);
    try {
      const result = await signUpAction(objectToFormData(data));

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
          : t("success");
        toast.success(successMessage);
        router.push("/");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        return;
      }
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
          name="password"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="sr-only">{t("password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={t("password")}
                  autoComplete="new-password"
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
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="sr-only">{t("confirmPassword")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={t("confirmPassword")}
                  autoComplete="new-password"
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
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
});
