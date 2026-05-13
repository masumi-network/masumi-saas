import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  apiKeyStatusKeySchema,
  apiKeyStatusSessionSchema,
  security,
  stdResponses,
} from "@/lib/swagger/saas-app-openapi";
import { z } from "@/lib/swagger/zod-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["API keys"],
  operations: {
    GET: {
      summary: "API key status",
      description:
        "Returns whether the caller is authenticated with a **browser session** or a **Masumi SaaS API key** (`x-api-key` / `Authorization: Bearer`). For API key auth, includes public metadata for that key (id, name, prefix, start fragment). Does **not** echo the secret key.",
      security,
      responses: {
        200: jsonResponse(
          "`authMethod` is `session` for cookie auth, or `apiKey` when the request was authenticated with an API key.",
          z.union([apiKeyStatusSessionSchema, apiKeyStatusKeySchema]),
        ),
        ...stdResponses,
      },
    },
  },
});

export default contract;
