import {
  defineRouteContract,
  jsonRequestBody,
  jsonResponse,
} from "@/lib/openapi/contracts";
import { errBody, noSecurity } from "@/lib/swagger/saas-app-openapi";
import {
  registerByEmailApiBodySchema,
  registerByEmailApiSuccessSchema,
} from "@/lib/schemas/auth-api";

const contract = defineRouteContract({
  documents: ["platform"],
  tags: ["Auth"],
  operations: {
    POST: {
      summary: "Register with email",
      description:
        "Creates a new account if needed, then sends a magic sign-in link to the provided email address. The client must confirm terms acceptance before calling this route.",
      security: noSecurity,
      request: {
        body: jsonRequestBody(registerByEmailApiBodySchema, {
          required: true,
        }),
      },
      responses: {
        202: jsonResponse(
          "Magic link accepted for delivery",
          registerByEmailApiSuccessSchema,
        ),
        400: jsonResponse("Invalid request body", errBody),
        429: jsonResponse(
          "Too many registration requests from this client",
          errBody,
        ),
        500: jsonResponse(
          "Registration email could not be queued or sent",
          errBody,
        ),
      },
    },
  },
});

export default contract;
