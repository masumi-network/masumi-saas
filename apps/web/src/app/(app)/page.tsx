import { getAuthContext } from "@/lib/auth/utils";

export default async function HomePage() {
  const authContext = await getAuthContext();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-muted-foreground">
        You are signed in as {authContext.session?.user?.email}
      </p>
    </div>
  );
}
