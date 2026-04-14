import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Bridge Portfolio Simulations",
  description: "Prove your capability through realistic scenario-based assessments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}