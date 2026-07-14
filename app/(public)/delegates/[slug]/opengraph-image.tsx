import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { formatCountKa } from "@/lib/format";
import { fetchDelegateBySlug } from "@/lib/supabase/public";

export const revalidate = 60;
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [delegate, font] = await Promise.all([
    fetchDelegateBySlug(slug),
    readFile(path.join(process.cwd(), "assets/fonts/NotoSansGeorgian-Bold.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(150deg, #C8102E 0%, #A30D26 100%)",
        color: "#ffffff",
        fontFamily: "NotoGeo",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 24,
            background: "#ffffff",
            color: "#C8102E",
            fontSize: 40,
          }}
        >
          ქრ
        </div>
        <div style={{ fontSize: 34, opacity: 0.9 }}>ქართული რესპუბლიკა</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 30, opacity: 0.75 }}>
          {delegate ? (delegate.region_name_ka ?? "") : "საჯარო პორტალი"}
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.1 }}>
          {delegate ? `${delegate.first_name} ${delegate.last_name}` : "დელეგატები"}
        </div>
        {delegate ? (
          <div style={{ display: "flex", fontSize: 36, color: "#F4D67A" }}>
            აქტიური მხარდამჭერი: {formatCountKa(delegate.active_supporters)}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", height: 10, width: 260 }}>
        <div style={{ flex: 3, background: "#ffffff" }} />
        <div style={{ flex: 2, background: "rgba(255,255,255,0.35)" }} />
      </div>
    </div>,
    { ...size, fonts: [{ name: "NotoGeo", data: font, weight: 700, style: "normal" }] },
  );
}
