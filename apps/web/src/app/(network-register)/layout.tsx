import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import gridSvg from "@/assets/grid.svg";

export default async function NetworkRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="relative min-h-svh bg-background text-foreground">
        <div
          className="absolute inset-0 animate-grid-glide opacity-40"
          style={{
            backgroundImage: `url(${typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg})`,
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, black 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, black 70%)",
          }}
        />
        <main className="relative z-10 mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
