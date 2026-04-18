"use client";

import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const NAVY = "#003359";

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header variant="solid" />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="flex flex-col items-center text-center max-w-lg gap-8">
          <Image
            src="/logo-colour.png"
            alt="Career Bridge"
            width={160}
            height={48}
            priority
          />

          <div className="flex flex-col items-center gap-4">
            <h1
              className="text-3xl font-bold leading-tight"
              style={{ color: NAVY }}
            >
              Payment Successful
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              Thank you for your purchase. You now have access to your simulation.
            </p>
          </div>

          <Link
            href="/simulate"
            className="inline-flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAVY }}
          >
            Start My Simulation →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
