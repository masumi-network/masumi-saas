import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Sign In</h1>
        <p className="text-muted-foreground">
          Enter your credentials to access your account.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Authentication UI coming soon. Check the API routes for now.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}

