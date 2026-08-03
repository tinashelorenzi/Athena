import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";

// Athena has no marketing landing — route to the right place based on auth:
// signed-in users go to their role's home, everyone else to /login.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
