import { NextResponse } from "next/server";
import { getSimulationById, listSimulations } from "@/lib/data/simulations.server";

/**
 * @swagger
 * /api/simulations:
 *   get:
 *     summary: Get simulations
 *     description: Returns a list of all available simulations, newest first. If the optional id query parameter is provided, returns a single simulation.
 *     tags:
 *       - Simulations
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional simulation id. When provided, the endpoint returns one simulation instead of the full list.
 *     responses:
 *       200:
 *         description: Simulation list or single simulation
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SimulationListResponse'
 *                 - $ref: '#/components/schemas/SimulationResponse'
 *       404:
 *         description: Simulation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const simulation = await getSimulationById(id);

      if (!simulation) {
        return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
      }

      return NextResponse.json({ simulation });
    }

    const simulations = await listSimulations();
    return NextResponse.json({ simulations });
  } catch (error) {
    console.error("Error fetching simulations:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}