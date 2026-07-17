import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlockVerse - 3D Web Game Platform",
  description: "A Roblox-style 3D game platform with multiple game modes: Obby Runner, Battle Arena, Speed Run, Explorer, and Builder. Play for free in your browser!",
  keywords: ["BlockVerse", "3D game", "web game", "Roblox", "browser game", "obstacle course", "battle arena"],
  authors: [{ name: "BlockVerse" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>",
  },
  openGraph: {
    title: "BlockVerse - 3D Web Game Platform",
    description: "Play amazing 3D games in your browser! Multiple game modes, leaderboards, and more.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white overflow-hidden`}
        style={{ margin: 0, padding: 0, width: '100vw', height: '100vh' }}
      >
        {children}
      </body>
    </html>
  );
}