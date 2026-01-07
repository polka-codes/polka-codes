# MCP (Model Context Protocol) Guide

Complete guide to MCP support in polka-codes, including both **MCP Client** (consuming MCP servers) and **MCP Server** (exposing tools via MCP).

## Table of Contents

1. [Overview](#overview)
2. [MCP Client](#mcp-client)
3. [MCP Server](#mcp-server)
4. [Use Cases](#use-cases)
5. [Examples](#examples)

## Overview

polka-codes now has full bidirectional MCP support:

- **MCP Client**: Connect to external MCP servers and use their tools
- **MCP Server**: Expose polka-codes tools to other MCP-compatible applications

## MCP Client

### What is it?

The MCP client allows polka-codes to connect to external MCP servers and use their tools in workflows.

### Configuration

Add MCP servers to `~/.config/polkacodes/config.yml` or `.polkacodes.yml`:

```yaml
mcpServers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/user/projects"]
    tools:
      read_file: true
      write_file: true

  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    tools:
      create_issue: true
      create_pull_request: false
```

### Usage

MCP tools are automatically available to AI agents in all workflows:

```bash
# MCP tools are automatically discovered and used by AI agents
polka code "Read the file at /path/to/file.txt using the filesystem MCP tool"

# Works with all commands
polka plan "Create a plan to add database migrations"
polka fix "Fix the failing test using database tools"
polka task "Query the database and generate a report"
```

**How it works:**
1. MCP tools are automatically discovered when MCP servers are configured
2. Tools are converted to the internal `FullToolInfo` format
3. All workflows (code, plan, fix, task) automatically include MCP tools in their agent tool lists
4. AI agents can discover and use MCP tools just like built-in tools

**Tool Naming:**
MCP tools are named using the pattern `{serverName}/{toolName}`. For example:
- `filesystem/read_file`
- `github/create_issue`
- `postgres/query`

### Available MCP Servers

Official MCP servers from the community:
- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-brave-search` - Web search
- And more at https://github.com/modelcontextprotocol

### Documentation

See [packages/cli/src/mcp/README.md](packages/cli/src/mcp/README.md) for details.

## MCP Server

### What is it?

The MCP server allows polka-codes to expose its tools to other MCP-compatible applications (Claude Desktop, Continue.dev, etc.).

### Starting the Server

```bash
polka mcp-server
```

With verbose logging:
```bash
polka mcp-server --verbose
```

### Configuration in MCP Clients

#### Claude Desktop

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

#### Continue.dev

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

### Available Tools

The MCP server exposes high-level polka-codes workflows:

1. **code** - Execute coding tasks with AI
2. **review** - Review code changes
3. **plan** - Create implementation plans
4. **fix** - Fix bugs and issues
5. **commit** - Create git commits with AI

### Documentation

See [packages/cli/src/mcp-server/README.md](packages/cli/src/mcp-server/README.md) for details.

## Use Cases

### Using MCP Client

#### Scenario: Database Operations

Configure PostgreSQL MCP server:

```yaml
mcpServers:
  postgres:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    tools:
      query: true
```

Use in polka-codes:

```bash
polka code "Query the users table and find all active users"
```

#### Scenario: GitHub Integration

Configure GitHub MCP server:

```yaml
mcpServers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

Use in polka-codes:

```bash
polka code "Create a GitHub issue for the bug in the login form"
```

### Using MCP Server

#### Scenario: Claude Desktop Integration

1. Start polka-codes MCP server: `polka mcp-server`
2. Configure Claude Desktop (see above)
3. Use polka tools in Claude:

   > "Read the package.json file and list the dependencies"

   Claude will use the `read_file` tool from polka-codes MCP server.

#### Scenario: Continue.dev Integration

1. Start polka-codes MCP server: `polka mcp-server`
2. Configure Continue.dev (see above)
3. Use polka tools in Continue:

   > "Search for all TypeScript files in the src directory"

   Continue will use the `search_files` tool from polka-codes MCP server.

## Examples

### Example 1: Bidirectional MCP Flow

```yaml
# ~/.config/polkacodes/config.yml
mcpServers:
  # Consume GitHub MCP server
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    tools:
      create_issue: true
```

```bash
# Terminal 1: Start polka as MCP server
polka mcp-server

# Terminal 2: Use polka with GitHub tools
polka code "Create a GitHub issue for the failing test"

# Terminal 3: Use Claude Desktop with polka tools
# (Claude Desktop connected to polka mcp-server)
# > "Read the test file and explain the failure"
```

### Example 2: Multi-Tool Workflow

```yaml
mcpServers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./project"]
    tools:
      read_file: true
      write_file: true

  database:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    tools:
      query: true
```

```bash
polka code "Read the config.json, update the database URL, and update the users table"
```

### Example 3: MCP Server in Development Workflow

1. **Start polka MCP server**:
   ```bash
   polka mcp-server --verbose
   ```

2. **Configure your AI assistant** (Claude Desktop, Continue.dev, etc.) to use polka MCP server

3. **Use polka tools from your AI assistant**:
   - Execute commands
   - Read/write files
   - Search codebase
   - And more!

## Implementation Status

### MCP Client (Consuming MCP Servers)
✅ Stdio transport
✅ Multiple server connections
✅ Tool registration and execution
✅ Error handling
✅ Configuration support
✅ **Automatic tool discovery and integration with workflows**
✅ **JSON Schema to Zod conversion for tool parameters**
⏳ SSE transport (future)
⏳ Resource protocol (future)

### MCP Server (Exposing Tools)
✅ Stdio transport
✅ Tool registration
✅ Tool execution
✅ CLI command
✅ Graceful shutdown
⏳ Full tool integration (future)
⏳ Resource protocol (future)
⏳ Authentication (future)

## Troubleshooting

### MCP Client Issues

**Problem**: MCP server fails to connect
- Verify server command is correct
- Check server dependencies are installed
- Enable verbose logging: `polka code --verbose "task"`

**Problem**: MCP tools not available
- Check configuration syntax
- Verify tools are enabled in config
- Check server logs for errors

### MCP Server Issues

**Problem**: Server doesn't start
- Verify polka CLI is installed
- Check dependencies: `bun install`
- Enable verbose logging: `polka mcp-server --verbose`

**Problem**: Client can't connect
- Verify polka is in PATH
- Check client configuration
- Test with MCP Inspector

## Testing

### Test MCP Client

```bash
# Run MCP client tests
bun test packages/cli/src/mcp/manager.test.ts
```

### Test MCP Server

```bash
# Run MCP server tests
bun test packages/cli/src/mcp-server/server.test.ts

# Start server
polka mcp-server

# Test with MCP Inspector (another terminal)
mcp-inspector stdio polka mcp-server
```

## Contributing

### Adding New MCP Client Tools

1. Configure the MCP server in config.yml
2. Tools are automatically discovered and registered
3. Use them in workflows

### Adding New MCP Server Tools

1. Define tool in `packages/cli/src/mcp-server/tools.ts`
2. Add input schema
3. Implement handler
4. Register in server

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

## Support

For issues or questions:
- Check documentation in `packages/cli/src/mcp/`
- Check documentation in `packages/cli/src/mcp-server/`
- Open an issue on GitHub

## Summary

polka-codes now has **full bidirectional MCP support** with complete workflow integration:

✅ **Consume** MCP servers to extend capabilities
✅ **Expose** tools via MCP for other applications
✅ **Integrate** MCP tools with all workflows (code, plan, fix, task)
✅ **Automatic** tool discovery and conversion
✅ **Seamless** AI agent access to MCP tools
✅ **Flexibility** to use tools from any source

This opens up a world of possibilities for integrating polka-codes with AI applications and services!
