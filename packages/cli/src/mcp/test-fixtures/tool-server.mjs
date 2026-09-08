import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new McpServer({ name: 'tool-policy-fixture', version: '1.0.0' })
for (const name of ['disabled', 'enabled', 'configured', 'unspecified']) {
  server.registerTool(name, { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: name }] }))
}
await server.connect(new StdioServerTransport())
