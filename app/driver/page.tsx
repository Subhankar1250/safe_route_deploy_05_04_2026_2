import { redirect } from "next/navigation";

/** Drivers often open `/driver`; the app lives at `/driver/dashboard`. */
export default function DriverRootPage() {
  redirect("/driver/dashboard");
}
