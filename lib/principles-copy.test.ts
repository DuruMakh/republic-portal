import { describe, expect, it } from "vitest";
import {
  GEORGIAN_NUMERALS,
  PRINCIPLES,
  principleAnchor,
  principleFromHash,
} from "./principles-copy";

describe("principles copy", () => {
  it("keeps the owner's twelve principles in order", () => {
    expect(PRINCIPLES).toHaveLength(12);
    expect(PRINCIPLES.map(({ title }) => title)).toEqual([
      "საქართველოს დამოუკიდებლობა და სუვერენიტეტი",
      "ერი სახელმწიფოს შექმნა",
      "თავისუფლება, სამართლიანობა და კანონის უზენაესობა",
      "ერთობა, მშვიდობა და უსაფრთხოება",
      "ქართული თვითმყოფადობის დაცვა და გაძლიერება",
      "ძლიერი თავდაცვა და ბრძოლისუნარიანობა",
      "აქტიური საგარეო პოლიტიკა",
      "მდიდარი საქართველო და ტექნოლოგიური განვითარება",
      "ხალხის ფულისა და ქვეყნის სიმდიდრის ხელშეუხებლობა",
      "ქართული ერის დემოგრაფიული გაძლიერება და რეგიონალური განვითარება",
      "ღირსეული ცხოვრება",
      "ოკუპაციის დასრულება",
    ]);
    expect(PRINCIPLES.map((p) => p.body.length)).toEqual([2, 3, 3, 2, 3, 2, 2, 2, 2, 4, 2, 1]);
  });

  it("keeps the owner's text whole: the lead is the first sentence of the first paragraph", () => {
    expect(PRINCIPLES[0]?.lead).toBe(
      "საქართველო არის და იქნება თავისუფალი, დამოუკიდებელი სახელმწიფო.",
    );
    expect(PRINCIPLES[0]?.body[0]).toBe(
      "ქართველი ერის ურყევი ნება, იცხოვროს საკუთარ, დამოუკიდებელ სახელმწიფოში, დადასტურებულია როგორც 1918 წლის 26 მაისისა და 1991 წლის 9 აპრილის დამოუკიდებლობის გამოცხადების აქტებით, ისე 1921 წლის თებერვალსა და 1989 წლის 9 აპრილს თავისუფლებისა და დამოუკიდებლობისთვის გაღებული მსხვერპლით. ეს ნება უზენაესია და არ ექვემდებარება გადახედვას.",
    );
    // The last principle keeps the rest of its opening paragraph after the lead.
    expect(PRINCIPLES[11]?.body[0]).toBe(
      "აფხაზეთი და ცხინვალის რეგიონი ქართული სახელმწიფოს განუყოფელი ნაწილი და ერის სამკვიდრებელია. ოკუპირებული ტერიტორიების გათავისუფლება და მშობლიურ მიწაზე დაბრუნება ქართველების საერთო ამოცანა და ერი-სახელმწიფოს არსებობის გარდაუვალი წინაპირობაა. თითოეული პოლიტიკური გადაწყვეტილება და სახელმწიფოებრივი ნაბიჯი უნდა ემსახურებოდეს ოკუპაციის დასრულებას.",
    );
  });

  it("has no stray whitespace or empty text", () => {
    for (const { title, lead, body, roots } of PRINCIPLES) {
      const rootTexts = roots.flatMap((root) => Object.values(root).filter((v) => v !== root.kind));
      for (const text of [title, lead, ...body, ...rootTexts]) {
        expect(text, text).toBe(text.trim());
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every principle a historical-roots note", () => {
    for (const { roots } of PRINCIPLES) expect(roots.length).toBeGreaterThan(0);
  });

  it("gives each principle an anchor and a Georgian numeral", () => {
    expect(principleAnchor(3)).toBe("principle-3");
    expect(GEORGIAN_NUMERALS).toHaveLength(PRINCIPLES.length);
  });

  it("reads a principle number back from a URL hash", () => {
    expect(principleFromHash("#principle-3")).toBe(3);
    expect(principleFromHash("#principle-12")).toBe(12);
    expect(principleFromHash("#principle-13")).toBeNull();
    expect(principleFromHash("#principle-0")).toBeNull();
    expect(principleFromHash("#contents")).toBeNull();
    expect(principleFromHash("")).toBeNull();
  });
});
