import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, DM_Sans, Courier_Prime } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AmplitudeInit from "./components/AmplitudeInit";
import AnalyticsPageView from "./components/AnalyticsPageView";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DisplayModeAttribute from "./components/DisplayModeAttribute";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import JsonLd from "./components/JsonLd";
import CanonicalUrlValidator from "./components/CanonicalUrlValidator";
import { ThemeProvider } from "./context/ThemeContext";
import ScrollProgressBar from "./components/ScrollProgressBar";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-libre-baskerville",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-courier-prime",
});

import { getSiteUrl } from '@/lib/utils/siteUrl';

// Get site URL once at module load
const siteUrl = getSiteUrl();

// Runtime assertion in production: ensure canonical URLs are absolute and use correct domain
if (process.env.NODE_ENV === 'production') {
  const canonical = `${siteUrl}/`;
  if (!canonical.startsWith(siteUrl)) {
    console.error(`[Metadata Error] Canonical URL does not start with siteUrl: ${canonical} (siteUrl: ${siteUrl})`);
  }
  if (!canonical.startsWith('https://')) {
    console.error(`[Metadata Error] Canonical URL is not absolute HTTPS: ${canonical}`);
  }
  if (canonical.includes('vercel.app')) {
    console.error(`[Metadata Error] Canonical URL contains vercel.app domain: ${canonical}`);
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#8B6914",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | Luxury Intelligence',
    default: 'Weekly AI, Ecommerce & Luxury Industry Digest | Luxury Intelligence',
  },
  description: "Luxury Ecommerce, Retail Technology & AI - Curated intelligence and AI-assisted summaries for luxury, ecommerce, and retail tech.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon.png",
  },
  verification: {
    google: "KaJ5edrq0bOoztSLgfyfhULos3k6tH3ztcyNIPolOlg",
  },
  openGraph: {
    siteName: "Luxury Intelligence",
    type: "website",
    images: [{ url: "/api/og?week=2026-W10", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: `${siteUrl}/`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script: apply saved theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${libreBaskerville.variable} ${dmSans.variable} ${geistMono.variable} ${courierPrime.variable} font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text-primary)]`}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <ThemeProvider>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Luxury Intelligence",
              url: siteUrl,
              description: "Luxury Ecommerce, Retail Technology & AI - Curated intelligence and AI-assisted summaries for luxury, ecommerce, and retail tech.",
              inLanguage: "en",
              publisher: {
                "@type": "Organization",
                name: "Luxury Intelligence",
              },
            }}
          />
          <ScrollProgressBar />
          <CanonicalUrlValidator />
          <AmplitudeInit />
          <AnalyticsPageView />
          <DisplayModeAttribute />
          <ServiceWorkerRegistration />
          <Header />

          {/* Main Layout Container */}
          <main className="flex-grow w-full">
            {children}
          </main>

          {/* Footer (locale-aware, dark 3-column) */}
          <Footer />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
