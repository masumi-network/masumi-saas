export default function AcceptInvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-canvas p-4 text-foreground sm:p-6">
      <div className="surface-panel w-full max-w-md px-6 py-8 sm:max-w-lg sm:px-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
