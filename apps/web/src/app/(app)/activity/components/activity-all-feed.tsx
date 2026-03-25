"use client";

import { forwardRef } from "react";

import {
  type ActivityFeedTableHandle,
  ActivityFeedTableInner,
  type ActivityFeedTableProps,
} from "./activity-feed-table-inner";

export { LIFECYCLE_LABELS } from "./activity-feed-shared";
export type { ActivityTabFilter } from "@/lib/types/activity";

export type { ActivityFeedTableHandle, ActivityFeedTableProps };

export const ActivityFeedTable = forwardRef<
  ActivityFeedTableHandle,
  ActivityFeedTableProps
>((props, ref) => <ActivityFeedTableInner {...props} imperativeRef={ref} />);
ActivityFeedTable.displayName = "ActivityFeedTable";
