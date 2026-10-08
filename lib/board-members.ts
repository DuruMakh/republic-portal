import { z } from "zod";

/**
 * The board roster shown on /structure. Edited in code (owner decision, 2026-10-07): each
 * change ships through a preview link for owner sign-off. Empty until the owner sends the
 * members; the page then shows its "coming soon" notice.
 *
 * To add a member: put the photo at public/board/<slug>.jpg (portrait, 4:5) and append
 *   { name, photo: "/board/<slug>.jpg", bio, socials: [{ network, url }] }
 * Networks are facebook, tiktok, linkedin (owner-confirmed); each is optional per person.
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
    bio: z.string().trim().min(1).max(300),
    socials: z
      .array(socialLinkSchema)
      .refine((links) => new Set(links.map((l) => l.network)).size === links.length, {
        message: "one link per network",
      }),
  })
  .strict();

export type BoardMember = z.infer<typeof boardMemberSchema>;

export const BOARD_MEMBERS: readonly BoardMember[] = [];
