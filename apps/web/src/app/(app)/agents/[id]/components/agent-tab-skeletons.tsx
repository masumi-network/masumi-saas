import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function DetailsTabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex flex-col gap-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="mt-2 h-4 w-full max-w-sm" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between gap-2 rounded-lg border bg-muted/40 p-2 py-2">
              <Skeleton className="h-4 w-14" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32 sm:w-48" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-12" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-px flex-1" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-px flex-1" />
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 min-w-[120px] w-full sm:w-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EarningsTabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="overflow-hidden gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardHeader>
        <CardContent className="px-6 py-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTabSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-row flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-48 sm:max-w-80" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CredentialsTabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg lg:min-w-96">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="mt-2 h-4 w-full max-w-sm" />
          <Skeleton className="mt-1 h-4 w-full max-w-md" />
        </CardHeader>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

const TAB_SKELETONS = {
  details: DetailsTabSkeleton,
  earnings: EarningsTabSkeleton,
  transactions: TransactionsTabSkeleton,
  credentials: CredentialsTabSkeleton,
} as const;

export type TabKey = keyof typeof TAB_SKELETONS;

export function TabSkeleton({ tab }: { tab: TabKey }) {
  const SkeletonComponent = TAB_SKELETONS[tab];
  return <SkeletonComponent />;
}
