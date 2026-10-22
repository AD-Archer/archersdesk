import { MCP_SCOPE_INFO, MCP_SCOPES } from "./scopes";
import { TOOLS } from "./tools";

// /openapi.json: the REST mirror of the MCP tools (POST /api/v1/<tool>),
// written from the same tool list. OpenAPI 3.1, so the tools' JSON schemas go
// in as they are.

export function openapi(base: string) {
  const error = { type: "object", properties: { error: { type: "string" } }, required: ["error"] };
  return {
    openapi: "3.1.0",
    info: {
      title: "archer's desk",
      version: "1.0.0",
      description:
        "Everything on an archer's desk account: screens and their pages, cards, set times, location, alarms, calendars, world clocks and accounts. " +
        "Each tool is also an MCP tool at /api/mcp (Streamable HTTP). Authenticate with a desk token from settings → MCP; " +
        "its scopes decide which operations it can call and it may be limited to some screens.",
    },
    servers: [{ url: base }],
    security: [{ desk: [] }],
    tags: MCP_SCOPES.map((s) => ({ name: s, description: MCP_SCOPE_INFO[s].blurb })),
    paths: Object.fromEntries(
      TOOLS.map((t) => [
        `/api/v1/${t.name}`,
        {
          post: {
            operationId: t.name,
            summary: t.title,
            description: `${t.description}\n\nNeeds the \`${t.scope}\` scope.`,
            tags: [t.scope],
            requestBody: { required: true, content: { "application/json": { schema: t.input } } },
            responses: {
              "200": {
                description: "Done. `result` is what the matching MCP tool returns.",
                content: { "application/json": { schema: { type: "object", properties: { result: {} }, required: ["result"] } } },
              },
              "400": { description: "Something about the request needs fixing; `error` says what.", content: { "application/json": { schema: error } } },
              "401": { description: "No token, or one that's been revoked.", content: { "application/json": { schema: error } } },
              "403": {
                description: "The token doesn't have this scope, or the screen is outside the ones it's limited to.",
                content: { "application/json": { schema: error } },
              },
            },
          },
        },
      ])
    ),
    components: {
      securitySchemes: {
        desk: { type: "http", scheme: "bearer", description: "A desk token (desk_…) from settings → MCP." },
      },
    },
  };
}
