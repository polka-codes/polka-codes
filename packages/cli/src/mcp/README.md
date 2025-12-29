# MCP (Model Context Protocol) Integration

This directory contains the implementation of MCP (Model Context Protocol) support for polka-codes, enabling the CLI to connect to external MCP servers and use their tools/resources in AI workflows.

## Architecture

### Core Components

1. **`types.ts`** - Type definitions for MCP protocol
   - `McpTool`: Tool definition from an MCP server
   - `McpResource`: Resource definition from an MCP server
   - `McpServerConfig`: Configuration for MCP servers
   - `IMcpClient`: Interface for MCP client implementations

2. **`transport.ts`** - Transport layer for MCP communication
   - `StdioTransport`: Handles stdio-based communication with local MCP servers
   - JSON-RPC message format implementation
   - Process management and message parsing

3. **`client.ts`** - MCP client implementation
   - `McpClient`: Main client class for connecting to MCP servers
   - Tool listing and execution
   - Resource reading
   - Error handling and connection management

4. **`manager.ts`** - MCP server manager
   - `McpManager`: Manages multiple MCP server connections
   - Tool registration and routing
   - Connection lifecycle management

5. **`tools.ts`** - AI SDK integration
   - `createMcpTools()`: Converts MCP tools to AI SDK ToolSet format
   - Tool name mapping and execution

6. **`errors.ts`** - MCP-specific error classes
   - `McpConnectionError`: Server connection failures
   - `McpTimeoutError`: Request timeouts
   - `McpProtocolError`: Protocol violations
   - `McpToolError`: Tool execution failures

## Configuration

MCP servers are configured in `~/.config/polkacodes/config.yml` or `.polkacodes.yml`:

```yaml
mcpServers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    tools:
      read_file: true
      write_file: true
      create_directory: false

  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    tools:
      create_issue: true
      create_pull_request: true
```

## Usage

### Automatic Tool Registration

When MCP servers are configured, polka-codes automatically:
1. Connects to all configured servers at workflow startup
2. Lists available tools from each server
3. Registers tools with the format `<server-name>/<tool-name>`
4. Makes tools available to AI agents during workflow execution

### Tool Calling

MCP tools are called automatically by the AI agent when needed. The tool naming convention is:
- `<server-name>/<tool-name>` (e.g., `filesystem/read_file`)

### Tool-Level Configuration

Individual tools can be enabled/disabled:
```yaml
mcpServers:
  myserver:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-example"]
    tools:
      specific_tool: true          # enabled
      another_tool: false         # disabled
      custom_tool:                # enabled with custom model
        provider: anthropic
        model: claude-3-5-sonnet-20241022
```

## Error Handling

MCP integration includes comprehensive error handling:
- Connection failures are logged but don't prevent other servers from connecting
- Tool execution errors are reported to the user with actionable messages
- Timeouts and retries are handled appropriately
- All MCP errors extend the base `McpError` class

## Security Considerations

1. **Path Restrictions**: Filesystem MCP servers should be restricted to allowed paths
2. **Authentication**: Support for API keys and tokens via environment variables
3. **Sandboxing**: MCP servers run as separate processes with limited permissions
4. **Tool-Level Control**: Enable/disable specific tools per server

## Implementation Status

✅ Core MCP client (stdio transport)
✅ Configuration schema
✅ Tool registration and execution
✅ Error handling
✅ Connection management
✅ Integration with workflow execution
⏳ SSE transport (future)
⏳ Resource protocol support (future)
⏳ Prompts protocol support (future)

## Example MCP Servers

Official MCP servers from the community:
- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-brave-search` - Web search
- And many more at https://github.com/modelcontextprotocol

## Testing

Run MCP-specific tests:
```bash
bun test packages/cli/src/mcp/manager.test.ts
```

## Future Enhancements

1. **SSE Transport**: Support for remote MCP servers via Server-Sent Events
2. **Resource Protocol**: Full support for MCP resource reading
3. **Prompts Protocol**: Support for prompt templates from MCP servers
4. **Dynamic Tool Discovery**: Automatic discovery and registration of MCP tools
5. **Tool Caching**: Cache tool definitions for faster startup
6. **Connection Pooling**: Reuse connections across workflows
