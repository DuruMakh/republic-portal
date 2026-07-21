import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatEventTimeKa, percentages, pollView } from "@/lib/community";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { PollCard, type PollCardOption } from "./PollCard";

export const metadata: Metadata = { title: "შიდა გამოკითხვები — ქართული რესპუბლიკა" };

export default async function MemberPollsPage() {
  const state = await getCabinetState(); // layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  if (!state.completed) redirect("/me"); // members only (spec §4.2); the views self-gate too
  const supabase = await createServerSupabase();
  const [pollsRes, optionsRes, countsRes, mineRes] = await Promise.all([
    supabase.from("member_polls").select("*"),
    supabase.from("member_poll_options").select("*").order("position"),
    supabase.from("poll_option_counts").select("*"),
    supabase.from("poll_votes").select("poll_id, option_id"),
  ]);
  if (pollsRes.error) throw new Error(`member_polls failed: ${pollsRes.error.message}`);
  if (optionsRes.error) throw new Error(`member_poll_options failed: ${optionsRes.error.message}`);
  if (countsRes.error) throw new Error(`poll_option_counts failed: ${countsRes.error.message}`);
  if (mineRes.error) throw new Error(`own votes failed: ${mineRes.error.message}`);

  const votesByOption = new Map(
    (countsRes.data ?? []).map((c) => [`${c.poll_id}:${c.option_id}`, c.votes]),
  );
  const myVoteByPoll = new Map((mineRes.data ?? []).map((v) => [v.poll_id, v.option_id]));

  const polls = [...(pollsRes.data ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    const aAt = a.opened_at ?? "";
    const bAt = b.opened_at ?? "";
    return bAt.localeCompare(aAt);
  });

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">შიდა გამოკითხვები</h1>
      <p className="mt-1 text-sm text-muted-fg">
        მიიღე მონაწილეობა მოძრაობის შიდა გადაწყვეტილებებში.
      </p>

      <div className="mt-6 flex max-w-3xl flex-col gap-5">
        {polls.length === 0 ? (
          <p className="text-muted-fg">გამოკითხვები მალე გამოჩნდება.</p>
        ) : (
          polls.map((poll) => {
            const pollOptions = (optionsRes.data ?? []).filter((o) => o.poll_id === poll.id);
            const counts = pollOptions.map(
              (o) => votesByOption.get(`${poll.id}:${o.option_id}`) ?? 0,
            );
            const pcts = percentages(counts);
            const myOption = myVoteByPoll.get(poll.id);
            const options: PollCardOption[] = pollOptions.map((o, i) => ({
              optionId: o.option_id,
              label: o.label,
              pct: pcts[i] ?? 0,
              votes: counts[i] ?? 0,
              mine: o.option_id === myOption,
            }));
            return (
              <PollCard
                key={poll.id}
                pollId={poll.id}
                question={poll.question}
                view={pollView(poll.status, myOption !== undefined)}
                deadlineKa={
                  poll.status === "open" && poll.ends_at
                    ? `ბოლო ვადა: ${formatEventTimeKa(poll.ends_at, null)}`
                    : null
                }
                options={options}
                total={counts.reduce((s, v) => s + v, 0)}
              />
            );
          })
        )}
      </div>
    </main>
  );
}
