"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";

export default function SimulationSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <Header variant="solid" />

      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] px-6">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-teal/10 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-teal"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-navy mb-2">Simulation Submitted</h1>
          <p className="text-sm text-[#666] mb-6">
            Thank you for completing the simulation. Your responses have been submitted for evaluation.
          </p>

          <p className="text-xs text-[#999] mb-8">
            You will receive your results and credential via email within 24 hours. Check your spam folder if you don't see it.
          </p>

          <button
            onClick={() => router.push("/simulations/product-management")}
            className="w-full bg-navy text-white font-medium py-3 px-6 rounded text-sm hover:bg-navy/90 transition-colors"
          >
            Return to Simulations
          </button>
        </div>
      </div>
    </div>
  );
}
