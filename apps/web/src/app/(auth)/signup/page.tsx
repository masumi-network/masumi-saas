import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Sign Up</h1>
        <p className="text-muted-foreground">
          Create an account to get started.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Authentication UI coming soon. Check the API routes for now.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}

