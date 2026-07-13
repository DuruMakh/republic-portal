import { Card } from "@/components/Card";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <Card title="ჩემი პროფილი">
      <p className="text-sm text-muted-fg" data-testid="profile-phone">
        ტელეფონი: {user?.phone ?? "—"}
      </p>
      <p className="mt-2 text-sm text-muted-fg">პროფილის სრული ფუნქციონალი მალე დაემატება.</p>
    </Card>
  );
}
