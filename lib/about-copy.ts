/**
 * Every Georgian string on /about and in the homepage section that links to it. The page text
 * is the owner's, sent in the project thread on 2026-10-13 (the closing words of the last
 * paragraph in a follow-up message the same day), and is kept word for word.
 */
export const ABOUT_HREF = "/about";
export const ABOUT_TITLE = "ჩვენ შესახებ";

export const ABOUT_INTRO = "ქართული რესპუბლიკა არის იმ ადამიანების ერთობა, ვისაც გვჯერა:";
export const ABOUT_BELIEFS = [
  "რომ საქართველო და ქართული სახელმწიფო ეკუთვნის ქართველ ერს და არა ვიწრო, კორუმპირებულ ელიტას, რომელიც ჩვენს ხარჯზე მდიდრდება და ქვეყნის სიმდიდრეს პირად ქონებად აქცევს.",
  "რომ საქართველოს უნდა მართავდნენ ადამიანები, რომლებიც მთელი ერის ინტერესებს ემსახურებიან და არა მხოლოდ რამდენიმე ოლიგარქისა თუ ჩინოვნიკისას.",
  "რომ ჩვენ შეგვიძლია შევქმნათ სახელმწიფო, სადაც არცერთი ადამიანი არ იგრძნობს თავს დაჩაგრულად, ყველას ექნება გამდიდრების თანაბარი შესაძლებლობა და თითოეულ ქართულ ოჯახს ექნება ღირსეული ცხოვრების პირობები.",
] as const;
/** Georgian letters double as numerals (ა 1, ბ 2, გ 3): the beliefs' markers. */
export const ABOUT_BELIEF_MARKERS = ["ა", "ბ", "გ"] as const;

export const ABOUT_UNITY =
  "ჩვენ ასევე გვჯერა, რომ ამ ყველაფრის მიღწევას ქართველები ვერ შევძლებთ თანადგომისა და ერთიანობის გარეშე, მაგრამ აუცილებლად შევძლებთ, თუ გავერთიანდებით.";
/** The goal sentence without its opening „ამიტომ,“ — the homepage section quotes it on its own. */
export const ABOUT_GOAL_CORE =
  "ჩვენი მიზანია ქართველი ერის გაერთიანება საერთო პრინციპების, ღირებულებებისა და მიზნების გარშემო, ამ ერთობის ჩამოყალიბება ხალხის მიერ შექმნილ, ძლიერ პოლიტიკურ ძალად და არჩევნებში გამარჯვება.";
export const ABOUT_GOAL = `ამიტომ, ${ABOUT_GOAL_CORE}`;
export const ABOUT_PORTAL =
  "სწორედ ასეთი პოლიტიკური ერთობის ჩამოყალიბებისა და გაძლიერების ხელშეწყობაა ამ პორტალის მიზანი. ეს არის სივრცე, სადაც ქართველ ხალხს შეუძლია გაერთიანება, ორგანიზება, საკუთარი ლიდერების არჩევა და გადაწყვეტილებების მიღების პროცესში უშუალოდ მიიღოს მონაწილეობა.";

/** The homepage section's link to the page. */
export const ABOUT_READ_MORE = "წაიკითხე სრულად →";
