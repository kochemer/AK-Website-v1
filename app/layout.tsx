import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
        {/* Sticky Header */}
        <header
          className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-gray-200"
          style={{
            boxShadow: "0 1px 10px 0 rgba(0,0,0,0.03)",
            position: 'relative',
          }}
        >
          {/* Language Switcher - Absolute top right */}
          <div className="absolute top-0 right-0 z-40 px-3 sm:px-4 md:px-6 py-2 sm:py-2">
            <LanguageSwitcher />
          </div>
          {/* Luxury Intelligence - Absolute top left */}
          <div className="absolute top-0 left-0 z-40 px-3 sm:px-4 md:px-6 py-2 sm:py-2">
            <span
              className="font-bold text-base sm:text-lg md:text-xl tracking-tight"
              style={{ letterSpacing: "-0.01em" }}
            >
              Luxury Intelligence
            </span>
          </div>
          <nav className="max-w-3xl mx-auto flex items-center justify-center py-3 sm:py-3.5 md:py-4 pl-[calc(3rem+0.5rem)] sm:pl-[calc(4rem+1rem)] md:pl-[calc(6rem+1.5rem)] pr-[calc(3rem+0.5rem)] sm:pr-[calc(4rem+1rem)] md:pr-[calc(6rem+1.5rem)]">
            <ul className="flex items-center gap-2 sm:gap-3 md:gap-5 text-xs sm:text-sm md:text-base font-medium flex-wrap justify-center">
              {navLinks.map((link) => (
                <li key={link.href} className="whitespace-nowrap">
                  <Link
                    href={link.href}
                    className="hover:underline focus-visible:underline transition-colors px-1 sm:px-1.5 py-1 sm:py-0.5 rounded min-h-[44px] sm:min-h-0 flex items-center"
                    style={{ minHeight: '44px' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="whitespace-nowrap">
                <Link
                  href="/subscribe"
                  style={{
                    fontWeight: 600,
                    color: '#06244c',
                    background: '#fed236',
                    borderRadius: 6,
                    padding: '0.5rem 0.875rem',
                    textDecoration: 'none',
                    transition: 'background 0.2s',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    whiteSpace: 'nowrap',
                    minHeight: '44px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  className="sm:!text-[0.9rem] sm:!px-[1.2rem] sm:!py-[0.5rem] sm:!min-h-0"
                >
                  Subscribe
                </Link>
              </li>
            </ul>
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
