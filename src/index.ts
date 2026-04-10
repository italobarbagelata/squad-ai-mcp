import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureAuth } from "./api-client.js";
import { registerSquadTools } from "./tools/squad.js";

const server = new McpServer({
  name: "squad-ai",
  version: "1.0.0",
});

registerSquadTools(server);

async function main(): Promise<void> {
  await ensureAuth();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Squad AI MCP Server error:", err);
  process.exit(1);
});
