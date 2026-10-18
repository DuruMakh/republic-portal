import { formatEventTime } from "@/lib/i18n/format";

import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetHead, CabinetPage } from "@/components/CabinetPage";
import { percentages, pollView } from "@/lib/community";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { PollCard, type PollCardOption } from "./PollCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("შიდა გამოკითხვები — ქართული რესპუბლიკა") };
}

export default async function MemberPollsPage() {
  const locale = await getLocale();
  const t = await getCopy();
  const state = await getCabinetState(); // layout guarantees exists only
  if (!state.exists) redirect(localePath("/join", locale)); // soft-nav defense: narrow before reading profile fields
  if (!state.completed) redirect(localePath("/me", locale)); // members only (spec §4.2); the views self-gate too
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
    <CabinetPage deco="map">
      <CabinetHead
        title={t("შიდა გამოკითხვები")}
        lede={t("მიიღე მონაწილეობა მოძრაობის შიდა გადაწყვეტილებებში.")}
      />

      <div className="mt-8 flex max-w-[900px] flex-col gap-6 md:mt-12 md:gap-7">
        {polls.length === 0 ? (
          <p className="m-0 font-serif text-[18px] text-secondary">
            {t("გამოკითხვები მალე გამოჩნდება.")}
          </p>
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
                    ? `${t("ბოლო ვადა: ")}${formatEventTime(poll.ends_at, null, locale)}`
                    : null
                }
                options={options}
                total={counts.reduce((s, v) => s + v, 0)}
              />
            );
          })
        )}
      </div>
    </CabinetPage>
  );
}
