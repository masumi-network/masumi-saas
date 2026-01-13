import type { Metadata } from "next";

import ForgotPasswordForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Reset Password",
  description: "Reset your password to regain access to your account",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
