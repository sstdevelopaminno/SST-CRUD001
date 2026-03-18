import * as React from "react";
import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { AuditProvider } from "@/components/shared/audit-provider";
import { PwaRegister } from "@/components/shared/pwa-register";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SST Backoffice",
  description: "Enterprise-grade SaaS backoffice for SST INNOVATION CO., LTD.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${plexMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider>
          <AuditProvider>
            {children}
            <Toaster richColors position="top-right" />
            <PwaRegister />
          </AuditProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

