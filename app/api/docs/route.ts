import { NextResponse } from "next/server";
import { getApiDocs } from "@/lib/swagger";

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get the OpenAPI specification
 *     description: Returns the generated Swagger/OpenAPI specification used by the API docs page.
 *     tags:
 *       - Docs
 *     responses:
 *       200:
 *         description: OpenAPI specification
 */
export async function GET() {
  const spec = await getApiDocs();
  return NextResponse.json(spec);
}