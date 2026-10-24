import type { Metadata } from "next";
import { Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";

// Punjabi fallback: the brand fonts don't cover Gurmukhi.
const gurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-gurmukhi",
  weight: ["400", "600"],
  subsets: ["gurmukhi"],
});

export const metadata: Metadata = {
  title: "Sombra",
  description: "AI agents that keep Central Valley farm crews safe in heat and wildfire smoke.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${gurmukhi.variable} h-full antialiased`}>
      <head>
        <link rel="preload" href="/fonts/GeneralSans-Variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Zodiak-Variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
