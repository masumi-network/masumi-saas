import { isStripeTopUpEnabled } from "@/lib/stripe/config";

import { HeaderClient } from "./header-client";

type HeaderProps = {
  className?: string;
};

export default async function Header({ className }: HeaderProps) {
  return (
    <HeaderClient
      className={className}
      stripeTopUpEnabled={isStripeTopUpEnabled()}
    />
  );
}
