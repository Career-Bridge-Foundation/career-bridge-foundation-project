import type { Metadata } from "next";
import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Evidentize";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  applicationName: APP_NAME,
  title: `${APP_NAME} | Practice into proof. Proof into portfolio.`,
  description: "Realistic workplace simulations, AI-evaluated, with a portfolio that proves what you can do.",
  openGraph: {
    title: `${APP_NAME} | Practice into proof. Proof into portfolio.`,
    description: "Realistic workplace simulations, AI-evaluated, with a portfolio that proves what you can do.",
    siteName: APP_NAME,
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} | Practice into proof. Proof into portfolio.`,
    description: "Realistic workplace simulations, AI-evaluated, with a portfolio that proves what you can do.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}