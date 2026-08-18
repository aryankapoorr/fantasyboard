import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const title = "FantasyBoard — Draft Board";
const description = "A fantasy football draft board with consensus rankings, live ADP, and your own custom ranks.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    title,
    description,
    url: SITE_URL,
    siteName: "FantasyBoard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <html
      lang="en"
      className={`${oswald.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-body antialiased">
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <AuthProvider>{children}</AuthProvider>
        <footer className="border-t border-hairline px-4 py-3 text-center">
          <Link href="/privacy" className="font-mono text-[11px] text-ink-faint hover:text-ink-muted">
            Privacy
          </Link>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
