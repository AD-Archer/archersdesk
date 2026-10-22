// Refresh site/openapi.json (the docs site's tool reference) from a running
// desk: `pnpm docs:openapi`, or `pnpm docs:openapi http://host:port`. The
// desk's own address is swapped for a placeholder.
import fs from "node:fs";

const from = process.argv[2] || "http://localhost:3000";
const res = await fetch(`${from}/openapi.json`);
if (!res.ok) throw new Error(`${from}/openapi.json answered ${res.status}; is the desk running?`);
const spec = await res.json();
spec.servers = [{ url: "https://your-desk.example.com", description: "your desk" }];
fs.writeFileSync(new URL("../site/openapi.json", import.meta.url), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`site/openapi.json: ${Object.keys(spec.paths).length} tools`);
