# Model Context Protocol (MCP) Specification

**Version:** 2024-11-05 (Current)
**Source:** [https://spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io)
**Official GitHub:** [https://github.com/modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)

## Overview

The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. It provides a standardized way for applications to:

- Share contextual information with language models
- Expose tools and capabilities to AI systems
- Build composable integrations and workflows

## Protocol Architecture

### Components

**Hosts:** LLM applications that initiate connections
**Clients:** Connectors within the host application
**Servers:** Services that provide context and capabilities

### Base Protocol

- **Message Format:** JSON-RPC 2.0
- **Transport:** Stateful connections (stdio, SSE, etc.)
- **Capability Negotiation:** Server and client exchange capabilities during initialization

### Key Features

**Server-Side Features:**
- **Resources:** Context and data for the AI model to use
- **Prompts:** Templated messages and workflows for users
- **Tools:** Functions for the AI model to execute

**Client-Side Features:**
- **Sampling:** Server-initiated agentic behaviors and recursive LLM interactions

**Additional Utilities:**
- Configuration
- Progress tracking
- Cancellation
- Error reporting
- Logging

## Protocol Messages

### Message Format

All messages use JSON-RPC 2.0 format:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { }
}
```

### Lifecycle

1. **Initialize** - Client and server negotiate capabilities
2. **Operational** - Exchange of resources, prompts, tools
3. **Shutdown** - Graceful connection termination

### Initialization Flow

**Client sends:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { },
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

**Server responds:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { },
      "resources": { },
      "prompts": { }
    },
    "serverInfo": {
      "name": "server-name",
      "version": "1.0.0"
    }
  }
}
```

**Client sends initialized notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

## Server Features

### Resources

**List Resources:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list"
}
```

**Read Resource:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "file:///path/to/resource"
  }
}
```

### Prompts

**List Prompts:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "prompts/list"
}
```

**Get Prompt:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "prompts/get",
  "params": {
    "name": "prompt_name",
    "arguments": { }
  }
}
```

### Tools

**List Tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/list"
}
```

**Call Tool:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1"
    }
  }
}
```

**Tool Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Result text"
      }
    ]
  }
}
```

**Tool Error (isError flag):**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution failed"
      }
    ],
    "isError": true
  }
}
```

### Utilities

**Complete:** Provide autocomplete/inline suggestions
**Logging:** Structured logging from server to client
**Pagination:** Handle large result sets

## Client Features

### Roots

Define workspace roots/directories for the server to operate on.

### Sampling

Allow servers to request LLM sampling from clients (recursive AI interactions).

## Transports

### Stdio Transport

Standard input/output for local communication:
- Messages delimited by newlines or Content-Length headers
- Bidirectional communication
- Most common for local MCP servers

### SSE (Server-Sent Events)

HTTP-based transport for remote servers:
- Client connects via HTTP
- Server sends events via SSE
- Suitable for cloud/web scenarios

## Error Handling

### JSON-RPC Errors

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { }
  }
}
```

### Standard Error Codes

- `-32700`: Parse error
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

## Utility Features

### Progress Token

Long-running operations can include `progress` token in responses:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "progress": 0.5,
    "total": 100
  }
}
```

### Cancellation

Requests can be cancelled via `notifications/cancelled`:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 1,
    "reason": "User cancelled"
  }
}
```

## Security and Trust & Safety

### Key Principles

1. **User Consent and Control**
   - Users must explicitly consent to all data access and operations
   - Implement clear UIs for reviewing and authorizing activities

2. **Data Privacy**
   - Obtain explicit consent before exposing user data
   - Protect user data with appropriate access controls
   - Do not transmit resource data elsewhere without consent

3. **Tool Safety**
   - Tools represent arbitrary code execution
   - Treat with appropriate caution
   - Obtain user consent before invoking tools
   - Users should understand what each tool does

4. **LLM Sampling Controls**
   - Users must explicitly approve LLM sampling requests
   - Users control: whether sampling occurs, prompts sent, results visible
   - Limit server visibility into prompts

### Implementation Guidelines

Implementors SHOULD:
1. Build robust consent and authorization flows
2. Provide clear security documentation
3. Implement appropriate access controls
4. Follow security best practices
5. Consider privacy implications in design

## Versioning

**Current Version:** `2024-11-05`

Protocol versioning follows date-based versioning (CalVer). Servers and clients MUST:
- Declare their protocol version in initialize
- Negotiate the highest mutually supported version
- Handle version mismatches gracefully

## References

- [Official Specification](https://spec.modelcontextprotocol.io)
- [GitHub Repository](https://github.com/modelcontextprotocol/specification)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [Anthropic Announcement](https://www.anthropic.com/news/modelcontext-protocol)

## Research Sources

- [Specification (Nov 5, 2024)](https://modelcontextprotocol.io/specification/2024-11-05)
- [Wikipedia: Model Context Protocol](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [GitHub: modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)
- [MCP Introduction](https://stytch.com/blog/model-context-protocol-introduction/)
