import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export default async function Home() {
  const jar = await cookies();
  const user = getSessionUser(jar.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return <Dashboard username={user.username} />;
}
