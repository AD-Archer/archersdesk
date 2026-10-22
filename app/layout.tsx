import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import RegisterSW from "@/components/RegisterSW";
import ViewportFit from "@/components/ViewportFit";
import "./globals.css";
import "./styles/ui.css";
import "./styles/board.css";
import "./styles/widgets.css";
import "./styles/hackclub.css";
import "./styles/hero.css";
import "./styles/macapad.css";
import "./styles/settings.css";
import "./styles/remote.css";
import "./styles/overlays.css";

// Nunito — heavy rounded figures on screens without ui-rounded (the Echo);
// Apple devices use SF Pro Rounded through ui-rounded in --round
const round = localFont({
  src: [{ path: "./fonts/nunito.woff2", weight: "200 1000", style: "normal" }],
  variable: "--font-round",
  display: "swap",
});

// Material Symbols subset — add names in tools/make-icon-font.mjs, then `pnpm icon-font`
const icons = localFont({
  src: [{ path: "./fonts/material-symbols.woff2", weight: "400", style: "normal" }],
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
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${round.variable} ${icons.variable}`}>
      <body>
        {children}
        {/* night mode: brightness → red, used by html.night (globals.css) */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id="night-red" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.33 0.66 0.12 0 0  0.03 0.06 0.01 0 0  0.02 0.04 0.008 0 0  0 0 0 1 0"
            />
          </filter>
        </svg>
        <ViewportFit />
        <RegisterSW />
      </body>
    </html>
  );
}
