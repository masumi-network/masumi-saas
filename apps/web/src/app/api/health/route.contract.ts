import { defineRouteContract, jsonResponse } from "@/lib/openapi/contracts";
import {
  errBody,
  healthServiceUnavailableSchema,
  healthSuccessSchema,
  noSecurity,
} from "@/lib/swagger/saas-app-openapi";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["System"],
  operations: {
    GET: {
      summary: "Health check",
      description:
        "Confirms this app and the Masumi payment service behind it are up. **503** means the payment service is unreachable or not reporting healthy.",
      security: noSecurity,
      responses: {
        200: jsonResponse(
          "App and payment service are healthy",
          healthSuccessSchema,
        ),
        429: jsonResponse(
          "Too many health checks from this client in the window",
          errBody,
        ),
        503: jsonResponse(
          "Payment service unreachable or unhealthy from this environment",
          healthServiceUnavailableSchema,
        ),
      },
    },
  },
});

export default contract;
