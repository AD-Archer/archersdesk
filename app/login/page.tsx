import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export default async function LoginPage() {
  const jar = await cookies();
  if (getSessionUser(jar.get(SESSION_COOKIE)?.value)) redirect("/");
  return (
    <main className="login-stage">
      <div className="login-card">
        <p className="login-eyebrow">welcome to</p>
        <h1 className="login-title">
          archer&rsquo;s <em>desk</em>
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
