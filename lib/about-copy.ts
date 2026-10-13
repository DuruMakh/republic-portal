/**
 * Every Georgian string on /about and in the homepage section that links to it. The page text
 * is the owner's, supplied in chat on 2026-10-13 and kept verbatim. The owner's message broke
 * off at „...მიღების პროცესში უშ“, so the last words of ABOUT_PURPOSE („უშუალოდ მონაწილეობა.“)
 * are a completion the owner was asked to confirm.
 */
export const ABOUT_HREF = "/about";
export const ABOUT_TITLE = "ჩვენ შესახებ";
export const ABOUT_INTRO = "ქართული რესპუბლიკა არის იმ ადამიანების ერთობა, ვისაც გვჯერა:";
export const ABOUT_BELIEFS = [
  "რომ საქართველო და ქართული სახელმწიფო ეკუთვნის ქართველ ერს და არა ვიწრო, კორუმპირებულ ელიტას, რომელიც ჩვენს ხარჯზე მდიდრდება და ქვეყნის სიმდიდრეს პირად ქონებად აქცევს.",
  "რომ საქართველოს უნდა მართავდნენ ადამიანები, რომლებიც მთელი ერის ინტერესებს ემსახურებიან და არა მხოლოდ რამდენიმე ოლიგარქისა თუ ჩინოვნიკისას.",
  "რომ ჩვენ შეგვიძლია შევქმნათ სახელმწიფო, სადაც არცერთი ადამიანი არ იგრძნობს თავს დაჩაგრულად, ყველას ექნება გამდიდრების თანაბარი შესაძლებლობა და თითოეულ ქართულ ოჯახს ექნება ღირსეული ცხოვრების პირობები.",
] as const;
// Georgian letters as list numerals, the traditional way of counting with the alphabet.
export const BELIEF_LETTERS = ["ა", "ბ", "გ"] as const;
export const ABOUT_UNITY =
  "ჩვენ ასევე გვჯერა, რომ ამ ყველაფრის მიღწევას ქართველები ვერ შევძლებთ თანადგომისა და ერთიანობის გარეშე, მაგრამ აუცილებლად შევძლებთ, თუ გავერთიანდებით.";
export const ABOUT_GOAL =
  "ამიტომ, ჩვენი მიზანია ქართველი ერის გაერთიანება საერთო პრინციპების, ღირებულებებისა და მიზნების გარშემო, ამ ერთობის ჩამოყალიბება ხალხის მიერ შექმნილ, ძლიერ პოლიტიკურ ძალად და არჩევნებში გამარჯვება.";
export const ABOUT_PURPOSE =
  "სწორედ ასეთი პოლიტიკური ერთობის ჩამოყალიბებისა და გაძლიერების ხელშეწყობაა ამ პორტალის მიზანი. ეს არის სივრცე, სადაც ქართველ ხალხს შეუძლია გაერთიანება, ორგანიზება, საკუთარი ლიდერების არჩევა და გადაწყვეტილებების მიღების პროცესში უშუალოდ მონაწილეობა.";

/** The homepage section below the hero: the page's opening, then a link to the rest. */
export const HOME_ABOUT_EXCERPT = `${ABOUT_INTRO} ${ABOUT_BELIEFS[0]}`;
export const HOME_ABOUT_LINK = "წაიკითხე სრულად";
