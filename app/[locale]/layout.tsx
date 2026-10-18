import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import localFont from "next/font/local";
import { siteUrl } from "@/lib/site";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/routing";
import "../globals.css";

const notoSans = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-sans-georgian",
  // The condensed display headings on /structure (ADR-038) need the width axis.
  axes: ["wdth"],
});
const notoSerif = Noto_Serif_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-serif-georgian",
});

// Display headlines (GL Gordeziani) and old-Georgian numerals (BPG Nateli AsoMtavruli), from the
// owner's „ერთობა“ design (ADR-053), loaded at the root so every redesigned area can use them.
const gordeziani = localFont({
  src: "../fonts/gl-gordeziani-bold.woff2",
  weight: "700",
  variable: "--font-gl-gordeziani",
  display: "swap",
});
const asomtavruli = localFont({
  src: "../fonts/bpg-nateli-asomtavruli.woff2",
  weight: "300",
  variable: "--font-bpg-asomtavruli",
  display: "swap",
});

const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "ქართული რესპუბლიკა",
  description: "სამოქალაქო პორტალი",
  openGraph: {
    siteName: "ქართული რესპუბლიკა",
    images: ["/og-default.png?v=civic-portal"],
  },
};

export function generateStaticParams() {
  return [{ locale: "ka" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "en") return baseMetadata;
  return {
    ...baseMetadata,
    title: "Georgian Republic",
    description: "Civic portal",
    openGraph: { ...baseMetadata.openGraph, siteName: "Georgian Republic", locale: "en_GB" },
  };
}

/**
 * `viewportFit: "cover"` is load-bearing, not cosmetic: without it every
 * env(safe-area-inset-*) in the app evaluates to 0, so the mobile bars would
 * look correct on Android and clip under the home indicator on iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body
        className={`${notoSans.variable} ${notoSerif.variable} ${gordeziani.variable} ${asomtavruli.variable}`}
      >
        <NextIntlClientProvider locale={locale} messages={{}} timeZone="Asia/Tbilisi">
          {children}
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
