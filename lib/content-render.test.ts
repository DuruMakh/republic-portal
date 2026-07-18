import { describe, expect, it } from "vitest";
import { excerpt, parseBody } from "./content-render";

describe("parseBody (spec §5, decision #12)", () => {
  it("splits paragraphs on blank lines, collapsing inner newlines to spaces", () => {
    expect(parseBody("პირველი აბზაცი.\n\nმეორე\nაბზაცი.")).toEqual([
      [{ type: "text", text: "პირველი აბზაცი." }],
      [{ type: "text", text: "მეორე აბზაცი." }],
    ]);
  });

  it("tolerates \\r\\n and 3+ blank lines, drops empty blocks", () => {
    expect(parseBody("ა\r\n\r\n\r\n\r\nბ\n\n   \n\nგ")).toEqual([
      [{ type: "text", text: "ა" }],
      [{ type: "text", text: "ბ" }],
      [{ type: "text", text: "გ" }],
    ]);
  });

  it("returns [] for whitespace-only bodies", () => {
    expect(parseBody("  \n\n \n ")).toEqual([]);
  });

  it("tokenizes http/https URLs as link spans", () => {
    expect(parseBody("იხილე https://example.ge/გვერდი და დაგვიკავშირდი.")).toEqual([
      [
        { type: "text", text: "იხილე " },
        { type: "link", href: "https://example.ge/გვერდი" },
        { type: "text", text: " და დაგვიკავშირდი." },
      ],
    ]);
  });

  it("trims trailing punctuation (incl. Georgian quotes) off links, keeping it as text", () => {
    expect(parseBody("წაიკითხე: https://a.ge/x, შემდეგ https://b.ge/y.")).toEqual([
      [
        { type: "text", text: "წაიკითხე: " },
        { type: "link", href: "https://a.ge/x" },
        { type: "text", text: ", შემდეგ " },
        { type: "link", href: "https://b.ge/y" },
        { type: "text", text: "." },
      ],
    ]);
    expect(parseBody("(დეტალები: https://c.ge/z)")).toEqual([
      [
        { type: "text", text: "(დეტალები: " },
        { type: "link", href: "https://c.ge/z" },
        { type: "text", text: ")" },
      ],
    ]);
    expect(parseBody(`„https://d.ge/w"`)).toEqual([
      [
        { type: "text", text: "„" },
        { type: "link", href: "https://d.ge/w" },
        { type: "text", text: `"` },
      ],
    ]);
  });

  it("handles a paragraph that is exactly one URL", () => {
    expect(parseBody("https://example.ge")).toEqual([
      [{ type: "link", href: "https://example.ge" }],
    ]);
  });

  it("does not link bare domains or other schemes", () => {
    expect(parseBody("example.ge და ftp://x.y")).toEqual([
      [{ type: "text", text: "example.ge და ftp://x.y" }],
    ]);
  });
});

describe("excerpt (spec §3.1: list cards + OG description)", () => {
  it("returns a short first paragraph unchanged", () => {
    expect(excerpt("მოკლე ტექსტი.\n\nმეორე აბზაცი.")).toBe("მოკლე ტექსტი.");
  });

  it("cuts at a word boundary and appends … when over max", () => {
    const body = "სიტყვა ".repeat(40).trim(); // 279 chars
    const cut = excerpt(body, 160);
    expect(cut.length).toBeLessThanOrEqual(161); // 160 + ellipsis
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/სიტყვ…$/); // no mid-word cut
  });

  it("renders link spans as their URL text", () => {
    expect(excerpt("ნახე https://a.ge აქ.")).toBe("ნახე https://a.ge აქ.");
  });

  it("returns empty string for empty body", () => {
    expect(excerpt("")).toBe("");
  });
});
