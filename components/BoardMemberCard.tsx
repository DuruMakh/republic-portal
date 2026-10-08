import Image from "next/image";
import type { BoardMember } from "@/lib/board-members";
import { SocialLinks } from "./SocialLinks";

export function BoardMemberCard({ member }: { member: BoardMember }) {
  return (
    <article className="grid content-start gap-3">
      <div className="relative aspect-[4/5] max-w-full overflow-hidden border border-line bg-paper-bright">
        <Image
          src={member.photo}
          alt={member.name}
          fill
          sizes="(max-width: 900px) 50vw, 230px"
          className="object-cover"
        />
      </div>
      <h3 className="font-serif text-[1.08rem] leading-snug font-bold text-ink">{member.name}</h3>
      <p className="text-[0.86rem] leading-relaxed text-muted-fg">{member.bio}</p>
      <SocialLinks person={member.name} links={member.socials} />
    </article>
  );
}
