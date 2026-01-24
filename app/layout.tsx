import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AmplitudeInit from "./components/AmplitudeInit";
import LanguageSwitcher from "./components/LanguageSwitcher";
import JsonLd from "./components/JsonLd";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://luxury-intelligence.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Luxury Intelligence",
  description: "Luxury Ecommerce, Retail Technology & AI - Curated intelligence and AI-assisted summaries for luxury, ecommerce, and retail tech.",
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
    canonical: "/",
  },
};

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
        <AmplitudeInit />
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
            <LanguageSwitcher />
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
            <LanguageSwitcher />
          </div>

          {/* Navigation - Mobile First */}
          <nav className="border-t border-gray-100 md:border-t-0">
            <div className="max-w-3xl mx-auto px-3 py-2 md:px-4 md:py-2">
              <ul className="flex items-center gap-1 md:gap-1.5 lg:gap-2 text-[11px] md:text-xs lg:text-sm font-medium flex-wrap justify-center md:justify-start">
                {navLinks.map((link) => (
                  <li key={link.href} className="whitespace-nowrap">
                    <Link
                      href={link.href}
                      className="hover:underline focus-visible:underline transition-colors px-2 py-2 md:px-1.5 md:py-0.5 rounded flex items-center min-h-[44px] md:min-h-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="whitespace-nowrap">
                  <Link
                    href="/subscribe"
                    className="inline-flex items-center justify-center font-semibold text-[#06244c] bg-[#fed236] rounded-md px-2.5 py-2 md:px-3 md:py-1 text-[11px] md:text-xs transition-colors hover:bg-[#fdd01a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06244c] focus-visible:ring-offset-1 min-h-[44px] md:min-h-0 shadow-sm"
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    }}
                  >
                    Subscribe
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </header>

        {/* Main Layout Container */}
        <main className="flex-grow w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-4 sm:mt-6 border-t border-gray-200 py-5 sm:py-6 text-xs sm:text-xs text-gray-500 bg-white/80 w-full">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3 mb-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:underline whitespace-nowrap py-1 min-h-[44px] sm:min-h-0 flex items-center"
                  style={{ minHeight: '44px' }}
                >
                  {link.label}
                </Link>
              ))}
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
