/**
 * Archive pages of the first republic shown in the „ერთობა“ document fans (homepage and About).
 * Source: საქართველოს ეროვნული არქივი. Each page names itself: the zoom button's label follows
 * `name` and the open view uses it as alt text.
 */
export type ArchiveDocument = {
  src: string;
  width: number;
  height: number;
  name: string;
  caption: string;
};

/** A fan of three pages: left, right, and the one lying on top. */
export type DocumentFan = readonly [ArchiveDocument, ArchiveDocument, ArchiveDocument];

export const DOCUMENTS_ZOOM = "გადიდება";
export const DOCUMENTS_CLOSE = "დახურვა";

export const CONSTITUTION_COVER: ArchiveDocument = {
  src: "/unity/doc-constitution-cover.jpg",
  width: 891,
  height: 1275,
  name: "1921 წლის კონსტიტუციის გარეკანი",
  caption: "საქართველოს კონსტიტუცია, 1921 — გარეკანი. საქართველოს ეროვნული არქივი",
};

export const CONSTITUTION_FIRST_CHAPTER: ArchiveDocument = {
  src: "/unity/doc-constitution-page.jpg",
  width: 904,
  height: 1280,
  name: "1921 წლის კონსტიტუციის პირველი თავი",
  caption: "1921 წლის კონსტიტუცია — თავი პირველი: ზოგადი დებულებანი. საქართველოს ეროვნული არქივი",
};

export const CONSTITUTION_SIGNATURES: ArchiveDocument = {
  src: "/unity/doc-handwritten.jpg",
  width: 897,
  height: 1271,
  name: "1921 წლის კონსტიტუციის ხელმოწერები",
  caption: "1921 წლის კონსტიტუციის ხელმოწერების გვერდი. საქართველოს ეროვნული არქივი",
};

export const INDEPENDENCE_ACT: ArchiveDocument = {
  src: "/unity/doc-independence-act.jpg",
  width: 920,
  height: 1280,
  name: "საქართველოს დამოუკიდებლობის აქტი, ხელმოწერებით",
  caption:
    "საქართველოს დამოუკიდებლობის აქტი — დამფუძნებელი კრების მიერ 1919 წლის 12 მარტს დადასტურებული ეგზემპლარი, ხელმოწერებით. საქართველოს ეროვნული არქივი",
};
