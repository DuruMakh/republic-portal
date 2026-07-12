import type { Metadata } from "next";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
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
  title: "ქართული რესპუბლიკა",
  description: "სამოქალაქო პლატფორმა",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body className={`${notoSans.variable} ${notoSerif.variable}`}>{children}</body>
    </html>
  );
}
