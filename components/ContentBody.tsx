import { parseBody } from "@/lib/content-render";

/**
 * The one renderer for news/event bodies (public pages, cabinet, admin preview).
 * Server-component-safe (no hooks); builds elements, never injects HTML.
 */
export function ContentBody({ body, className = "" }: { body: string; className?: string }) {
  return (
    <div className={`space-y-4 text-ink ${className}`.trim()}>
      {parseBody(body).map((paragraph, pi) => (
        <p key={pi} className="text-[0.92rem] leading-[1.75]">
          {paragraph.map((span, si) =>
            span.type === "link" ? (
              // color/underline inherit the global link rule (app/globals.css `a{}`) —
              // break-all is layout-only, kept so long URLs wrap instead of overflowing.
              <a
                key={si}
                href={span.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all"
              >
                {span.href}
              </a>
            ) : (
              <span key={si}>{span.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
