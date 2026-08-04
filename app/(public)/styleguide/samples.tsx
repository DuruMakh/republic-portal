"use client";

import { DelegateBinding } from "@/components/DelegateBinding";
import { OtpInput } from "@/components/OtpInput";

// Styleguide gallery samples. The page itself is a Server Component, and
// these components take onChange callbacks that can't cross the RSC
// boundary as props — so each sample is a tiny client component with its
// own no-op handler, mirroring how CountUp is a self-contained client leaf
// rendered directly from a server page.

const delegateOptions = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "გიორგი მაისურაძე",
    regionNameKa: "თბილისი",
  },
];

/**
 * Mobile-only components carry `md:hidden`, a viewport media query — a narrow
 * wrapper div cannot reveal them. An iframe has its own viewport, so the
 * sample renders exactly as it does on a real phone.
 */
export function PhoneFrame({ src, height }: { src: string; height: number }) {
  return (
    <iframe
      src={src}
      title={src}
      width={390}
      height={height}
      className="max-w-full border border-frame"
    />
  );
}

export function OtpInputSample() {
  return <OtpInput value="123" onChange={() => undefined} />;
}

export function DelegateBindingReferralSample() {
  return (
    <DelegateBinding
      referral={{ fullName: "გიორგი მაისურაძე", regionNameKa: "თბილისი" }}
      options={[]}
      value={null}
      onChange={() => undefined}
    />
  );
}

export function DelegateBindingPickerSample() {
  return (
    <DelegateBinding
      referral={null}
      options={delegateOptions}
      value={null}
      onChange={() => undefined}
    />
  );
}
