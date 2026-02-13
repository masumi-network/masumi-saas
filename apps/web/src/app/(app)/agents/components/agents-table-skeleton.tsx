import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AgentsTableSkeleton() {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-10" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
              <Skeleton className="h-4 w-14 ml-auto" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="max-w-52">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 max-w-44">
                  <Skeleton className="h-4 w-24 font-mono shrink-0" />
                  <Skeleton className="h-7 w-7 shrink-0 rounded" />
                </div>
              </TableCell>
              <TableCell className="max-w-32">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 max-w-52">
                  <Skeleton className="h-4 w-36 font-mono shrink-0" />
                  <Skeleton className="h-7 w-7 shrink-0 rounded" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
                <Skeleton className="h-8 w-8 ml-auto rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
