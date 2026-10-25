"use client";
import { useCallback, useState } from "react";
import { Card } from "@/components/Card";
import { AdminSectionTitle } from "@/components/AdminUi";
import { PollActions } from "./PollActions";
import { PollForm, type EditablePoll } from "./PollForm";
export function PollDraftEditor({ poll }: { poll: EditablePoll }) {
  const [openBlocked, setOpenBlocked] = useState(false);
  const onEditStateChange = useCallback((dirty: boolean, saving: boolean) => {
    setOpenBlocked(dirty || saving);
  }, []);
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card>
        <PollForm poll={poll} onEditStateChange={onEditStateChange} />
      </Card>
      <Card>
        <AdminSectionTitle className="mb-5">მოქმედებები</AdminSectionTitle>
        <PollActions id={poll.id} status="draft" openBlocked={openBlocked} />
      </Card>
    </div>
  );
}
