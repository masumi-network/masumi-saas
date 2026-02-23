"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { adminSignInAction } from "@/lib/actions/admin-auth.action";
import { type SignInInput, signInSchema } from "@/lib/schemas";

export default function AdminSignInForm() {
  const t = useTranslations("Admin.Auth.SignIn");
  const tErrors = useTranslations("Admin.Errors");
  const tResults = useTranslations("Admin.Results");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignInInput) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);

      const result = await adminSignInAction(formData);

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
        // Keep loading state during navigation
        router.refresh();
        router.push("/admin");
      } else {
        // Unexpected result format
        setIsLoading(false);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        // Next.js redirect - don't reset loading
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
        <h1 className="text-4xl font-light tracking-tight mb-4">
          {t("title")}
        </h1>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="sr-only">{t("password")}</FormLabel>
                <FormControl>
                  <div className="flex gap-4 items-center w-full">
                    <Input
                      type="password"
                      placeholder={t("password")}
                      autoComplete="current-password"
                      className="flex-1 bg-background"
                      {...field}
                    />
                    <Button
                      type="submit"
                      variant="primary"
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
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
