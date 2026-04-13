import { getPublicAuthorizationServerMetadata } from "@/lib/config/oidc.config";

export async function GET() {
  return Response.json(getPublicAuthorizationServerMetadata(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
