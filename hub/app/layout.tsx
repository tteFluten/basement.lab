import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Toolbar } from "@/components/Toolbar";
import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/components/SessionProvider";
import { AppTabsProvider } from "@/lib/appTabsContext";
import { ContentWithTabs } from "@/components/ContentWithTabs";
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
          <AppTabsProvider>
            <Toolbar />
            <ContentWithTabs>{children}</ContentWithTabs>
            <Footer />
          </AppTabsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
