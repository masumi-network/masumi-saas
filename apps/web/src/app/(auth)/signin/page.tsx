import type { Metadata } from "next";

import SignInForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Login",
  description: "Login to access the Masumi dashboard",
};

export default function SignInPage() {
  return <SignInForm />;
}
