import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const admin = createAdminClient();
  // hook stores phone without '+'; retry briefly because the hook runs async of the request
  const stripped = phone.replace(/^\+/, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", [phone, stripped])
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return NextResponse.json({ otp: data[0]!.otp });
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ error: "no otp" }, { status: 404 });
}
