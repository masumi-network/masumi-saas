"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { SocialAuthButtons } from "@/auth/components/social-auth-buttons";
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
import {
  requestMagicLinkSignUpAction,
  signUpAction,
} from "@/lib/actions/auth.action";
import { zodResolver } from "@/lib/form-zod-resolver";
import {
  type MagicLinkSignUpInput,
  magicLinkSignUpSchema,
  type SignUpInput,
  signUpSchema,
} from "@/lib/schemas";

interface SignUpFormProps {
  oauthProviders?: ("google" | "github" | "microsoft")[];
}

const PRIVACY_POLICY_URL =
  "https://www.house-of-communication.com/de/en/footer/privacy-policy.html";
const passwordDefaultValues: SignUpInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};
const magicLinkDefaultValues: MagicLinkSignUpInput = {
  name: "",
  email: "",
  termsAccepted: false,
};

function createFormData(values: Record<string, string | boolean>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.append(key, typeof value === "boolean" ? String(value) : value);
  }

  return formData;
}

export default function SignUpForm({ oauthProviders = [] }: SignUpFormProps) {
  const t = useTranslations("Auth.SignUp");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const [usePassword, setUsePassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState<string | null>(null);

  const passwordForm = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: passwordDefaultValues,
  });

  const magicLinkForm = useForm<MagicLinkSignUpInput>({
    resolver: zodResolver(magicLinkSignUpSchema),
    defaultValues: magicLinkDefaultValues,
  });

  const passwordTermsAccepted = useWatch({
    control: passwordForm.control,
    name: "termsAccepted",
  });

  const magicLinkTermsAccepted = useWatch({
    control: magicLinkForm.control,
    name: "termsAccepted",
  });

  function showPasswordFields() {
    const values = magicLinkForm.getValues();

    passwordForm.reset({
      name: values.name,
      email: values.email,
      password: "",
      confirmPassword: "",
      termsAccepted: values.termsAccepted,
    });
    setUsePassword(true);
  }

  function hidePasswordFields() {
    const values = passwordForm.getValues();

    magicLinkForm.reset({
      name: values.name,
      email: values.email,
      termsAccepted: values.termsAccepted,
    });
    passwordForm.reset({
      ...values,
      password: "",
      confirmPassword: "",
    });
    setUsePassword(false);
  }

  async function onPasswordSubmit(data: SignUpInput) {
    setIsPasswordLoading(true);
    try {
      const result = await signUpAction(createFormData(data));

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
      setIsPasswordLoading(false);
    }
  }

  async function onMagicLinkSubmit(data: MagicLinkSignUpInput) {
    setIsMagicLinkLoading(true);
    try {
      const result = await requestMagicLinkSignUpAction(createFormData(data));

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
            <Link href="/signin">{t("login")}</Link>
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
        <SocialAuthButtons providers={oauthProviders} />
      )}

      {usePassword ? (
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="flex flex-col items-center gap-2 w-full"
          >
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="sr-only">
                    {t("confirmPassword")}
                  </FormLabel>
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
              control={passwordForm.control}
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
                disabled={isPasswordLoading || !passwordTermsAccepted}
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
            <FormField
              control={magicLinkForm.control}
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
                disabled={isMagicLinkLoading || !magicLinkTermsAccepted}
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

        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/signin" className="underline hover:text-foreground">
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
