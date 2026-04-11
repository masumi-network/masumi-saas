"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SocialAuthButtons } from "@/auth/components/social-auth-buttons";
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
import {
  requestMagicLinkSignInAction,
  signInAction,
} from "@/lib/actions/auth.action";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { zodResolver } from "@/lib/form-zod-resolver";
import {
  type MagicLinkSignInInput,
  magicLinkSignInSchema,
  type SignInInput,
  signInSchema,
} from "@/lib/schemas";

interface SignInFormProps {
  oauthProviders?: ("google" | "github" | "microsoft")[];
  /** After sign-in, redirect here (e.g. from accept-invitation link). Must be a path on our origin. */
  callbackUrl?: string;
}

const passwordDefaultValues: SignInInput = {
  email: "",
  password: "",
};
const magicLinkDefaultValues: MagicLinkSignInInput = {
  email: "",
};

function createFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }

  return formData;
}

export default function SignInForm({
  oauthProviders = [],
  callbackUrl,
}: SignInFormProps) {
  const t = useTranslations("Auth.SignIn");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  const [usePassword, setUsePassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState<string | null>(null);

  const passwordForm = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: passwordDefaultValues,
  });

  const magicLinkForm = useForm<MagicLinkSignInInput>({
    resolver: zodResolver(magicLinkSignInSchema),
    defaultValues: magicLinkDefaultValues,
  });

  function showPasswordFields() {
    passwordForm.reset({
      email: magicLinkForm.getValues("email"),
      password: "",
    });
    setUsePassword(true);
  }

  function hidePasswordFields() {
    magicLinkForm.reset({
      email: passwordForm.getValues("email"),
    });
    passwordForm.reset({
      email: passwordForm.getValues("email"),
      password: "",
    });
    setUsePassword(false);
  }

  async function onPasswordSubmit(data: SignInInput) {
    setIsPasswordLoading(true);
    try {
      const result = await signInAction(createFormData(data));

      if ("error" in result) {
        toast.error(result.errorKey ? tErrors(result.errorKey) : result.error);
        return;
      }

      if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
        router.push("/2fa");
        return;
      }

      if ("success" in result && result.success) {
        const successMessage = result.resultKey
          ? tResults(result.resultKey)
          : t("success");
        toast.success(successMessage);
        router.push(safeCallbackUrl ?? "/");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsPasswordLoading(false);
    }
  }

  async function onMagicLinkSubmit(data: MagicLinkSignInInput) {
    setIsMagicLinkLoading(true);
    try {
      const result = await requestMagicLinkSignInAction(
        createFormData(data),
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
        setMagicLinkEmail(result.email ?? data.email);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsMagicLinkLoading(false);
    }
  }

  if (magicLinkEmail) {
    return (
      <div className="w-full max-w-form space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-light tracking-tight mb-4">
            {t("checkEmail.title")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-md mx-auto">
            {t("checkEmail.description", { email: magicLinkEmail })}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMagicLinkEmail(null);
              setUsePassword(false);
              magicLinkForm.reset(magicLinkDefaultValues);
              passwordForm.reset(passwordDefaultValues);
            }}
          >
            {t("checkEmail.tryAnother")}
          </Button>
          <Button variant="primary" asChild>
            <Link href="/signup">{t("register")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-form space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-light tracking-tight mb-4">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          {t("description")}
        </p>
      </div>

      {oauthProviders.length > 0 && (
        <SocialAuthButtons
          providers={oauthProviders}
          callbackURL={safeCallbackUrl}
        />
      )}

      {usePassword ? (
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="flex flex-col items-center gap-2 w-full"
          >
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
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
                disabled={isPasswordLoading}
                size="lg"
              >
                {isPasswordLoading ? (
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
      ) : (
        <Form {...magicLinkForm}>
          <form
            onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)}
            className="flex flex-col items-center gap-2 w-full"
          >
            <p className="w-full text-sm text-muted-foreground">
              {t("magicLinkDescription")}
            </p>

            <FormField
              control={magicLinkForm.control}
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
                disabled={isMagicLinkLoading}
                size="lg"
              >
                {isMagicLinkLoading ? (
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
      )}

      <div className="flex flex-col gap-3 w-full">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto justify-start px-0"
          onClick={usePassword ? hidePasswordFields : showPasswordFields}
        >
          {usePassword ? t("useMagicLink") : t("usePassword")}
        </Button>

        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between w-full">
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/signup" className="underline hover:text-foreground">
              {t("register")}
            </Link>
          </p>
          {usePassword && (
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
