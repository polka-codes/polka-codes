# MCP Server Implementation

This directory contains the MCP (Model Context Protocol) server implementation for polka-codes, allowing it to expose its tools and resources to other MCP-compatible clients.

## Overview

The MCP server enables polka-codes to act as a tool provider for other AI applications. Clients can connect to the polka-codes MCP server and use its tools (execute commands, read/write files, search files, etc.) through the standardized MCP protocol.

**This implementation uses the official [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** (v1.25.1) for robust, standards-compliant MCP protocol handling.

## Architecture

### Core Components

1. **`sdk-server.ts`** - SDK-based MCP server
   - Uses official `@modelcontextprotocol/sdk` for server implementation
   - `createPolkaCodesMcpServer()`: Factory function to create MCP server
   - `startStdioServer()`: Start server with stdio transport
   - Handles tool registration and error handling

2. **`types.ts`** - Type definitions
   - `McpServerTool`: Tool definition for server
   - `McpServerResource`: Resource definition for server
   - `McpServerConfig`: Server configuration

3. **`tools.ts`** - Tool adapters
   - `createPolkaCodesServerTools()`: Predefined polka-codes tools
   - `createMcpServerTools()`: Convert polka tools to MCP tools

4. **`commands/mcp-server.ts`** - CLI command
   - Start polka-codes as MCP server
   - Tool registration
   - Graceful shutdown handling

5. **`sdk-client.ts`** - SDK-based MCP client (for consuming other MCP servers)
   - Wraps official SDK Client
   - Implements `IMcpClient` interface
   - Used by `McpManager` to connect to external MCP servers

## Usage

### Starting the MCP Server

```bash
polka mcp-server
```

With verbose logging:
```bash
polka mcp-server --verbose
```

### Configuration Example

To use polka-codes MCP server from another MCP client, configure it in the client's config:

```yaml
mcpServers:
  polka-codes:
    command: "polka"
    args: ["mcp-server"]
    tools:
      code: true
      review: true
      plan: true
      fix: true
      epic: true
      commit: true
```

## Available Tools

The MCP server exposes high-level polka-codes workflows:

1. **code**
   - Execute a coding task using AI
   - Input: `{ task: string, files?: string[] }`
   - Description: Analyzes codebase, makes changes, ensures tests pass

2. **review**
   - Review code changes (local, branch, or PR)
   - Input: `{ pr?: number, files?: string[], context?: string }`
   - Description: Reviews code changes with AI analysis

3. **plan**
   - Create a plan for implementing a feature
   - Input: `{ task: string }`
   - Description: Breaks down task into implementation steps

4. **fix**
   - Fix issues, bugs, or test failures
   - Input: `{ task: string }`
   - Description: Diagnoses and fixes issues automatically

5. **epic**
   - Break down and implement large features
   - Input: `{ epic: string }`
   - Description: Splits epic into tasks and implements them

6. **commit**
   - Create a git commit with AI-generated message
   - Input: `{ message?: string }`
   - Description: Stages changes and creates commit

## Protocol Implementation

### Supported Methods

✅ **initialize** - Initialize MCP session
✅ **tools/list** - List available tools
✅ **tools/call** - Execute a tool
✅ **resources/list** - List available resources (placeholder)
✅ **resources/read** - Read a resource (placeholder)
✅ **prompts/list** - List prompts (placeholder)

### Notifications

- **notifications/initialized** - Client has completed initialization
- **notifications/cancelled** - Request cancelled by client

## Implementation Status

✅ **Core Server (Official SDK)**
- Uses `@modelcontextprotocol/sdk` v1.25.1
- Stdio transport via `StdioServerTransport`
- JSON-RPC message handling
- Tool registration and execution
- Error handling with proper `isError` flag
- Protocol compliance (MCP 2024-11-05)

✅ **Client (Official SDK)**
- Uses SDK Client for connecting to external MCP servers
- Stdio transport via `StdioClientTransport`
- Tool calling and resource reading
- Connection management
- Error handling

✅ **CLI Command**
- Server startup and shutdown
- Graceful signal handling (SIGINT, SIGTERM)
- Logging to stderr (stdout reserved for protocol)
- Usage information on startup

✅ **Tool Adapters**
- High-level workflow tools (code, review, plan, fix, epic, commit)
- Tool schema definitions
- Mock implementations (ready for workflow integration)

✅ **Testing**
- 20 SDK server tests (all passing)
- 52 MCP client/manager tests (all passing)
- Comprehensive test coverage

⏳ **Future Enhancements**
- Full workflow execution integration
- Resource protocol implementation
- Prompt protocol support
- SSE/Streamable HTTP transport
- Authentication/authorization
- Progress token support
- Sampling (server-initiated LLM calls)

## Integration with Polka-Codes Tools

Currently, the MCP server uses mock implementations for tools. To integrate with actual polka-codes tools:

1. Import the tool implementations from `../tool-implementations.ts`
2. Wrap them with MCP-compatible handlers
3. Handle tool execution context properly
4. Return formatted results

Example integration:
```typescript
import { executeCommand as pcExecuteCommand } from '../tool-implementations'

export function createIntegratedTools(): McpServerTool[] {
  return [{
    name: 'execute_command',
    description: 'Execute a shell command',
    inputSchema: { /* ... */ },
    handler: async (args) => {
      // Call actual polka-codes tool
      const result = await pcExecuteCommand(args, context)
      return formatResult(result)
    }
  }]
}
```

## Testing

Run MCP server tests:
```bash
bun test packages/cli/src/mcp-server/sdk-server.test.ts
```

Run all MCP-related tests:
```bash
bun test packages/cli/src/mcp-server/
bun test packages/cli/src/mcp/
```

Current tests (72 tests, all passing):
- SDK server initialization (4 tests)
- Tool registration (5 tests)
- Tool handler behavior (4 tests)
- Edge cases (4 tests)
- Polka-codes tools (2 tests)
- Error handling (2 tests)
- Logger integration (3 tests)
- MCP client/manager tests (52 tests)

## Security Considerations

1. **Authentication**: Currently, the MCP server has no authentication. Any client that can start the process can invoke tools.

2. **Authorization**: All registered tools are available to all clients. Consider implementing tool-level access control.

3. **Input Validation**: The server should validate all tool inputs before execution.

4. **Sandboxing**: Tools like `execute_command` can run arbitrary commands. Consider implementing restrictions.

5. **Resource Limits**: No rate limiting or resource usage limits are currently enforced.

## Example Client Usage

### Using with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Start polka-codes MCP server in one terminal
polka mcp-server

# Connect with Inspector in another terminal
mcp-inspector stdio polka mcp-server
```

### Configuration for Claude Desktop

Add to Claude Desktop's MCP server config:

```json
{
  "mcpServers": {
    "polka-codes": {
      "command": "polka",
      "args": ["mcp-server"]
    }
  }
}
```

### Configuration for Continue.dev

Add to Continue config:

```json
{
  "experimental": {
    "mcpServers": [
      {
        "name": "polka-codes",
        "command": "polka",
        "args": ["mcp-server"]
      }
    ]
  }
}
```

## Troubleshooting

### Server doesn't start
- Check that polka CLI is properly installed
- Verify dependencies are installed: `bun install`
- Enable verbose logging: `polka mcp-server --verbose`

### Tools not available
- Verify tools are registered before server starts
- Check server logs for registration errors
- Test with MCP Inspector to see available tools

### Connection issues
- Ensure client can start the polka process
- Check PATH for polka command
- Verify stdio communication is working

## Contributing

To add new tools to the MCP server:

1. Define the tool in `tools.ts`
2. Add input schema following JSON Schema
3. Implement the handler function
4. Register in CLI command

```typescript
{
  name: 'new_tool',
  description: 'Tool description',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter 1' }
    },
    required: ['param1']
  },
  handler: async (args) => {
    // Implementation
    return result
  }
}
```

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [polka-codes Documentation](https://github.com/your-org/polka-codes)

## Migration Notes

**Migrated from custom implementation to official SDK on 2025-01-06**

Previous custom implementation:
- ~2,000 lines of custom server code
- Custom stdio transport
- Manual JSON-RPC handling
- 45 tests

Current SDK implementation:
- ~100 lines using official SDK
- Official `StdioServerTransport`
- SDK handles all protocol details
- 20 SDK tests + 52 client/manager tests
- Full MCP 2024-11-05 compliance
- Access to advanced features (sampling, tasks, progress tokens, etc.)

See `plans/mcp-sdk-refactor-plan.md` for complete migration details.
