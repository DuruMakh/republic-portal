import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";

export default function DelegateNotFound() {
  return (
    <CenteredNotice
      title="დელეგატი ვერ მოიძებნა."
      description="ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა."
      actions={
        <ButtonLink href="/leaderboard" variant="ghost">
          დაბრუნდი რეიტინგზე
        </ButtonLink>
      }
    />
  );
}
