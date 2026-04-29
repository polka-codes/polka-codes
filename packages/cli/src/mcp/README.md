# MCP (Model Context Protocol) Integration

This directory contains the implementation of MCP support for Polka Codes. The CLI can connect to external MCP servers, register their tools, and expose selected Polka workflows through `polka mcp-server`.

For user-facing CLI usage, configuration examples, and command syntax, see the [CLI README](../../README.md#mcp-server). This document focuses on implementation details for contributors.

## Architecture

### Core Components

1. **`types.ts`** - Type definitions for MCP protocol data.
   - `McpTool`: tool definition from an MCP server.
   - `McpResource`: resource definition from an MCP server.
   - `McpServerConfig`: configuration for MCP servers.
   - `IMcpClient`: interface for MCP client implementations.

2. **`transport.ts`** - Transport layer for MCP communication.
   - `StdioTransport`: stdio-based communication with local MCP servers.
   - JSON-RPC message format implementation.
   - Process management and message parsing.

3. **`client.ts`** - MCP client implementation.
   - `McpClient`: main client class for connecting to MCP servers.
   - Tool listing and execution.
   - Resource reading.
   - Error handling and connection management.

4. **`manager.ts`** - MCP server manager.
   - `McpManager`: manages multiple MCP server connections.
   - Tool registration and routing.
   - Connection lifecycle management.

5. **`tools.ts`** - AI SDK integration.
   - `createMcpTools()`: converts MCP tools to AI SDK `ToolSet` format.
   - Tool name mapping and execution.

6. **`errors.ts`** - MCP-specific error classes.
   - `McpConnectionError`: server connection failures.
   - `McpTimeoutError`: request timeouts.
   - `McpProtocolError`: protocol violations.
   - `McpToolError`: tool execution failures.

## Configuration Source of Truth

MCP servers are configured in `~/.config/polkacodes/config.yml` or `.polkacodes.yml` under `mcpServers`. The canonical user-facing example lives in the [CLI configuration reference](../../README.md#configuration). Keep that file as the command and config reference so examples do not drift across documents.

At runtime, configured MCP servers are loaded during workflow startup. Their tools are registered with the name format `<server-name>/<tool-name>`, for example `filesystem/read_file`.

## Server Mode

The `polka mcp-server` command starts Polka Codes as an MCP server for clients such as Claude Code. It exposes high-level workflows as tools, including `code`, `review`, `plan`, `fix`, and `commit`.

```bash
polka mcp-server
```

See the [CLI README](../../README.md#mcp-server) for Claude Code setup examples.

## Error Handling

MCP integration includes targeted error handling:

- Connection failures are logged without preventing other configured servers from connecting.
- Tool execution errors are reported with actionable messages.
- Timeouts and retries are handled by the MCP client layer.
- MCP-specific errors extend the base `McpError` class.

## Security Considerations

1. **Path restrictions**: filesystem MCP servers should be restricted to allowed paths.
2. **Authentication**: API keys and tokens should be passed through environment variables.
3. **Sandboxing**: MCP servers run as separate processes with their own permissions.
4. **Tool-level control**: specific tools can be enabled or disabled per server.

## Implementation Status

- Core MCP client with stdio transport: complete.
- Configuration schema: complete.
- Tool registration and execution: complete.
- Error handling: complete.
- Connection management: complete.
- Integration with workflow execution: complete.
- SSE transport: future.
- Resource protocol support: future.
- Prompts protocol support: future.
- Dynamic tool discovery: future.
- Tool definition caching: future.
- Connection pooling: future.

## Example MCP Servers

Official and community MCP servers include:

- `@modelcontextprotocol/server-filesystem` - file system operations.
- `@modelcontextprotocol/server-github` - GitHub integration.
- `@modelcontextprotocol/server-postgres` - PostgreSQL database access.
- `@modelcontextprotocol/server-brave-search` - web search.

See https://github.com/modelcontextprotocol for more servers.

## Testing

Run MCP-specific tests:

```bash
bun test packages/cli/src/mcp/manager.test.ts
```
