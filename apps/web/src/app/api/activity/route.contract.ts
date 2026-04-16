import { ACTIVITY_STALE_CURSOR_CODE } from "@/lib/activity-cursor";
import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import { activityQueryInputSchema } from "@/lib/schemas/activity";
import {
  activitySuccessSchema,
  errBody,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const staleCursorErrorSchema = z.object({
  success: z.literal(false),
  code: z.literal(ACTIVITY_STALE_CURSOR_CODE),
  error: z.string(),
});

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Activity"],
  operations: {
    GET: {
      summary: "Activity feed",
      description:
        "Cross-agent activity with filters (tab/type). Use `summary=1` for counts-only payload.",
      security,
      request: {
        query: activityQueryInputSchema,
      },
      responses: {
        200: jsonResponse("Activity feed or summary", activitySuccessSchema),
        410: jsonResponse("Stale cursor", staleCursorErrorSchema),
        503: jsonResponse("Payment node unavailable", errBody),
        ...stdResponses,
      },
    },
  },
});

export default contract;
