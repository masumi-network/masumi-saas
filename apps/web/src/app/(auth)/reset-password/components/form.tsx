"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
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
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas";
import { resetPassword } from "@/lib/auth/auth.client";

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("Auth.ResetPassword");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      token: token,
    },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setIsLoading(true);
    try {
      const result = await resetPassword({
        newPassword: data.password,
        token: data.token,
      });

      if (result.error) {
        toast.error(t("error"));
        setIsLoading(false);
      } else {
        toast.success(t("success"));
        router.push("/signin");
      }
    } catch (error) {
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
            name="password"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="sr-only">New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t("password")}
                    autoComplete="new-password"
                    className="bg-transparent"
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
                <FormLabel className="sr-only">Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t("confirmPassword")}
                    autoComplete="new-password"
                    className="bg-transparent"
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
