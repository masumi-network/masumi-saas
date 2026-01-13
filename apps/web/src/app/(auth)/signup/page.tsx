import type { Metadata } from "next";

import SignUpForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Register",
  description: "Register for a Masumi account",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
