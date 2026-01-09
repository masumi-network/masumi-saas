"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas";
import { requestPasswordReset } from "@/lib/auth/auth.client";

export default function ForgotPasswordForm() {
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
        toast.error("Failed to send password reset email");
        setIsLoading(false);
      } else {
        setIsSuccess(true);
        toast.success(
          "If an account exists with this email, you will receive a password reset link.",
        );
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
      <div className="w-full max-w-[500px] space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Check your email</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-md mx-auto">
            We&apos;ve sent a password reset link to your email address. Please
            check your inbox and follow the instructions to reset your password.
          </p>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/signin">Back to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[500px] space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
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
                <FormLabel className="sr-only">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
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
                  Sending...
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/signin" className="underline hover:text-foreground">
          Login
        </Link>
      </p>
    </div>
  );
}
