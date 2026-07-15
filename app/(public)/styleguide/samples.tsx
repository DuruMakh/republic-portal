"use client";

import { DelegateBinding } from "@/components/DelegateBinding";
import { OtpInput } from "@/components/OtpInput";
import { TierPicker } from "@/components/TierPicker";

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

export function OtpInputSample() {
  return <OtpInput value="123" onChange={() => undefined} />;
}

export function TierPickerSample() {
  return <TierPicker value={10} onChange={() => undefined} />;
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
