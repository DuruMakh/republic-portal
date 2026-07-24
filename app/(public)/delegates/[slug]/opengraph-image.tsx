import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { formatCountKa } from "@/lib/format";
import { fetchDelegateBySlug } from "@/lib/supabase/public";

export const revalidate = 60;
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [delegate, sansFont, serifFont, roundel] = await Promise.all([
    fetchDelegateBySlug(slug),
    readFile(path.join(process.cwd(), "assets/fonts/NotoSansGeorgian-Bold.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/NotoSerifGeorgian-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/brand/emblem-roundel-red-notext.png")),
  ]);
  if (!delegate) notFound();

  const roundelSrc = `data:image/png;base64,${roundel.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#F7F2E9",
        color: "#1A1611",
        fontFamily: "NotoGeo",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- satori/next-og
            rendering into a generated PNG, not a browser DOM <img>; next/image
            is not supported inside ImageResponse. */}
        <img src={roundelSrc} alt="" width={88} height={88} />
        <div style={{ fontSize: 34, color: "#6E6659" }}>ქართული რესპუბლიკა</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 30, color: "#6E6659" }}>{delegate.region_name_ka ?? ""}</div>
        {/* Single interpolated-string child, not two adjacent expressions: satori
            (next/og's renderer) requires an explicit display: flex/contents/none on
            any div with more than one child node, and two expressions separated by a
            JSX whitespace text node count as three children. */}
        <div style={{ fontSize: 76, lineHeight: 1.1, fontFamily: "NotoSerifGeo", fontWeight: 700 }}>
          {`${delegate.first_name} ${delegate.last_name}`}
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#9F1D35" }}>
          აქტიური მხარდამჭერი: {formatCountKa(delegate.active_supporters)}
        </div>
      </div>
      <div style={{ display: "flex", height: 10, width: 260 }}>
        <div style={{ flex: 3, background: "#9F1D35" }} />
        <div style={{ flex: 2, background: "#1A1611" }} />
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "NotoGeo", data: sansFont, weight: 700, style: "normal" },
        { name: "NotoSerifGeo", data: serifFont, weight: 700, style: "normal" },
      ],
    },
  );
}
