import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyTracker | Whale Watching for Polymarket",
  description: "Track whale wallet activity on Polymarket prediction markets. Monitor positions, trades, and P&L in real-time.",
  keywords: ["polymarket", "whale tracking", "prediction markets", "crypto", "polygon"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
