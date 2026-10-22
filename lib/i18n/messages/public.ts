import * as home from "@/lib/home-copy";
import * as about from "@/lib/about-copy";
import * as archive from "@/lib/archive-documents";
import * as principles from "@/lib/principles-copy";
import * as structure from "@/lib/structure-copy";
import * as support from "@/lib/support-copy";

/** English for fixed public copy. Published stories, profiles and documents are never input. */
export const publicMessages: Record<string, string> = {
  საქართველო: "Georgia",
  [principles.PRINCIPLES_TITLE]: "Agreement",
  [principles.PRINCIPLES_PAGE_TITLE]: "Let us agree",
  [principles.PRINCIPLES_LEDE]:
    "Because the nation is divided today, and because division plays into the enemy’s hands, we are obliged to agree and to unite around the goals and values that most of us Georgians share.",
  [principles.PRINCIPLES_LEDE_CLOSE]: "So let us agree",
  [principles.PRINCIPLES_CONTENTS]: "Contents",
  [principles.PRINCIPLES_SEAL_LABEL]: "Agreement seal",
  [principles.PRINCIPLES_LIST_LABEL]: "Agreement principles",
  [principles.PRINCIPLE_ROOTS_LABEL]: "Our heritage",
  [principles.PRINCIPLES_HOME_LINK]: "The full agreement →",
  [principles.PRINCIPLES[0]!.title]: "Georgia’s independence and sovereignty",
  [principles.PRINCIPLES[0]!.lead]: "Georgia is, and will remain, a free and independent state.",
  [principles.PRINCIPLES[0]!.body[0]!]:
    "The Georgian nation’s unwavering will to live in its own independent state is affirmed by the declarations of independence of 26 May 1918 and 9 April 1991, and by the sacrifices made for freedom and independence in February 1921 and on 9 April 1989. That will is supreme and is not open to reconsideration.",
  [principles.PRINCIPLES[0]!.body[1]!]:
    "The Georgian nation will never accept any attempt to infringe upon Georgian statehood or Georgian land, in any form.",
  [principles.PRINCIPLES[1]!.title]: "Building a nation-state",
  [principles.PRINCIPLES[1]!.lead]:
    "Georgia’s independence is an essential prerequisite for building a Georgian nation-state.",
  [principles.PRINCIPLES[1]!.body[0]!]:
    "A nation-state rests on three main foundations: a nation, a state that belongs to that nation, and the territory on which that state exists.",
  [principles.PRINCIPLES[1]!.body[1]!]:
    "In a nation-state, the nation is the sole source of power and exercises its sovereign will through its elected representatives.",
  [principles.PRINCIPLES[1]!.body[2]!]:
    "No group or individual may seize power. One-person, oligarchic and authoritarian rule means governing the country in the interests of a few, rather than the Georgian people. Government is an accountable servant entrusted by the Georgian nation for a limited term, not its master.",
  [principles.PRINCIPLES[2]!.title]: "Freedom, justice and the rule of law",
  [principles.PRINCIPLES[2]!.lead]:
    "For the Georgian nation, freedom means self-mastery: fulfilling God’s will within oneself.",
  [principles.PRINCIPLES[2]!.body[0]!]:
    "Freedom is a gift from God that nobody has the right to restrict, so long as a person does not violate another person’s life, health or freedom.",
  [principles.PRINCIPLES[2]!.body[1]!]:
    "To protect this supreme freedom and the dignity of every citizen, everyone must be equal before the law. The law must serve truth and justice, rather than preserve the power of those who govern. We therefore reject violence and intimidation by the state against individuals.",
  [principles.PRINCIPLES[2]!.body[2]!]:
    "The judiciary and law enforcement bodies must be fully independent and free from political influence, while freedom of thought, criticism and expression must remain inviolable. A different political position or worldview must never again become grounds for persecution.",
  [principles.PRINCIPLES[3]!.title]: "Unity, peace and security",
  [principles.PRINCIPLES[3]!.lead]:
    "Unity among Georgians is the foremost condition for our nation’s survival, freedom and strength.",
  [principles.PRINCIPLES[3]!.body[0]!]:
    "Our history has repeatedly shown that internal conflict destroys the nation physically and undermines the country’s independence. It is therefore our duty never again to allow civil conflict or the incitement of hatred between Georgians.",
  [principles.PRINCIPLES[3]!.body[1]!]:
    "Peace and security must be protected against both internal and external threats. Criminal domination and conditions in which people cannot feel safe in their own homes or on their streets are unacceptable.",
  [principles.PRINCIPLES[4]!.title]: "Protecting and strengthening Georgian identity",
  [principles.PRINCIPLES[4]!.lead]:
    "Every Georgian has a duty to protect and preserve our identity and pass it on to future generations.",
  [principles.PRINCIPLES[4]!.body[0]!]:
    "The Georgian language, Christian values, shared historical memory and centuries-old traditions are the foundations of the Georgian nation’s existence and the basis on which a strong and free Georgian state must be built.",
  [principles.PRINCIPLES[4]!.body[1]!]:
    "This heritage should become a driving force for our development, strengthening society’s unity, deepening our confidence in our own abilities and inspiring us to pursue new achievements and successes.",
  [principles.PRINCIPLES[4]!.body[2]!]:
    "Everyone who shares these values and considers themselves part of this historical and cultural community is an integral part of the Georgian nation. Belonging to this community is defined by sharing this heritage and being ready to defend it, rather than by ethnic origin or religious affiliation.",
  [principles.PRINCIPLES[5]!.title]: "Strong defence and readiness to fight",
  [principles.PRINCIPLES[5]!.lead]:
    "The principal guarantee and prerequisite of a nation-state’s freedom is a strong, disciplined and technologically advanced Georgian armed force, together with a nation ready to defend itself.",
  [principles.PRINCIPLES[5]!.body[0]!]:
    "The necessary readiness requires every citizen’s involvement in strengthening our defence capabilities. A citizen must be able to defend themselves, their family and their homeland.",
  [principles.PRINCIPLES[5]!.body[1]!]:
    "Historical experience teaches us that preserving freedom and independence depends on the nation’s ability and readiness to defend itself. Georgia’s geographical position and persistent threats make stronger defence capabilities one of the highest priorities of state policy. This requires an effective military reserve, proper training for citizens and organised cooperation between the armed forces and society. Together, these provide a firm foundation for the country’s peace, independence and freedom.",
  [principles.PRINCIPLES[6]!.title]: "An active foreign policy",
  [principles.PRINCIPLES[6]!.lead]:
    "Georgia’s foreign policy has one unchanging guiding principle: the national interests of the Georgian people.",
  [principles.PRINCIPLES[6]!.body[0]!]:
    "Georgia must pursue an active foreign policy and build close partnerships with every state with which it shares interests, goals or values.",
  [principles.PRINCIPLES[6]!.body[1]!]:
    "Georgia’s historical task is to develop close cooperation across the Caucasus, enabling the region to preserve its identity, develop and meet shared challenges.",
  [principles.PRINCIPLES[7]!.title]: "A prosperous Georgia and technological development",
  [principles.PRINCIPLES[7]!.lead]:
    "Georgia must have a strong, free and modern economy that brings prosperity to the country and a dignified life to Georgian families.",
  [principles.PRINCIPLES[7]!.body[0]!]:
    "Economic freedom, protection of private property, entrepreneurship and free competition are fundamental to the country’s development.",
  [principles.PRINCIPLES[7]!.body[1]!]:
    "Education and technological development are key foundations of Georgia’s economic advancement and security. Science, innovation, artificial intelligence and modern manufacturing must become driving forces of our economy, strengthen the country’s independence and create new opportunities for the Georgian people to prosper.",
  [principles.PRINCIPLES[8]!.title]: "Protecting public money and national wealth",
  [principles.PRINCIPLES[8]!.lead]:
    "The state budget consists of funds raised through the people’s work and effort, while the country’s natural resources and public property are our shared wealth.",
  [principles.PRINCIPLES[8]!.body[0]!]:
    "Corruption in any form, wasting or embezzling public money, or using the country’s wealth for personal enrichment is a crime against the Georgian nation and its future.",
  [principles.PRINCIPLES[8]!.body[1]!]:
    "Public money and national wealth must serve only the national interest, the country’s development and the well-being of the Georgian people.",
  [principles.PRINCIPLES[9]!.title]: "Demographic strength and regional development",
  [principles.PRINCIPLES[9]!.lead]:
    "Growth of the Georgian nation is essential to Georgia’s future.",
  [principles.PRINCIPLES[9]!.body[0]!]:
    "To this end, the state must support the return of compatriots living abroad, strengthen Georgian families and help healthy generations grow and develop in dignified and safe surroundings.",
  [principles.PRINCIPLES[9]!.body[1]!]:
    "The state must strictly control migration flows of foreign nationals to protect the country’s demographic security effectively and preserve its national identity.",
  [principles.PRINCIPLES[9]!.body[2]!]:
    "At the same time, regional towns and centres must develop so that the country’s cultural diversity is preserved, the economy grows stronger and regions are not emptied of their population.",
  [principles.PRINCIPLES[9]!.body[3]!]:
    "For people to have real means of exercising power, local questions must be decided directly in the regions and municipalities, rather than in the capital.",
  [principles.PRINCIPLES[10]!.title]: "A life of dignity",
  [principles.PRINCIPLES[10]!.lead]:
    "We have an unconditional duty to ensure that no child, older person or person unable to work in the Georgian state is left alone in the face of poverty and helplessness.",
  [principles.PRINCIPLES[10]!.body[0]!]:
    "The strength of a society is measured by the care it gives its vulnerable members as well as by its wealth.",
  [principles.PRINCIPLES[10]!.body[1]!]:
    "Every person must have access to healthcare, a dignified life and the opportunity to fulfil their potential.",
  [principles.PRINCIPLES[11]!.title]: "Ending the occupation",
  [principles.PRINCIPLES[11]!.lead]:
    "The enemy has violated the integrity of one of the foundations of the Georgian nation-state.",
  [principles.PRINCIPLES[11]!.body[0]!]:
    "Abkhazia and the Tskhinvali region are integral parts of the Georgian state and the nation’s homeland. Liberating the occupied territories and returning to our native land is a shared task for Georgians and an essential condition for the existence of the nation-state. Every political decision and every action of the state must serve the goal of ending the occupation.",
  "„დღეს დიდი თუ პატარა, მოხუცი თუ ახალგაზრდა, ნებისმიერი თაობის ადამიანი, ნებისმიერი თანამდებობის, ნებისმიერი მიმართულების, ფიქრობს მხოლოდ ერთზე - საქართველომ უნდა მოიპოვოს დამოუკიდებლობა! საქართველო ღირსია სრული თავისუფლების!“":
    "“Today, young and old, people of every generation, every position and every outlook, think of only one thing: Georgia must gain independence! Georgia deserves complete freedom!”",
  "მერაბ კოსტავა": "Merab Kostava",
  "გამოსვლა, 1989": "Speech, 1989",
  "31\u00a0მარტი 1991": "31 March 1991",
  "რეფერენდუმზე დამოუკიდებლობის აღდგენას მხარი დაუჭირა ხმათა 99,49%-მა.":
    "Restoration of independence received 99.49% of the vote in the referendum.",
  "„ხელმწიფება ეკუთვნის მთელს ერს, პარლამენტი ამ კონსტიტუციის ფარგლებში ახორციელებს ერის ხელმწიფებას.“":
    "“Sovereignty belongs to the entire nation; Parliament exercises the nation’s sovereignty within the limits of this Constitution.”",
  "საქართველოს კონსტიტუცია": "Constitution of Georgia",
  "1921, მუხლი\u00a052": "1921, Article 52",
  "„ინიციატივის უფლება ეკუთვნის: ა)\u00a0პარლამენტის ყოველ წევრს, და ბ)\u00a05\u00a0000 ამომრჩეველს.“":
    "“The right to introduce legislation belongs to: a) every member of Parliament, and b) 5,000 voters.”",
  "იქვე, მუხლი\u00a063": "Ibid., Article 63",
  "„თუ ოცდაათი ათასმა ამომრჩეველმა წერილობით მოითხოვა, პარლამენტი ვალდებულია ახლად მიღებული კანონი სარეფერენდუმოთ ხალხს წარუდგინოს.“":
    "“If thirty thousand voters request it in writing, Parliament must submit a newly adopted law to the people in a referendum.”",
  "იქვე, მუხლი\u00a064": "Ibid., Article 64",
  "„კანონი რჯულია ცხოვრებისა და ამიტომაც იგი სამართლისაგან ამოწვდილი ხმალიც არის ურჩთათვის და ფარიც არის საგერად და სახსნელად ჩაგრულთათვის. თუ ხმლობაში კანონს უსამართლოდ ჰხმარობს ვინმე, მაშინ ფარობამ კანონისამ თავი უნდა იჩინოს საგერად. კანონი მაშინ არის კაცთათვის მადლის მიმნიჭებელი, როცა ამ ორნაირს უწმინდაეს მნიშვნელობას მისას ჰპატრონობს თვითონ საზოგადოება, თვითვეული წევრი, თვითვეული კაცი.“":
    "“Law is the rule of life, and so it is both a sword raised by justice against those who defy it and a shield to defend and deliver the oppressed. If someone uses the law unjustly as a sword, its shield must rise in defence. Law benefits humanity when society itself, every member and every person, safeguards these two most sacred purposes.”",
  "ილია ჭავჭავაძე": "Ilia Chavchavadze",
  "„რა არის თავისუფლება“, „ივერია“, 1887": "“What Is Freedom”, Iveria, 1887",
  "„სადაც არაა პიროვნება თავისუფალი, იქ ერი დამონებულია და დამონებულ ერში, რა თქმა უნდა, პიროვნებაც მონაა, უთავისუფლო, სხვის ხელში სათამაშო ნივთი.“":
    "“Where the individual is not free, the nation is enslaved; and in an enslaved nation the individual is, of course, also a slave, without freedom, a plaything in someone else’s hands.”",
  "ვაჟა-ფშაველა": "Vazha-Pshavela",
  "„რა არის თავისუფლება?“, 1906": "“What Is Freedom?”, 1906",
  "„ერი, ერთის ღვაწლის დამდები, ერთს ისტორიულს უღელში ბმული, ერთად მებრძოლი, ერთსა და იმავე ჭირსა და ლხინში გამოტარებული\u00a0— ერთსულობით, ერთგულობით, ძლიერია.“":
    "“A nation that has made a common effort, borne a shared historical burden, fought together and passed through the same hardships and joys is strong through unity and loyalty.”",
  "„ოსმალოს საქართველო“, 1877": "“Ottoman Georgia”, 1877",
  "„ყოველი ერი თვისის ისტორიით სულდგმულობს. იგია საგანძე, საცა ერი პოულობს თვისის სულის ღონეს, თვისის სულის ბგერას, თვის ზნეობითს და გონებითს აღმატებულებას, თვის ვინაობას, თვის თვისებას.“":
    "“Every nation draws life from its history. It is the treasury in which a nation finds the strength and voice of its spirit, its moral and intellectual greatness, its identity and its character.”",
  "14\u00a0აპრილი 1978": "14 April 1978",
  "ათასობით ადამიანი, უმეტესად სტუდენტები, თბილისის ქუჩებში გამოვიდა და ქართულ ენას სახელმწიფო ენის სტატუსი შეუნარჩუნა. 1990 წლიდან ეს დღე დედაენის დღეა.":
    "Thousands of people, mostly students, took to the streets of Tbilisi and preserved Georgian’s status as the state language. Since 1990, the date has been celebrated as Mother Language Day.",
  "ასომთავრული, ნუსხური, მხედრული": "Asomtavruli, Nuskhuri and Mkhedruli scripts",
  "2016 წლიდან ქართული ანბანის სამი სახის ცოცხალი კულტურა იუნესკოს არამატერიალური მემკვიდრეობის ნუსხაშია.":
    "Since 2016, the living culture of the three writing systems of the Georgian alphabet has been on UNESCO’s intangible heritage list.",
  "„ზნენი აქუნდათ პირმტკიცობა, მტერთა ზედა ერთობა, თავისუფლებისათჳს მჴნედ ბრძოლა, მაგრად დგომა მისთჳს, ციხე-სიმაგრეთა და ქალაქთა შენება, მაგრება ქუეყანისა…“":
    "“Their ways were to keep their word, unite against enemies, fight bravely for freedom and stand firm for it, build fortresses and towns, and strengthen the country…”",
  "ვახუშტი ბატონიშვილი": "Prince Vakhushti",
  "„აღწერა სამეფოსა საქართველოსა“, 1745": "“Description of the Kingdom of Georgia”, 1745",
  "ერეკლე II-ის „მორიგის ლაშქრობის განაჩენით“ ყოველი ჯანმრთელი მამაკაცი, წოდების განურჩევლად, წელიწადში ერთ თვეს ჯარში მსახურობდა. ასე შეიქმნა 5000-კაციანი მუდმივი მორიგე ჯარი.":
    "Under Erekle II’s decree establishing rotational military service, every healthy man, regardless of rank, served one month a year. This created a permanent rotating army of 5,000 men.",
  "„…გიყვარდეს შენი ერი, შენი ქვეყანა, იღვაწე მის საკეთილდღეოდ, ნუ გძულს სხვა ერები და ნუ გშურს იმათთვის ბედნიერება, ნუ შეუშლი იმათ მისწრაფებას ხელს და ეცადე, რომ შენი სამშობლო არავინ დაჩაგროს და გაუთანასწორდეს მოწინავე ერებს.“":
    "“…Love your nation and your country; work for its good. Do not hate other nations or begrudge their happiness, do not obstruct their aspirations, and strive to ensure that nobody oppresses your homeland and that it stands alongside the leading nations.”",
  "„კოსმოპოლიტიზმი და პატრიოტიზმი“, 1905": "“Cosmopolitanism and Patriotism”, 1905",
  "„…ისე მოეფინოს, რომ მაგ ფულს ერთი გროშიც არ დაეკარგოს, სესხმა ფული ასარგებლოს, ფულმა ფული მოიგოს და მხოლოდ ამ მოგებიდან უფრო ბევრი წილი ჩვენის ქვეყნის საერთო საჭიროებას მოხმარდეს…“":
    "“…Let it be distributed so that not a penny is lost, lending earns a return, money generates money, and a larger share of that profit serves the common needs of our country…”",
  "სიტყვა ბანკის დამფუძნებელ კრებაზე, 1875": "Address to the bank’s founding assembly, 1875",
  "„ერის ყოველი წარმატება, თვით ნივთიერ კულტურის სფეროშიაც კი, თეორიული მეცნიერების წარმატებასა და აღმოჩენებზეა დამოკიდებული.“":
    "“Every achievement of a nation, even in material culture, depends on the progress and discoveries of theoretical science.”",
  "ივანე ჯავახიშვილი": "Ivane Javakhishvili",
  "თბილისის უნივერსიტეტის ფუძემდებელი, 1917": "Founder of Tbilisi University, 1917",
  "ექვთიმე თაყაიშვილი 24 წელი იცავდა ემიგრაციაში გატანილ ეროვნულ საგანძურს. უცხოური მუზეუმების ზეწოლას გაუძლო და 1945 წელს განძი სამშობლოს უკლებლივ დაუბრუნა.":
    "Ekvtime Takaishvili safeguarded the national treasury in exile for 24 years. He resisted pressure from foreign museums and returned the entire collection to his homeland in 1945.",
  "„რაკი ვლადიკავკასიდამ გამოვედი და ჩემის ქვეყნის სიომ დამკრა, გულმა სულ სხვარიგად დამიწყო ფეთქა.“":
    "“As soon as I left Vladikavkaz and felt the breeze of my country, my heart began to beat in an entirely different way.”",
  "„მგზავრის წერილები“": "“Letters of a Traveller”",
  "„რესპუბლიკას და ადგილობრივ მმართველობას ევალება დედობის და ბავშვების დაცვისათვის მზრუნველობა.“":
    "“The republic and local government have a duty to care for the protection of motherhood and children.”",
  "1921, მუხლი\u00a0128": "1921, Article 128",
  "„რასაცა გასცემ, შენია; რას არა, დაკარგულია!“":
    "“What you give is yours; what you keep is lost!”",
  "შოთა რუსთაველი": "Shota Rustaveli",
  "„ვეფხისტყაოსანი“": "“The Knight in the Panther’s Skin”",
  "25\u00a0თებერვალი 1921": "25 February 1921",
  "წითელი არმია თბილისში შევიდა. 2010 წლიდან ეს დღე საბჭოთა ოკუპაციის დღეა.":
    "The Red Army entered Tbilisi. Since 2010, the date has been observed as Soviet Occupation Day.",
  "„…მიუხედავად გათიშულობისა, საქართველო ნიადაგ მთლიანი იყო სულიერად.“":
    "“…Despite its divisions, Georgia was always spiritually whole.”",
  "„გზა ჭეშმარიტებისა“, 1983": "“The Path of Truth”, 1983",
  [home.HOME_HERO_KICKER]: "Civic portal",
  [home.HOME_HEADLINE[0]]: "Unite to Build",
  [home.HOME_HEADLINE[1]]: "Georgian Republic",
  [home.HOME_LEDE]: "Ideas change a country only when people come together around them.",
  [home.HOME_SEO_TITLE]: "Georgian Republic — civic portal",
  [home.HOME_SEO_DESCRIPTION]:
    "A civic portal uniting Georgians around shared goals and values. Read the agreement and become a supporter.",
  [home.HOME_HERO_JOIN]: "Become a supporter",
  [home.HOME_HERO_PRINCIPLES]: "Read the agreement →",
  [home.HOME_MAP_CAPTION]: "Georgia belongs to its people",
  [home.HOME_MISSION_LABEL]: "The purpose of the portal",
  [home.HOME_STAT_SUPPORTERS]: "Supporter",
  [home.HOME_STAT_MEMBERS]: "Member",
  [home.HOME_STAT_DELEGATES]: "Delegate",
  [home.HOME_MISSION[0]]: "The Georgian Republic portal aims to",
  [home.HOME_MISSION[1]]: "create a space",
  [home.HOME_MISSION[2]]: "where the Georgian people can:",
  [home.HOME_MISSION_STEPS[0]]: "Unite",
  [home.HOME_MISSION_STEPS[1]]: "Organise",
  [home.HOME_MISSION_STEPS[2]]: "Choose their leaders",
  [home.HOME_MISSION_STEPS[3]]: "Win together",
  [home.HOME_JOIN_TITLE]: "How to join us",
  [home.HOME_JOIN_STEPS[0].text]: "Simple registration with your email and phone number.",
  [home.HOME_JOIN_STEPS[0].link.label]: "Become a supporter →",
  [home.HOME_JOIN_STEPS[1].text]: "Propose initiatives and take part in votes open to all members.",
  [home.HOME_JOIN_STEPS[1].link.label]: "Start by registering →",
  [home.HOME_JOIN_STEPS[2].text]: "Represent the movement in your town, village or neighbourhood.",
  [home.HOME_JOIN_STEPS[2].link.label]: "Read the rules →",
  [home.HOME_PRINCIPLES_TITLE]: "What unites us",
  [home.HOME_PRINCIPLES_ALL]: "The full agreement · 12 principles",
  [home.HOME_MOTTO]: "“Strength is in unity”",
  [home.HOME_MOTTO_SOURCE]: "Motto on Georgia’s national coat of arms",
  [home.HOME_STRUCTURE_TITLE[0]]: "Organisational",
  [home.HOME_STRUCTURE_TITLE[1]]: "Structure",
  [home.HOME_STRUCTURE_RULES[2].text]:
    "The board can put an important question to all members for a decision.",
  [home.HOME_STRUCTURE_LINK]: "Organisational structure →",
  [home.HOME_RING_SUB]: "5 members",
  [home.HOME_NEWS_TITLE]: "News",
  [home.HOME_NEWS_ALL]: "View all →",
  [home.HOME_NEWS_EMPTY]: "News will appear here soon.",
  [home.HOME_ROOTS_KICKER]: "Our roots",
  [home.HOME_ROOTS_TITLE[0]]: "The First",
  [home.HOME_ROOTS_TITLE[1]]: "Republic",
  [home.HOME_ROOTS_QUOTE]:
    "“From this day forward, the people of Georgia hold sovereign rights, and Georgia is a fully independent state.”",
  [home.HOME_ROOTS_QUOTE_SOURCE]: "Act of Independence · Article 1",
  [home.HOME_ROOTS_TEXT]:
    "At 17:10 on 26 May 1918, the National Council of Georgia proclaimed the Act of Independence in Tbilisi.",
  [home.HOME_ROOTS_LINK.label]: "Explore our roots →",
  [home.HOME_ROOTS_BUTTON]: "Explore our roots",
  [home.HOME_DOCUMENTS_CAPTION]:
    "Act of Independence, confirmed by the Constituent Assembly on 12 March 1919 · 1921 Constitution: cover and signatures. Source: National Archives of Georgia",
  [home.HOME_MILESTONES[0]!.date]: "26 May",
  [home.HOME_MILESTONES[0]!.title]: "Act of Independence",
  [home.HOME_MILESTONES[0]!.text]:
    "“The political form of independent Georgia is a democratic republic.”",
  [home.HOME_MILESTONES[1]!.date]: "14–16 February",
  [home.HOME_MILESTONES[1]!.title]: "Constituent Assembly",
  [home.HOME_MILESTONES[1]!.text]:
    "Elected by citizens of both sexes through a “…direct, equal, universal, secret and proportional electoral system”.",
  [home.HOME_MILESTONES[2]!.date]: "21 February",
  [home.HOME_MILESTONES[2]!.title]: "Constitution",
  [home.HOME_MILESTONES[2]!.text]: "“Sovereignty belongs to the entire nation…”",
  [home.HOME_MILESTONES[2]!.source!]: "— Article 52",
  [home.HOME_MILESTONES[3]!.date]: "9 April",
  [home.HOME_MILESTONES[3]!.title]: "Restoration of independence",
  [home.HOME_MILESTONES[3]!.text]:
    "Independence was restored “…on the basis of Georgia’s Act of Independence of 26 May 1918.”",
  [about.ABOUT_TITLE]: "About us",
  [about.ABOUT_SEO_DESCRIPTION]:
    "Who we are, what we believe and what we aim for: from unity to victory.",
  [about.ABOUT_INTRO_REST]: "is a community of people who believe:",
  [about.ABOUT_BELIEFS[0]]:
    "That Georgia and the Georgian state belong to the Georgian nation, rather than a narrow, corrupt elite that enriches itself at our expense and turns the country’s wealth into private property.",
  [about.ABOUT_BELIEFS[1]]:
    "That Georgia should be governed by people who serve the interests of the whole nation, rather than just a handful of oligarchs or officials.",
  [about.ABOUT_BELIEFS[2]]:
    "That we can build a state where nobody feels oppressed, everyone has an equal opportunity to prosper, and every Georgian family can live with dignity.",
  [about.ABOUT_UNITY_LEAD]:
    "We also believe that Georgians cannot achieve all this without solidarity and unity,",
  [about.ABOUT_UNITY_CLOSE]: "but we certainly can if we come together.",
  [about.ABOUT_GOAL_KICKER]: "Our goal",
  [about.ABOUT_GOAL_TITLE]: "From unity to victory",
  [about.ABOUT_GOAL_STEPS[0].label]: "Unity",
  [about.ABOUT_GOAL_STEPS[0].text]:
    "Unite the Georgian nation around a shared agreement, values and goals",
  [about.ABOUT_GOAL_STEPS[1].label]: "Political force",
  [about.ABOUT_GOAL_STEPS[1].text]:
    "Build this unity into a strong political force created by the people",
  [about.ABOUT_GOAL_STEPS[2].label]: "Victory",
  [about.ABOUT_GOAL_STEPS[2].text]: "The victory of the nation’s will",
  [about.ABOUT_PORTAL_KICKER]: "The portal",
  [about.ABOUT_PORTAL_LEAD]:
    "This portal exists to help build and strengthen that political unity.",
  [about.ABOUT_PORTAL_SUB]: "It is a space where the Georgian people can:",
  [about.ABOUT_PORTAL_CARDS[0]!.title]: "Come together",
  [about.ABOUT_PORTAL_CARDS[1]!.title]: "Organise",
  [about.ABOUT_PORTAL_CARDS[1]!.detail.text]: "Complete an application to become a member.",
  [about.ABOUT_PORTAL_CARDS[1]!.detail.link.label]: "Become a member →",
  [about.ABOUT_PORTAL_CARDS[2]!.title]: "Choose their leaders",
  [about.ABOUT_PORTAL_CARDS[3]!.title]: "Take part in making decisions",
  [about.ABOUT_ROOTS_INTRO]:
    "On 26 May 1918, Georgia declared independence and established a democratic republic. In less than three years, the republic held universal elections, gave women the vote and adopted a constitution that placed sovereignty in the hands of the entire nation.",
  [about.ABOUT_DOCUMENTS_CAPTION]:
    "Act of Independence (copy dated 12 March 1919) · 1921 Constitution: first chapter and signatures. Source: National Archives of Georgia",
  [about.ABOUT_TIMELINE_LABEL]: "Timeline",
  [about.ABOUT_TIMELINE_FLAG]: "Flag of the republic: 1918–1921, 1990–2004",
  [about.ABOUT_TIMELINE[0]!.date]: "26 May, 17:10",
  [about.ABOUT_TIMELINE[0]!.lines[0]!]:
    "“…equally guarantees every citizen’s civil and political rights, regardless of nationality, faith, social status or sex.”",
  [about.ABOUT_TIMELINE[0]!.source!]: "— Article 5",
  [about.ABOUT_TIMELINE[1]!.title]: "Constituent Assembly elections",
  [about.ABOUT_TIMELINE[1]!.lines[0]!]:
    "Citizens of both sexes took part in the elections. Five of the 130 deputies were women.",
  [about.ABOUT_TIMELINE[2]!.lines[0]!]: "“Sovereignty belongs to the entire nation…” — Article 52",
  [about.ABOUT_TIMELINE[2]!.lines[1]!]: "“The death penalty is abolished.” — Article 19",
  [about.ABOUT_TIMELINE[2]!.lines[2]!]:
    "A group of 5,000 voters also had the right to introduce legislation — Article 63",
  [about.ABOUT_TIMELINE[3]!.date]: "25 February",
  [about.ABOUT_TIMELINE[3]!.title]: "Occupation",
  [about.ABOUT_TIMELINE[3]!.lines[0]!]:
    "The Red Army entered Tbilisi. Since 2010, 25 February has been observed as Soviet Occupation Day.",
  [about.ABOUT_TIMELINE[4]!.title]: "The tragedy of 9 April",
  [about.ABOUT_TIMELINE[4]!.lines[0]!]:
    "Soviet troops attacked a peaceful demonstration on Rustaveli Avenue. Twenty-one people died.",
  [about.ABOUT_TIMELINE[5]!.date]: "31 March",
  [about.ABOUT_TIMELINE[5]!.title]: "Referendum",
  [about.ABOUT_TIMELINE[5]!.lines[0]!]:
    "Turnout: 90.57%. Restoration of independence received 99.49% of the vote.",
  [about.ABOUT_CLOSING_LINK.label]: "Contact us →",
  [archive.DOCUMENTS_ZOOM]: "Enlarge",
  [archive.DOCUMENTS_CLOSE]: "Close",
  [archive.CONSTITUTION_COVER.name]: "Cover of the 1921 Constitution",
  [archive.CONSTITUTION_COVER.caption]:
    "Constitution of Georgia, 1921 — cover. National Archives of Georgia",
  [archive.CONSTITUTION_FIRST_CHAPTER.name]: "First chapter of the 1921 Constitution",
  [archive.CONSTITUTION_FIRST_CHAPTER.caption]:
    "1921 Constitution — Chapter One: General Provisions. National Archives of Georgia",
  [archive.CONSTITUTION_SIGNATURES.name]: "Signatures of the 1921 Constitution",
  [archive.CONSTITUTION_SIGNATURES.caption]:
    "Signature page of the 1921 Constitution. National Archives of Georgia",
  [archive.INDEPENDENCE_ACT.name]: "Georgia’s Act of Independence, with signatures",
  [archive.INDEPENDENCE_ACT.caption]:
    "Georgia’s Act of Independence — signed copy confirmed by the Constituent Assembly on 12 March 1919. National Archives of Georgia",
  [structure.STRUCTURE_TITLE]: "Organisational structure",
  [structure.STRUCTURE_INTRO]:
    "The movement is led by a board, with every member taking part in its decisions.",
  [structure.BOARD_HEADING]: "Board",
  [structure.BOARD_LEAD]:
    "The board is the movement’s principal governing body and consists of five members.",
  [structure.BOARD_DUTIES[0]]: "Approves the movement’s strategy and action plan",
  [structure.BOARD_DUTIES[1]]: "Approves the quarterly report",
  [structure.BOARD_DUTIES[2]]: "Admits new members",
  [structure.BOARD_DUTIES[3]]: "Appoints the administrative head",
  [structure.BOARD_RULES_LABEL]: "How the board makes decisions",
  [structure.RULE_TWO_THIRDS.headline]: "At least 2/3",
  [structure.RULE_TWO_THIRDS.body]:
    "Adding a new board member and approving the movement’s charter",
  [structure.RULE_MAJORITY.headline]: "Simple majority",
  [structure.RULE_MAJORITY.body]: "All other decisions",
  [structure.MEMBERS_HEADING]: "Members",
  [structure.MEMBERS_LEAD]:
    "The board admits new members following an interview or a recommendation from an existing member.",
  [structure.MEMBERS_PATH_LABEL]: "How to become a member",
  [structure.MEMBERS_PATH_STEPS[0]]: "Interview or recommendation from an existing member",
  [structure.MEMBERS_PATH_STEPS[1]]: "Board decision",
  [structure.MEMBERS_PATH_STEPS[2]]: "Member of the movement",
  [structure.MEMBERS_RIGHTS_LABEL]: "A member can",
  [structure.MEMBERS_RIGHTS[0]]: "Submit an initiative to the board",
  [structure.MEMBERS_RIGHTS[1]]: "Nominate a candidate for the board",
  [structure.MEMBERS_RIGHTS[2]]: "Recommend a new member",
  [structure.MEMBERS_RIGHTS[3]]: "Take part in a vote open to all members",
  [structure.VOTE_HEADING]: "General vote",
  [structure.VOTE_LEAD]:
    "The board can put an important question to all members for a decision. A majority of those taking part determines the outcome.",
  [structure.VOTE_FOR]: "In favour",
  [structure.VOTE_AGAINST]: "Against",
  [structure.ROSTER_HEADING]: "Board members",
  [structure.ROSTER_NOTICE]: "The board roster will be published soon",
  [structure.DESIGN_ONLY_COPY.flowMembersNote]: "Initiatives · nominations · recommendations",
  [structure.DESIGN_ONLY_COPY.flowVoteNote]: "Important questions · majority vote",
  [structure.DESIGN_ONLY_COPY.decisionPasses]: "The decision passes",
  [structure.DESIGN_ONLY_COPY.decisionFails]: "The decision does not pass",
  [structure.DESIGN_ONLY_COPY.rulesHint]: "Try it: click the pebbles.",
  [structure.DESIGN_ONLY_COPY.historyLabel]: "Historical roots",
  [structure.DESIGN_ONLY_COPY.historyText]:
    "Under the 1921 Constitution, 5,000 voters could introduce legislation (Article 63), and 30,000 voters could request in writing that a newly adopted law be put to a referendum (Article 64).",
  [support.SUPPORT_HEADING]: "Contact us",
  [support.SUPPORT_LEDE]: "Write to us — we read and reply to every message.",
  [support.SUPPORT_NAME_LABEL]: "Name",
  [support.SUPPORT_EMAIL_LABEL]: "Email",
  [support.SUPPORT_PHONE_LABEL]: "Phone",
  [support.SUPPORT_OPTIONAL_HINT]: "(optional)",
  [support.SUPPORT_MESSAGE_LABEL]: "Message",
  [support.SUPPORT_SUBMIT_LABEL]: "Send",
  [support.SUPPORT_SUCCESS]: "Your message has been sent. We’ll reply soon.",
  [support.SUPPORT_FAILURE]: "Your message could not be sent. Please try again.",
  [support.SUPPORT_NEED_CONTACT]: "Enter an email address or phone number.",
  [support.SUPPORT_RATE_LIMITED]: "Too many messages have been sent. Please try again later.",
  [support.SUPPORT_EMAIL_INVALID]: "Enter a valid email address.",
  [support.SUPPORT_FILL_FIELD]: "Complete this field",
  [support.SUPPORT_MAX_60]: "Maximum 60 characters",
  [support.SUPPORT_MAX_120]: "Maximum 120 characters",
  [support.SUPPORT_MAX_40]: "Maximum 40 characters",
  [support.SUPPORT_MIN_10]: "At least 10 characters",
  [support.SUPPORT_MAX_2000]: "Maximum 2,000 characters",
  [support.SUPPORT_INVALID_INPUT]: "The information is invalid.",
  "ერთად შეგვიძლია.": "Together, we can.",
  შემოგვიერთდი: "Join us",
  "საქართველოს სახელმწიფო დროშა": "National flag of Georgia",
  "ბორდის წევრი": "Board member",
  "შეთანხმების პუნქტი": "Agreement principle",
  "მოძრაობის სიახლეები და განცხადებები.": "News and announcements from the movement.",
  "← სიახლეები": "← News",
  ღონისძიებები: "Events",
  "მოძრაობის შეხვედრები და ღონისძიებები.": "Meetings and events of the movement.",
  მომავალი: "Upcoming",
  გასული: "Past",
  "მომავალი ღონისძიებები მალე გამოცხადდება.": "Upcoming events will be announced soon.",
  "← ღონისძიებები": "← Events",
  "ღონისძიება გაუქმებულია": "This event has been cancelled",
  "ღონისძიება დასრულებულია.": "This event has ended.",
  გაუქმებული: "Cancelled",
  "დასწრების აღნიშვნა კაბინეტში": "Register your attendance in your account",
  გამჭვირვალობა: "Transparency",
  "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.":
    "Open data on the movement’s membership and income — directly from the register.",
  "შეგროვებული საწევრო შენატანები": "Membership dues collected",
  "სულ, დაარსებიდან": "Total since founding",
  "დამტკიცებული დელეგატი": "Approved delegate",
  "წევრები რეგიონების მიხედვით": "Members by region",
  რეგიონი: "Region",
  "შეგროვებული თანხა (₾)": "Amount collected (₾)",
  "მონაცემები გამოითვლება ავტომატურად: შენატანები — აღრიცხული საბანკო გადარიცხვებიდან, წევრობა — რეგისტრაციის რეესტრიდან. გვერდი ახლდება უწყვეტად.":
    "Figures are calculated automatically: contributions from recorded bank transfers, and membership from the registration register. This page is continuously updated.",
  "← უკან რეიტინგზე": "← Back to rankings",
  დამტკიცებული: "Approved",
  "ღია რეიტინგში": "In the public rankings",
  "პოზიცია რეიტინგში": "Ranking position",
  "დამტკიცებულ დელეგატებს შორის": "Among approved delegates",
  "დარეგისტრირდი და წევრობის გაფორმებისას აირჩიე ის შენს დელეგატად — მხარდაჭერა წევრობით ხდება.":
    "Register and choose this delegate when completing your membership — you show your support by becoming a member.",
  "გახდი მისი მხარდამჭერი": "Become a supporter",
  "დელეგატების რეიტინგი": "Delegate rankings",
  "ავტომატურად ლაგდება წევრების რაოდენობის მიხედვით.":
    "Automatically ranked by the number of members.",
  "ცოცხალი რეიტინგი": "Live rankings",
  ლიდერბორდი: "Leaderboard",
  "რეიტინგი ახლდება ავტომატურად ყოველი ახალი წევრის დამატებისას.":
    "Rankings update automatically whenever a new member joins.",
  "ძებნა სახელით...": "Search by name…",
  "ძებნა სახელით": "Search by name",
  მხარე: "Region",
  "ყველა მხარე": "All regions",
  "ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.":
    "No delegates match these filters. Try another search or choose “All regions”.",
  ნაჩვენებია: "Showing",
  "წესები და პირობები": "Terms and conditions",
  "კონფიდენციალურობის პოლიტიკა": "Privacy policy",
  "პერსონალური მონაცემები": "Personal data",
  "ეს გვერდი გიხსნის, რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ.":
    "This page explains what information we collect, how we use it and who can see it.",
  "ეს გვერდი გიხსნის, რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ. ვერსია 1, 2026 წლის ოქტომბერი.":
    "This page explains what information we collect, how we use it and who can see it. Version 1, October 2026.",
  "ვინ ვართ": "Who we are",
  "პლატფორმას მართავს მოძრაობა ქართული რესპუბლიკა. ის პასუხისმგებელია იმ პერსონალურ მონაცემებზე, რომლებსაც ამ საიტზე გვაწვდი. კითხვებისა და მოთხოვნებისთვის მოგვწერე საკონტაქტო გვერდიდან.":
    "The platform is operated by the Georgian Republic movement. It is responsible for the personal data you provide on this website. For questions and requests, write to us through the contact page.",
  "რა მონაცემებს ვაგროვებთ": "What information we collect",
  "რეგისტრაციისას: Google ანგარიშის ელფოსტა, სახელი და პროფილის ფოტო (მათ Google გვაწვდის), შენ მიერ შეყვანილი სახელი და გვარი, ტელეფონის ნომერი (დადასტურებული SMS კოდით) და რეფერალური კოდი, თუ ბმულით მოხვედი.":
    "When you register: your Google account email, name and profile photo (provided by Google), the first and last name you enter, your phone number (verified by SMS code), and a referral code if you arrived through a referral link.",
  "წევრობის განაცხადისას: პირადი ნომერი, დაბადების თარიღი, რეგიონი და ქალაქი, საქმიანობა და შენ მიერ არჩეული დელეგატი.":
    "When you apply for membership: your personal identification number, date of birth, region and city, occupation and chosen delegate.",
  "დელეგატად დამტკიცებისას: მოკლე ბიოგრაფია და ფოტო.":
    "When you are approved as a delegate: a short biography and photo.",
  "საიტით სარგებლობისას: ღონისძიებებზე დასწრების მონიშვნა, ხმა გამოკითხვებში და საკონტაქტო ფორმით გამოგზავნილი შეტყობინებები.":
    "When you use the website: event attendance registrations, votes in polls and messages sent through the contact form.",
  "ტექნიკური ჩანაწერები: საიტის მუშაობისა და უსაფრთხოებისთვის სერვერი ავტომატურად აღრიცხავს IP მისამართს და ბრაუზერის მონაცემებს.":
    "Technical records: the server automatically records your IP address and browser information to operate and secure the website.",
  "რისთვის ვიყენებთ": "How we use it",
  "შენს მონაცემებს ვიყენებთ მხოლოდ მოძრაობის საქმიანობისთვის: რეგისტრაციისა და შესვლისთვის, წევრობისა და დელეგატების სისტემისთვის, ღონისძიებებისა და გამოკითხვების ორგანიზებისთვის და საჯარო სტატისტიკისთვის, რომელიც მხოლოდ ჯამურ რიცხვებს აჩვენებს. მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ.":
    "We use your information only for the movement’s activities: registration and sign-in, the membership and delegate systems, organising events and polls, and public statistics that show totals only. We do not sell your data or use it for advertising.",
  "ვინ ხედავს შენს მონაცემებს": "Who can see your information",
  "მხარდამჭერის შესახებ საჯაროდ არაფერი ჩანს.":
    "No information about a supporter is shown publicly.",
  "თუ წევრი გახდები და დელეგატს აირჩევ, ეს დელეგატი ხედავს შენს სახელს, გვარს, რეგისტრაციის თარიღს, სტატუსს და ღონისძიებებზე დასწრების მონიშვნას.":
    "If you become a member and choose a delegate, that delegate can see your first and last name, registration date, status and event attendance registrations.",
  "თუ დელეგატად დაგამტკიცებენ, საჯაროდ გამოჩნდება შენი სახელი, გვარი, რეგიონი, ფოტო, ბიოგრაფია, წევრების რაოდენობა და ადგილი რეიტინგში.":
    "If you are approved as a delegate, your first and last name, region, photo, biography, member count and ranking will be shown publicly.",
  "სრულ მონაცემებს ხედავენ მხოლოდ პლატფორმის ადმინისტრატორები.":
    "Only the platform’s administrators can see the complete information.",
  "საჯაროდ ქვეყნდება მხოლოდ ჯამური რიცხვები, მათ შორის რეგიონების მიხედვით.":
    "Only aggregate figures are published, including totals by region.",
  "ვის ვუზიარებთ": "Who we share it with",
  "მონაცემებს ვუზიარებთ მხოლოდ იმ მომსახურების მიმწოდებლებს, რომლებიც საიტის მუშაობისთვისაა საჭირო — ავტორიზაცია, SMS-ით დადასტურება, მონაცემთა შენახვა და ჰოსტინგი. მონაცემთა ბაზა ევროკავშირში მდებარეობს, თუმცა ზოგიერთი მიმწოდებელი, მაგალითად Google-ით შესვლა და ჰოსტინგი, მონაცემებს აშშ-შიც ამუშავებს. სხვა პირებს შენს მონაცემებს შენი თანხმობის გარეშე არ გადავცემთ, გარდა კანონით გათვალისწინებული შემთხვევებისა.":
    "We share information only with service providers needed to run the website: authentication, SMS verification, data storage and hosting. The database is located in the European Union, although some providers, including Google sign-in and hosting services, also process data in the United States. We do not give your information to others without your consent, except where required by law.",
  "რამდენ ხანს ვინახავთ": "How long we keep it",
  "მონაცემებს ვინახავთ, სანამ ანგარიშს არ წაშლი. წაშლისას შენი პერსონალური მონაცემები პლატფორმის მონაცემთა ბაზიდან მაშინვე იშლება. დასრულებულ გამოკითხვებში მიცემული ხმები რჩება ისე, რომ შენი ამოცნობა შეუძლებელი იყოს. SMS-ების ლიმიტის აღრიცხვაში შენი ტელეფონის ნომერი რჩება დაახლოებით ერთი დღის განმავლობაში, სარეზერვო ასლები კი თავისით იშლება ერთი კვირის განმავლობაში. საკონტაქტო ფორმით გამოგზავნილი შეტყობინებები ანგარიშთან დაკავშირებული არ არის და ინახება ცალკე.":
    "We keep your information until you delete your account. On deletion, your personal data is removed from the platform’s database immediately. Votes in closed polls remain in a form that cannot identify you. Your phone number remains in SMS limit records for approximately one day, while backups are automatically deleted within one week. Messages sent through the contact form are not linked to your account and are stored separately.",
  "შენი უფლებები": "Your rights",
  "პერსონალურ მონაცემთა დაცვის შესახებ საქართველოს კანონის მიხედვით, შეგიძლია მოითხოვო შენი მონაცემების ნახვა, გასწორება ან წაშლა, ასევე ნებისმიერ დროს, მიზეზის განმარტების გარეშე, გაიხმო თანხმობა. ანგარიშის წაშლა შეგიძლია თავადაც, პროფილის გვერდიდან. მოთხოვნა გამოგვიგზავნე საკონტაქტო გვერდიდან — გიპასუხებთ არაუგვიანეს 10 სამუშაო დღისა.":
    "Under Georgia’s Law on Personal Data Protection, you can request access to, correction or deletion of your information, and withdraw consent at any time without giving a reason. You can also delete your account yourself from your profile page. Send requests through the contact page — we will reply within 10 working days.",
  ასაკი: "Age",
  "პლატფორმაზე რეგისტრაცია შეუძლია მხოლოდ 18 წლის ან უფროს პირს.":
    "Only people aged 18 or over may register on the platform.",
  "ქუქი-ფაილები": "Cookies",
  "საიტი იყენებს მხოლოდ შესვლისთვის აუცილებელ ქუქი-ფაილებს. სათვალთვალო ან სარეკლამო ქუქი-ფაილებს არ ვიყენებთ.":
    "The website uses only cookies required for sign-in. We do not use tracking or advertising cookies.",
  ცვლილებები: "Changes",
  "თუ ამ პოლიტიკას შევცვლით, ახალ ვერსიას თარიღით აქ გამოვაქვეყნებთ.":
    "If we change this policy, we will publish the new version here with its date.",
  "დელეგატის წესები და პირობები": "Delegate terms and conditions",
  "დელეგატად ყოფნის წესები და პირობები.": "The terms and conditions for being a delegate.",
  "სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.": "Draft version — subject to legal review.",
  "დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და ზუსტია.":
    "The delegate confirms that all information provided during registration is true and accurate.",
  "დელეგატი მოქმედებს კანონმორჩილად და პლატფორმის ღირებულებების — გამჭვირვალობის, ანგარიშვალდებულებისა და პატივისცემის — შესაბამისად.":
    "The delegate acts lawfully and in accordance with the platform’s values of transparency, accountability and respect.",
  "დელეგატის საჯარო პროფილი და რეფერალური ბმული აქტიურდება მხოლოდ ადმინისტრაციული ვერიფიკაციის შემდეგ.":
    "The delegate’s public profile and referral link are activated only after verification by the administration.",
  "წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს დელეგატის სტატუსი.":
    "If the rules are breached, the platform reserves the right to suspend or revoke delegate status.",
};
