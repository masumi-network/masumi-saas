import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Steps } from "@/components/ui/steps";

export default function VerificationLoading() {
  const steps = [
    {
      title: "Introduction & Consent",
      description: "Learn about the verification process",
    },
    {
      title: "Verification",
      description: "Complete your identity verification",
    },
    {
      title: "Completion",
      description: "Verification status",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>

        <div className="w-full space-y-8">
          <Steps currentStep={1} steps={steps} />

          <Card className="overflow-hidden pt-0">
            <CardHeader className="rounded-t-xl bg-masumi-gradient pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-32 mt-6" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
