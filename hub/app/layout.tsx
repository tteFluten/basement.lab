import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Toolbar } from "@/components/Toolbar";
import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basement Lab",
  description: "Hub for LabTools apps",
  icons: {
    icon: { url: "/favicon.gif", type: "image/gif" },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistMono.className} suppressHydrationWarning>
      <body className="font-mono antialiased min-h-screen flex flex-col">
        <SessionProvider>
          <Toolbar />
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
