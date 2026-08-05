import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import { siteUrl } from "@/lib/site";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const notoSans = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-sans-georgian",
});
const notoSerif = Noto_Serif_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-serif-georgian",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "ქართული რესპუბლიკა",
  description: "სამოქალაქო პლატფორმა",
  openGraph: {
    siteName: "ქართული რესპუბლიკა",
    images: ["/og-default.png"],
  },
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body className={`${notoSans.variable} ${notoSerif.variable}`}>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
