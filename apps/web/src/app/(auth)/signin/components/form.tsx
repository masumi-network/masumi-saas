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
import { signInSchema, type SignInInput } from "@/lib/schemas";
import { signInAction } from "@/lib/actions/auth.action";

export default function SignInForm() {
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

      const result = await signInAction(formData);

      if (result?.error) {
        toast.error(result.error);
        setIsLoading(false);
      } else if (result?.success) {
        toast.success("Logged in successfully!");
        window.location.href = "/";
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
    <div className="w-full max-w-[500px] space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Login</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          Your credentials are needed to access the dashboard. This is required
          to manage your AI agents, payment settings and view transactions.
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="sr-only">Password</FormLabel>
                <FormControl>
                  <div className="flex gap-4 items-center w-full">
                    <Input
                      type="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      className="flex-1 bg-transparent"
                      {...field}
                    />
                    <Button type="submit" disabled={isLoading} size="lg">
                      {isLoading ? (
                        <>
                          <Spinner size={16} className="mr-2" />
                          Validating...
                        </>
                      ) : (
                        "Login"
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

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between w-full">
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline hover:text-foreground">
            Register
          </Link>
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
