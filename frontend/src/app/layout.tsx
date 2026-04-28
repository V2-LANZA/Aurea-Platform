import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AureaBotNoticeProvider } from "@/components/aurea-bot-notice-provider";
import { RouteChangeEffects } from "@/components/route-change-effects";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aurea",
  description: "Safety-first chat prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AureaBotNoticeProvider>
          <RouteChangeEffects />
          <AppShell>{children}</AppShell>
          <Toaster richColors />
        </AureaBotNoticeProvider>
      </body>
    </html>
  );
}
