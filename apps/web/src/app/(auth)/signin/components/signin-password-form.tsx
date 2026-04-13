"use client";

import { useRouter } from "next/navigation";
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
import { signInAction } from "@/lib/actions/auth.action";
import { objectToFormData } from "@/lib/form-data";
import { zodResolver } from "@/lib/form-zod-resolver";
import { type SignInInput, signInSchema } from "@/lib/schemas";

const defaultValues: SignInInput = {
  email: "",
  password: "",
};

export type SigninPasswordFormHandle = {
  getValues: () => SignInInput;
};

export type SigninPasswordFormProps = {
  seedFromMagicLink?: Partial<SignInInput> | null;
  safeCallbackUrl: string | undefined;
};

export const SigninPasswordForm = forwardRef<
  SigninPasswordFormHandle,
  SigninPasswordFormProps
>(function SigninPasswordForm({ seedFromMagicLink, safeCallbackUrl }, ref) {
  const t = useTranslations("Auth.SignIn");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFromMagicLink]);

  async function onSubmit(data: SignInInput) {
    setIsLoading(true);
    try {
      const result = await signInAction(
        objectToFormData(data),
        safeCallbackUrl,
      );

      if (result && "error" in result) {
        console.error("[signin] Sign-in action returned error result", {
          result,
          safeCallbackUrl,
        });
        toast.error(result.errorKey ? tErrors(result.errorKey) : result.error);
        return;
      }

      if (result && "twoFactorRedirect" in result && result.twoFactorRedirect) {
        console.info("[signin] Redirecting to 2FA", { safeCallbackUrl });
        router.push("/2fa");
        return;
      }

      if (result && "success" in result && result.success) {
        console.info("[signin] Redirecting after successful sign-in", {
          redirectTo: result.redirectTo,
          safeCallbackUrl,
        });
        const successMessage = result.resultKey
          ? tResults(result.resultKey)
          : t("success");
        toast.success(successMessage);
        window.location.assign(result.redirectTo);
        return;
      }

      const fallbackRedirectTo = safeCallbackUrl ?? "/";
      console.warn(
        "[signin] Unexpected sign-in action result, using fallback redirect",
        {
          result,
          fallbackRedirectTo,
        },
      );
      window.location.assign(fallbackRedirectTo);
      return;
    } catch (error) {
      console.error("[signin] Password sign-in failed", {
        safeCallbackUrl,
        error,
      });
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
                  autoComplete="current-password"
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
