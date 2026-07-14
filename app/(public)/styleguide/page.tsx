import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { Stepper } from "@/components/Stepper";

export default function StyleguidePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-brand">დიზაინ-სისტემა</h1>
      <Card title="ღილაკები">
        <div className="flex gap-3">
          <Button>ძირითადი</Button>
          <Button variant="ghost">მეორადი</Button>
          <Button variant="danger">საშიში</Button>
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
      <Card title="ფორმის ველი">
        <Field label="ტელეფონის ნომერი" name="phone" placeholder="5XX XX XX XX" />
      </Card>
      <Card title="სტეპერი">
        <Stepper current={2} />
      </Card>
    </main>
  );
}
