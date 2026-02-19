import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { generateOpenAPISpec } from "@/lib/swagger/generator";

export async function GET(request: NextRequest) {
  const spec = generateOpenAPISpec();
  return addCorsHeaders(NextResponse.json(spec), request);
}
