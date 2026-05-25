import { FooterSections } from "@/components/footer";
import { Header } from "@/components/header";

/**
 * Full-page OpenAPI explorers: shared header + footer (no app sidebar).
 */
export default function DocsWithSiteChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-app-canvas text-foreground">
      <Header />
      <main className="flex w-full min-w-0 flex-1 flex-col pt-14 sm:pt-16">
        {children}
        <div className="max-w-container mx-auto w-full border-t border-border">
          <FooterSections className="p-4" />
        </div>
      </main>
    </div>
  );
}
