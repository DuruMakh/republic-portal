import { Card } from "@/components/Card";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, type TeamRsvpEvent } from "@/lib/community";

export function TeamRsvpCard({ events }: { events: TeamRsvpEvent[] }) {
  return (
    <div data-testid="team-rsvp">
      <Card title="გუნდის RSVP">
        {events.length === 0 ? (
          <p className="text-sm text-muted-fg">მომავალი ღონისძიებები ჯერ არ არის.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((e) => (
              <div key={e.eventId} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold text-muted-fg">
                  {formatEventTimeKa(e.startsAt, null)}
                </p>
                <p className="mt-0.5 font-bold text-ink">{e.title}</p>
                <p className="mt-1 text-sm text-muted-fg">
                  შენი გუნდიდან მოდის {formatCountKa(e.goingCount)}
                </p>
                {e.going.length > 0 ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">
                      ვინ მოდის
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                      {e.going.map((n, i) => (
                        <li key={i}>
                          {n.firstName} {n.lastName}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
