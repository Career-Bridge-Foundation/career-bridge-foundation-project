import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * @swagger
 * /api/disciplines:
 *   get:
 *     summary: List disciplines
 *     description: Returns all disciplines from the disciplines table.
 *     tags:
 *       - Simulations
 *     responses:
 *       200:
 *         description: Discipline list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisciplineListResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("disciplines")
      .select("id, name, description, status, count, slug")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch disciplines:", error);
      return NextResponse.json({ error: "Failed to load disciplines" }, { status: 500 });
    }
    
    return NextResponse.json({ disciplines: data || [] });
  } catch (error) {
    console.error("Disciplines route error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
