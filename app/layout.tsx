import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AmplitudeInit from "./components/AmplitudeInit";
import AnalyticsPageView from "./components/AnalyticsPageView";
import LanguageSwitcher from "./components/LanguageSwitcher";
import NavLinks, { FooterNavLinks } from "./components/NavLinks";
import InstallPwaButton from "./components/InstallPwaButton";
import EnableNotificationsButton from "./components/EnableNotificationsButton";
import DisplayModeAttribute from "./components/DisplayModeAttribute";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import JsonLd from "./components/JsonLd";
import CanonicalUrlValidator from "./components/CanonicalUrlValidator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
  themeColor: "#6b2d5c",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Luxury Intelligence",
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
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: `${siteUrl}/`,
  },
};

// navLinks kept for reference but NavLinks component now handles locale-aware labels
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/email-digest", label: "Email Digest" },
  { href: "/subscribe", label: "Subscribe" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
  { href: "/feedback", label: "Feedback" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
        style={{ fontFamily: "var(--font-geist-sans)", minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
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
        <CanonicalUrlValidator />
        <AmplitudeInit />
        <AnalyticsPageView />
        <DisplayModeAttribute />
        <ServiceWorkerRegistration />
        {/* Sticky Header - Mobile First */}
        <header
          className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-gray-200"
          style={{
            boxShadow: "0 1px 10px 0 rgba(0,0,0,0.03)",
          }}
        >
          {/* Top Row: Title + Language Switcher (Mobile) */}
          <div className="flex items-center justify-between px-4 py-2.5 md:hidden">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image
                src="/favicon.png"
                alt="Luxury Intelligence"
                width={24}
                height={24}
                className="flex-shrink-0"
              />
              <span
                className="font-bold text-sm tracking-tight"
                style={{ letterSpacing: "-0.01em" }}
              >
                Luxury Intelligence
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <InstallPwaButton />
              <EnableNotificationsButton />
              <LanguageSwitcher />
            </div>
          </div>

          {/* Top Row: Title + Language Switcher (Desktop) */}
          <div className="hidden md:flex items-center justify-between px-4 py-2">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Image
                src="/favicon.png"
                alt="Luxury Intelligence"
                width={50}
                height={50}
                className="flex-shrink-0"
              />
              <span
                className="font-bold text-base lg:text-lg tracking-tight"
                style={{ letterSpacing: "-0.01em" }}
              >
                Luxury Intelligence
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <InstallPwaButton />
              <EnableNotificationsButton />
              <LanguageSwitcher />
            </div>
          </div>

          {/* Navigation - Mobile First (locale-aware) */}
          <nav className="border-t border-gray-100 md:border-t-0">
            <div className="max-w-3xl mx-auto px-3 py-2 md:px-4 md:py-2">
              <ul className="flex items-center gap-1 md:gap-1.5 lg:gap-2 text-[11px] md:text-xs lg:text-sm font-medium flex-wrap justify-center md:justify-start">
                <NavLinks />
              </ul>
            </div>
          </nav>
        </header>

        {/* Main Layout Container */}
        <main className="flex-grow w-full">
          {children}
        </main>

        {/* Footer (locale-aware) */}
        <footer className="mt-4 sm:mt-6 border-t border-gray-200 py-5 sm:py-6 text-xs sm:text-xs text-gray-500 bg-white/80 w-full">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3 mb-3">
              <FooterNavLinks />
            </div>
            <div className="text-center px-3 leading-relaxed">
              <span className="font-medium">AI-assisted summaries</span> &mdash; Not investment or business advice. Website built and maintained by AK.
            </div>
          </div>
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}
