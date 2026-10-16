import { GoogleJoinForm } from "./GoogleJoinForm";
import { LegacyJoinForm } from "./LegacyJoinForm";

export default function JoinForm() {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "google" ? <GoogleJoinForm /> : <LegacyJoinForm />;
}
