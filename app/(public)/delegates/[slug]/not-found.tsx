import { ButtonLink } from "@/components/ButtonLink";

export default function DelegateNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-ink">დელეგატი ვერ მოიძებნა.</h1>
      <p className="mt-3 text-muted-fg">ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა.</p>
      <div className="mt-6">
        <ButtonLink href="/leaderboard" variant="ghost">
          დაბრუნდი რეიტინგზე
        </ButtonLink>
      </div>
    </main>
  );
}
