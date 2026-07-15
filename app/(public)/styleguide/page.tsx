import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Field } from "@/components/Field";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { Stepper } from "@/components/Stepper";
import {
  DelegateBindingPickerSample,
  DelegateBindingReferralSample,
  OtpInputSample,
  TierPickerSample,
} from "./samples";

export default function StyleguidePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-brand">დიზაინ-სისტემა</h1>
      <Card title="ღილაკები">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>ძირითადი</Button>
            <Button variant="ghost">მეორადი</Button>
            <Button variant="danger">საშიში</Button>
            <ButtonLink href="/leaderboard">ბმულის ღილაკი</ButtonLink>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-fg">ზომები</div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">პატარა</Button>
              <Button size="md">საშუალო</Button>
              <Button size="lg">დიდი</Button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-fg">მუქი ვარიანტები</div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="dark">რეიტინგი</Button>
              <div className="rounded-lg bg-navy p-4">
                <Button variant="ghost-inverse">მეორადი</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card title="სტატუსები">
        <div className="flex flex-wrap gap-2">
          <Pill status="draft" />
          <Pill status="profile_completed" />
          <Pill status="active_member" />
          <Pill status="pending" />
          <Pill status="approved" />
          <Pill status="rejected" />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="დამტკიცებული დელეგატი" value={112} accent="brand" />
        <StatCard label="აქტიური წევრი" value={1700} accent="brand" />
      </div>
      <Card title="ბეჯი">
        <div className="flex flex-wrap gap-2">
          <Badge>12 დელეგატი</Badge>
          <Badge>ახალი</Badge>
        </div>
      </Card>
      <Card
        padded={false}
        header={
          <>
            <h2 className="font-bold text-ink">ბარათი სათაურით</h2>
            <Badge>2 რიგი</Badge>
          </>
        }
      >
        <div className="divide-y divide-line">
          <div className="px-4 py-3 text-sm text-ink sm:px-5">პირველი მაგალითი რიგი</div>
          <div className="px-4 py-3 text-sm text-ink sm:px-5">მეორე მაგალითი რიგი</div>
        </div>
      </Card>
      <Card title="ეიბროუ">
        <Eyebrow>საჯარო პორტალი</Eyebrow>
      </Card>
      <Card title="ფორმის ველი">
        <Field label="ტელეფონის ნომერი" name="phone" placeholder="5XX XX XX XX" />
      </Card>
      <Card title="სტეპერი">
        <Stepper current={2} />
      </Card>
      <Card title="SMS კოდის ველი">
        <OtpInputSample />
      </Card>
      <Card title="საწევროს არჩევა">
        <TierPickerSample />
      </Card>
      <Card title="დელეგატის მიბმა — რეფერალით">
        <DelegateBindingReferralSample />
      </Card>
      <Card title="დელეგატის მიბმა — არჩევანი">
        <DelegateBindingPickerSample />
      </Card>
    </main>
  );
}
