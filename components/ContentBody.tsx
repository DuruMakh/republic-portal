import { parseBody } from "@/lib/content-render";

/**
 * The one renderer for news/event bodies (public pages, cabinet, admin preview).
 * Server-component-safe (no hooks); builds elements, never injects HTML.
 */
export function ContentBody({ body, className = "" }: { body: string; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed text-ink ${className}`.trim()}>
      {parseBody(body).map((paragraph, pi) => (
        <p key={pi}>
          {paragraph.map((span, si) =>
            span.type === "link" ? (
              <a
                key={si}
                href={span.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-brand underline underline-offset-2"
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
