import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Airsteam FF",
  description: "Freight forwarding SaaS — direct shipment workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
