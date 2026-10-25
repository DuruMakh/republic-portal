import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { AdminPageHeader, AdminSectionTitle } from "@/components/AdminUi";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, isoToTbilisiLocal, leadingOptions, percentages } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { PollActions } from "../PollActions";
import { PollDraftEditor } from "../PollDraftEditor";

export const metadata: Metadata = { title: "გამოკითხვა — ქართული რესპუბლიკა" };

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const [pollRes, optionsRes] = await Promise.all([
    supabase.from("admin_polls").select("*").eq("id", id).maybeSingle(),
    supabase.from("admin_poll_options").select("*").eq("poll_id", id).order("position"),
  ]);
  if (pollRes.error) throw new Error(`admin_polls by id failed: ${pollRes.error.message}`);
  if (optionsRes.error)
    throw new Error(`admin_poll_options by id failed: ${optionsRes.error.message}`);
  if (!pollRes.data) notFound();
  const poll = pollRes.data;
  const options = optionsRes.data ?? [];
  const counts = options.map((o) => o.votes);
  const pcts = percentages(counts);
  const leading = leadingOptions(counts);

  return (
    <div>
      <AdminPageHeader
        title="გამოკითხვა"
        meta={
          <>
            <Pill {...contentPill(poll.status)} />
            <span className="text-sm font-semibold text-muted-fg">
              სულ {formatCountKa(poll.total_votes)} ხმა
            </span>
            {poll.ends_at ? (
              <span className="text-sm font-semibold text-muted-fg">
                ბოლო ვადა: {formatEventTimeKa(poll.ends_at, null)}
              </span>
            ) : null}
          </>
        }
      />

      {poll.status === "draft" ? (
        <PollDraftEditor
          poll={{
            id: poll.id,
            question: poll.question,
            options: options.map((o) => o.label),
            endsAtLocal: poll.ends_at ? isoToTbilisiLocal(poll.ends_at) : "",
          }}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Card>
            <div>
              <h2 className="text-lg font-bold text-ink">{poll.question}</h2>
              <div className="mt-4 flex flex-col gap-3.5">
                {options.map((o, i) => (
                  <div key={o.option_id}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{o.label}</span>
                      <span className="font-semibold text-muted-fg">
                        {formatCountKa(o.votes)} · {pcts[i] ?? 0}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-surface">
                      <div
                        className={`h-2.5 ${leading[i] ? "bg-brand" : "bg-teal"}`}
                        style={{ width: `${pcts[i] ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <AdminSectionTitle className="mb-5">მოქმედებები</AdminSectionTitle>
            <PollActions id={poll.id} status={poll.status} />
          </Card>
        </div>
      )}
    </div>
  );
}
