import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Toolbar } from "@/components/Toolbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basement Lab",
  description: "Hub for LabTools apps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistMono.className} suppressHydrationWarning>
      <body className="font-mono antialiased min-h-screen flex flex-col">
        <Toolbar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
