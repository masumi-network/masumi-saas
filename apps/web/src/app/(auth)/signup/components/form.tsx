"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
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
import { Tabs } from "@/components/ui/tabs";
import {
  requestMagicLinkSignUpAction,
  signUpAction,
} from "@/lib/actions/auth.action";
import { zodResolver } from "@/lib/form-zod-resolver";
import {
  type MagicLinkSignUpInput,
  type SignUpInput,
  magicLinkSignUpSchema,
  signUpSchema,
} from "@/lib/schemas";

interface SignUpFormProps {
  oauthProviders?: ("google" | "github" | "microsoft")[];
}

type SignUpMethod = "password" | "magic-link";
type SignUpBaseFields = {
  name: string;
  email: string;
  termsAccepted: boolean;
};
type PasswordSignUpFields = SignUpBaseFields & {
  password: string;
  confirmPassword: string;
};

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

function NameField<TFieldValues extends SignUpBaseFields>({
  form,
  label,
}: {
  form: UseFormReturn<TFieldValues>;
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={"name" as FieldPath<TFieldValues>}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel className="sr-only">{label}</FormLabel>
          <FormControl>
            <Input
              type="text"
              placeholder={label}
              autoComplete="name"
              className="bg-background"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EmailField<TFieldValues extends SignUpBaseFields>({
  form,
  label,
}: {
  form: UseFormReturn<TFieldValues>;
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={"email" as FieldPath<TFieldValues>}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel className="sr-only">{label}</FormLabel>
          <FormControl>
            <Input
              type="email"
              placeholder={label}
              autoComplete="email"
              className="bg-background"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PasswordField<TFieldValues extends PasswordSignUpFields>({
  form,
  name,
  placeholder,
}: {
  form: UseFormReturn<TFieldValues>;
  name: "password" | "confirmPassword";
  placeholder: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel className="sr-only">{placeholder}</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder={placeholder}
              autoComplete="new-password"
              className="bg-background"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TermsAcceptedField<TFieldValues extends SignUpBaseFields>({
  form,
  termsLabel,
  privacyPolicyLabel,
}: {
  form: UseFormReturn<TFieldValues>;
  termsLabel: string;
  privacyPolicyLabel: string;
}) {
  return (
    <FormField
      control={form.control}
      name={"termsAccepted" as FieldPath<TFieldValues>}
      render={({ field }) => (
        <FormItem className="w-full flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="text-sm font-normal">
              {termsLabel}{" "}
              <Link
                href={PRIVACY_POLICY_URL}
                target="_blank"
                className="underline hover:text-foreground"
              >
                {privacyPolicyLabel}
              </Link>
            </FormLabel>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default function SignUpForm({ oauthProviders = [] }: SignUpFormProps) {
  const t = useTranslations("Auth.SignUp");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const [activeMethod, setActiveMethod] = useState<SignUpMethod>("password");
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

  async function onPasswordSubmit(data: SignUpInput) {
    setIsPasswordLoading(true);
    try {
      const result = await signUpAction(createFormData(data));

      if (result?.error) {
        const errorMessage = result.errorKey
          ? tErrors(result.errorKey)
          : result.error;
        toast.error(errorMessage);
        setIsPasswordLoading(false);
      } else if (result?.success) {
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
      setIsPasswordLoading(false);
    }
  }

  async function onMagicLinkSubmit(data: MagicLinkSignUpInput) {
    setIsMagicLinkLoading(true);
    try {
      const result = await requestMagicLinkSignUpAction(createFormData(data));

      if (result?.error) {
        const errorMessage = result.errorKey
          ? tErrors(result.errorKey)
          : result.error;
        toast.error(errorMessage);
        setIsMagicLinkLoading(false);
      } else if (result?.success) {
        const successMessage = result.resultKey
          ? tResults(result.resultKey)
          : t("magicLinkSuccess");
        toast.success(successMessage);
        setMagicLinkEmail(result.email ?? data.email);
        setIsMagicLinkLoading(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
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
              setActiveMethod("magic-link");
              magicLinkForm.reset(magicLinkDefaultValues);
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

      <div className="space-y-6">
        <Tabs
          tabs={[
            { name: t("methods.password"), key: "password" },
            { name: t("methods.magicLink"), key: "magic-link" },
          ]}
          activeTab={activeMethod}
          onTabChange={(tabName) => setActiveMethod(tabName as SignUpMethod)}
        />

        {activeMethod === "password" ? (
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="flex flex-col items-center gap-2 w-full"
            >
              <NameField form={passwordForm} label={t("name")} />
              <EmailField form={passwordForm} label={t("email")} />
              <PasswordField
                form={passwordForm}
                name="password"
                placeholder={t("password")}
              />
              <PasswordField
                form={passwordForm}
                name="confirmPassword"
                placeholder={t("confirmPassword")}
              />
              <TermsAcceptedField
                form={passwordForm}
                termsLabel={t("termsAccepted")}
                privacyPolicyLabel={t("privacyPolicy")}
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

              <NameField form={magicLinkForm} label={t("name")} />
              <EmailField form={magicLinkForm} label={t("email")} />
              <TermsAcceptedField
                form={magicLinkForm}
                termsLabel={t("termsAccepted")}
                privacyPolicyLabel={t("privacyPolicy")}
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
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/signin" className="underline hover:text-foreground">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
