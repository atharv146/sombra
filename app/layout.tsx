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
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=zodiak@400&f[]=array@400&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
