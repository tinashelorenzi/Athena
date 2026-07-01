import { redirect } from "next/navigation";

// Athena has no marketing landing — enter the console (the console layout
// bounces unauthenticated users to /login).
export default function Home() {
  redirect("/alerts");
}
