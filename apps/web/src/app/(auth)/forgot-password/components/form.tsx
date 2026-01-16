"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { requestPasswordReset } from "@/lib/auth/auth.client";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/schemas";

export default function ForgotPasswordForm() {
  const t = useTranslations("Auth.ForgotPassword");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setIsLoading(true);
    try {
      const result = await requestPasswordReset({
        email: data.email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        toast.error(t("error"));
        setIsLoading(false);
      } else {
        setIsSuccess(true);
        toast.success(t("successMessage"));
        setIsLoading(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-form space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">{t("checkEmail.title")}</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-md mx-auto">
            {t("checkEmail.description")}
          </p>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/signin">{t("checkEmail.backToLogin")}</Link>
          </Button>
        </div>
      </div>
    );
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
        {t("rememberPassword")}{" "}
        <Link href="/signin" className="underline hover:text-foreground">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
