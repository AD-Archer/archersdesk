import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LanderClock from "@/components/LanderClock";
import LoginForm from "@/components/LoginForm";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";

// The lander: what a signed-out screen shows. The live StandBy clock is the
// hero (the desk itself, not a picture of it); the sign-in sits beside it in
// landscape, under it like a lock screen in portrait.

export default async function LoginPage() {
  const jar = await cookies();
  if (getSessionUser(jar.get(SESSION_COOKIE)?.value)) redirect("/");
  return (
    <main className="lander">
      <LanderClock />
      <section className="lander-door" aria-labelledby="lander-name">
        <h1 className="lander-name" id="lander-name">
          archer&rsquo;s desk
        </h1>
        <LoginForm canRegister={!env.disableRegistration} />
      </section>
    </main>
  );
}
