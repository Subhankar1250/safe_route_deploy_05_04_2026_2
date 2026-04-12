import { redirect } from "next/navigation";

/** Parents often open `/guardian`; the app lives at `/guardian/dashboard`. */
export default function GuardianRootPage() {
  redirect("/guardian/dashboard");
}
