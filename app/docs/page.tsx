import type { Metadata } from "next";
import { headers } from "next/headers";
import { MCP_SCOPE_INFO, MCP_SCOPES } from "@/lib/mcp/scopes";
import { TOOLS, type ToolDef } from "@/lib/mcp/tools";
import "../styles/docs.css";

// /docs: how to hand this desk to an assistant over MCP, and every tool it
// gets. Written from lib/mcp/tools.ts, so it's never out of date. Public: it
// explains the api; a token is what opens it.

export const metadata: Metadata = { title: "MCP docs · archer's desk" };

type Prop = { type?: string | string[]; enum?: string[]; description?: string; items?: Prop; properties?: Record<string, Prop> };

function typeOf(p: Prop): string {
  if (p.enum) return p.enum.length > 8 ? "widget name" : p.enum.map((e) => `"${e}"`).join(" | ");
  if (p.type === "array") return p.items?.enum ? `(${typeOf(p.items)})[]` : `${p.items ? typeOf(p.items) : "any"}[]`;
  if (p.type === "object" && p.properties) return `{ ${Object.keys(p.properties).join(", ")} }`;
  return Array.isArray(p.type) ? p.type.join(" | ") : (p.type ?? "any");
}

function Tool({ t }: { t: ToolDef }) {
  const props = Object.entries(t.input.properties) as [string, Prop][];
  const required = new Set(t.input.required ?? []);
  return (
    <article className="doc-tool" id={t.name}>
      <h3>
        <a href={`#${t.name}`}>
          <code>{t.name}</code>
        </a>
        {t.annotations.readOnlyHint ? <span className="doc-tag">read only</span> : null}
        {t.annotations.destructiveHint ? <span className="doc-tag red">removes</span> : null}
      </h3>
      <p>{t.description}</p>
      {props.length > 0 && (
        <table>
          <tbody>
            {props.map(([name, p]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                  {required.has(name) && <span className="doc-req">required</span>}
                </td>
                <td>
                  <span className="doc-type">{typeOf(p)}</span>
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

export default async function DocsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-desk";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const url = `${origin}/api/mcp`;

  return (
    <main className="doc">
      <header className="doc-head">
        <p className="doc-kicker">archer&rsquo;s desk</p>
        <h1>Run your desk from an assistant</h1>
        <p className="doc-lead">
          The desk is an MCP server. Give Claude, ChatGPT, Cursor or anything else that speaks MCP a token, and it can
          make pages, move cards, schedule when a screen turns to a page, set alarms, calendars, world clocks and
          location, and fill in accounts. Screens pick changes up within a few seconds.
        </p>
      </header>

      <nav className="doc-nav" aria-label="On this page">
        <a href="#connect">Connect</a>
        <a href="#scopes">Scopes and screens</a>
        <a href="#words">How the desk is shaped</a>
        <a href="#tools">Tools</a>
        <a href="#rest">REST and OpenAPI</a>
      </nav>

      <section id="connect">
        <h2>Connect</h2>
        <ol>
          <li>
            On the desk, open <b>Settings → MCP</b>, name a token, pick what it can do and (if you like) which screens it
            can touch, then <b>Make a token</b>. It&rsquo;s shown once.
          </li>
          <li>Give your assistant the server address and the token.</li>
        </ol>
        <p>
          Server: <code>{url}</code> (Streamable HTTP). Every account uses this address; the token decides whose desk it
          is.
        </p>
        <h3>Claude Code</h3>
        <pre>{`claude mcp add --transport http archers-desk ${url} \\\n  --header "Authorization: Bearer desk_…"`}</pre>
        <h3>Claude Desktop, Cursor and other clients with a config file</h3>
        <pre>
          {JSON.stringify(
            { mcpServers: { "archers-desk": { type: "http", url, headers: { Authorization: "Bearer desk_…" } } } },
            null,
            2
          )}
        </pre>
        <h3>Claude.ai and ChatGPT</h3>
        <p>
          Add a custom connector with the server address above and the token as a bearer <code>Authorization</code>{" "}
          header. They reach the desk from the internet, so it needs a public https address (a reverse proxy or a
          tunnel); a desk that only lives on your home network works with the local clients above.
        </p>
      </section>

      <section id="scopes">
        <h2>Scopes and screens</h2>
        <p>
          A token only gets the tools its scopes allow; the rest don&rsquo;t appear. Keys, tokens and passwords for
          accounts can be written but are never read back.
        </p>
        <table>
          <tbody>
            {MCP_SCOPES.map((s) => (
              <tr key={s}>
                <td>
                  <code>{s}</code>
                </td>
                <td>{MCP_SCOPE_INFO[s].blurb}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          A token can also be kept to some screens. It then sees and changes only those screens; it sees alarms that ring
          on them and changes only alarms that ring on nothing else; and it can&rsquo;t make new screens. Calendars, world
          clocks, units and accounts belong to the whole account and follow the scopes alone.
        </p>
        <p>Take a token back in Settings → MCP; it stops working on its next request.</p>
      </section>

      <section id="words">
        <h2>How the desk is shaped</h2>
        <dl>
          <dt>Screen</dt>
          <dd>A display the desk runs on: an Echo Show, a tablet, a spare monitor. Each has its own pages and location.</dd>
          <dt>Page</dt>
          <dd>
            Screens swipe sideways through Standby (a big clock), then their pages, then the Pad if a Mac pad is set up.
            Pages are numbered from 1 and can have names (&ldquo;Phantom&rdquo;); tools take either.
          </dd>
          <dt>Row and card</dt>
          <dd>
            A page is rows, swiped up and down. A row is two square cards (<code>{"{left, right}"}</code>) or one wide card
            (<code>{"{wide}"}</code>). Each card shows a widget; <code>list_widgets</code> has them all.
          </dd>
          <dt>Set time</dt>
          <dd>
            A screen turning to a page at a time: every day, some days, or once on a date. With a length, it goes back to
            what it was showing afterwards, unless someone touched it.
          </dd>
          <dt>Idle return</dt>
          <dd>After someone turns the page and walks away, the screen goes back to a page once it&rsquo;s been untouched for a while.</dd>
        </dl>
      </section>

      <section id="tools">
        <h2>Tools</h2>
        {MCP_SCOPES.map((s) => (
          <div key={s} className="doc-scope">
            <h2 className="doc-scope-head">
              {MCP_SCOPE_INFO[s].label} <code>{s}</code>
            </h2>
            {TOOLS.filter((t) => t.scope === s).map((t) => (
              <Tool key={t.name} t={t} />
            ))}
          </div>
        ))}
      </section>

      <section id="rest">
        <h2>REST and OpenAPI</h2>
        <p>
          Every tool is also <code>POST {origin}/api/v1/&lt;tool&gt;</code>, with the arguments as the json body and the
          same token. The answer is <code>{"{ result }"}</code>, or <code>{"{ error }"}</code> with a 400 (fix the
          request), 401 (no token) or 403 (not in its scopes or screens).
        </p>
        <pre>{`curl -X POST ${origin}/api/v1/add_set_time \\\n  -H "Authorization: Bearer desk_…" -H "content-type: application/json" \\\n  -d '{"screen": "main", "at": "16:15", "show": "Phantom", "days": ["tue"], "stay_minutes": 60}'`}</pre>
        <p>
          The whole api as OpenAPI 3.1: <a href="/openapi.json">/openapi.json</a>.
        </p>
      </section>
    </main>
  );
}
