import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OfflineSyncProvider from "../components/common/OfflineSyncProvider";
import AuthGuard from "../components/common/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RailTrack PPJ - Portal KAI",
  description: "Aplikasi Pelaporan dan Pemeriksaan Jalur Kereta Api Indonesia",
  manifest: "/manifest.json",
  themeColor: "#005bac",
  viewport: "minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container`}>
        <AuthGuard>
          <OfflineSyncProvider>
            {children}
          </OfflineSyncProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
