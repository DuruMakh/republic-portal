import { z } from "zod";

/**
 * The board roster shown on /structure. Edited in code (owner decision, 2026-10-07): each
 * change ships through a preview link for owner sign-off. An empty list shows the page's
 * "coming soon" notice instead of cards.
 *
 * To add a member: put the photo at public/board/<slug>.jpg (portrait, 4:5) and append
 *   { name, photo: "/board/<slug>.jpg", bio (optional), socials: [{ network, url }] }
 * Networks are facebook, tiktok, linkedin (owner-confirmed); each is optional per person.
 * The bio is optional too: the owner sent the first roster without bios (2026-10-08).
 * To replace a photo, use a new filename: image caches key on the path, not the content.
 */
export const SOCIAL_NETWORKS = ["facebook", "tiktok", "linkedin"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

const NETWORK_HOSTS: Record<SocialNetwork, readonly string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
};

function onOwnHost(network: SocialNetwork, url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.username === "" &&
      u.password === "" &&
      NETWORK_HOSTS[network].includes(u.hostname)
    );
  } catch {
    return false;
  }
}

const socialLinkSchema = z
  .object({ network: z.enum(SOCIAL_NETWORKS), url: z.string() })
  .strict()
  .refine((link) => onOwnHost(link.network, link.url), {
    message: "url must be https on the network's own host",
  });

export const boardMemberSchema = z
  .object({
    name: z.string().trim().min(1),
    photo: z.string().regex(/^\/board\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/),
    bio: z.string().trim().min(1).max(300).optional(),
    socials: z
      .array(socialLinkSchema)
      .refine((links) => new Set(links.map((l) => l.network)).size === links.length, {
        message: "one link per network",
      }),
  })
  .strict();

export type BoardMember = z.infer<typeof boardMemberSchema>;

// Owner's list of 2026-10-08, in the order sent. Photos are cropped copies of the owner's links.
export const BOARD_MEMBERS: readonly BoardMember[] = [
  {
    name: "გიორგი თავართქილაძე",
    photo: "/board/giorgi-tavartkiladze.jpg",
    socials: [
      { network: "facebook", url: "https://www.facebook.com/giorgi.tavartqiladze.5" },
      { network: "tiktok", url: "https://www.tiktok.com/@gtavartkil" },
    ],
  },
  {
    name: "ლევან ნიშნიანიძე",
    photo: "/board/levan-nishnianidze.jpg",
    socials: [
      { network: "facebook", url: "https://www.facebook.com/Lnishnianidze" },
      { network: "tiktok", url: "https://www.tiktok.com/@levan.nishnianidz" },
    ],
  },
  {
    name: "ნუკრი კაკულია",
    photo: "/board/nukri-kakulia.jpg",
    socials: [
      { network: "facebook", url: "https://www.facebook.com/nukri.kakulia.50" },
      { network: "tiktok", url: "https://www.tiktok.com/@nukri.kakulia" },
    ],
  },
  {
    name: "დურუ მახარაძე",
    photo: "/board/duru-makharadze.jpg",
    socials: [
      { network: "facebook", url: "https://www.facebook.com/duru.makharadze" },
      { network: "linkedin", url: "https://www.linkedin.com/in/duru-makharadze-2b35a4205/" },
    ],
  },
  {
    name: "გიორგი მჭედლიშვილი",
    photo: "/board/giorgi-mchedlishvili.jpg",
    socials: [
      { network: "facebook", url: "https://www.facebook.com/giorgi.mchedlishvili.9484" },
      { network: "tiktok", url: "https://www.tiktok.com/@g.mtchedlishvili" },
    ],
  },
];
