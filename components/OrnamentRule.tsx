/**
 * The ornament band (/about): a braided border in the manner of Georgian stone carving, drawn
 * by the `ornament-rule` utility in app/globals.css. Purely decorative, hidden from screen
 * readers. Width comes from the parent.
 */
export function OrnamentRule({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`ornament-rule ${className}`.trim()} />;
}
