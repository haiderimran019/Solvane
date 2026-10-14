import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solvane — Continue anywhere",
  description:
    "Continuity Capsules for moving active work across Claude, Gemini, ChatGPT, Perplexity, Codex, and Claude Code.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
