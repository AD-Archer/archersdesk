import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const serif = localFont({
  src: [
    { path: "./fonts/instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const sans = localFont({
  src: [{ path: "./fonts/schibsted-grotesk.woff2", weight: "400 900", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

// Material Symbols subset (see README to regenerate with more icon names)
const icons = localFont({
  src: [{ path: "./fonts/material-symbols.woff2", weight: "100 700", style: "normal" }],
  variable: "--font-icons",
  display: "block",
});

export const metadata: Metadata = {
  title: "archer's desk",
  description: "An ambient standby dashboard for small screens.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "desk" },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${icons.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
