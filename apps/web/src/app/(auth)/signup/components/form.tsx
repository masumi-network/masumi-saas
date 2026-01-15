"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { type SignUpInput, signUpSchema } from "@/lib/schemas";

export default function SignUpForm() {
  const t = useTranslations("Auth.SignUp");
  const tErrors = useTranslations("Auth.Errors");
  const tResults = useTranslations("Auth.Results");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  const termsAccepted = useWatch({
    control: form.control,
    name: "termsAccepted",
  });

  async function onSubmit(data: SignUpInput) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("confirmPassword", data.confirmPassword);
      formData.append("termsAccepted", data.termsAccepted ? "true" : "false");

      const result = await signUpAction(formData);

      if (result?.error) {
        const errorMessage = result.errorKey
          ? tErrors(result.errorKey)
          : result.error;
        toast.error(errorMessage);
        setIsLoading(false);
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
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-form space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          {t("description")}
        </p>
      </div>

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
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="w-full flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    {t("termsAccepted")}{" "}
                    <Link
                      href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
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

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/signin" className="underline hover:text-foreground">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
