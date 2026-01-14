# Polka Codes Core

[![npm version](https://img.shields.io/npm/v/@polka-codes/core.svg)](https://www.npmjs.com/package/@polka-codes/core)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/core.svg)](https://www.npmjs.com/package/@polka-codes/core)
[![License](https://img.shields.io/npm/l/@polka-codes/core.svg)](https://github.com/polkacodes/polkacodes/blob/main/LICENSE)

Core AI services and agent implementations for Polka Codes framework.

## Features

- Multiple AI provider support (Anthropic, DeepSeek, GoogleVertex, Ollama, OpenAI, and OpenRouter)
- Extensible agent architecture
- Tool integration system with safety enhancements
- Type-safe API
- Logging and monitoring
- File operation safety (read-first enforcement, line numbers, partial reading)

## Installation

```bash
bun add @polka-codes/core
```

## Usage

The core of `@polka-codes/core` is the `agentWorkflow`. You can use it to create a workflow that interacts with an AI model.

```typescript
import {
  agentWorkflow,
  createContext,
  makeStepFn,
  type ToolResponse,
} from '@polka-codes/core';
import { z } from 'zod';

// Define a tool
const getCurrentWeather = {
  name: 'getCurrentWeather',
  description: 'Get the current weather in a given location',
  parameters: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  }),
};

async function main() {
  // Create a context for the workflow
  const context = createContext({
    // Implement the tool
    invokeTool: async ({ toolName, input }) => {
      if (toolName === 'getCurrentWeather') {
        const { location } = input as z.infer<typeof getCurrentWeather.parameters>;
        // In a real app, you would call a weather API here
        const weather = `The weather in ${location} is 70°F and sunny.`;
        const response: ToolResponse = { success: true, message: { type: 'text', value: weather } };
        return response;
      }
      const response: ToolResponse = { success: false, message: { type: 'error-text', value: 'Tool not found' } };
      return response;
    },
    // A simple text generation function
    generateText: async ({ messages }) => {
        // In a real app, you would call an AI provider here (e.g. Anthropic, OpenAI)
        console.log('--- Assistant Turn ---');
        console.log(messages);
        // This is a mock response for demonstration purposes
        return [{
          role: 'assistant',
          content: [{
            type: 'tool-call',
            toolName: 'getCurrentWeather',
            toolCallId: '123',
            input: { location: 'San Francisco, CA' }
          }]
        }];
    },
    taskEvent: async (event) => {
      console.log('Task Event:', event.kind);
    }
  }, makeStepFn());

  // Run the agent workflow
  const result = await agentWorkflow(
    {
      tools: [getCurrentWeather],
      systemPrompt: "You are a helpful assistant.",
      userMessage: [{ role: 'user', content: "What's the weather in San Francisco, CA?" }],
    },
    context
  );

  console.log('--- Workflow Result ---');
  console.log(result);
}

main();
```

## Development

### Building

```bash
cd packages/core
bun run build
```

### Testing

```bash
bun test
```

## File Operation Safety

The core package includes built-in safety features for file operations to prevent accidental data loss and improve developer experience.

### Read-First Enforcement

File modification tools (`writeToFile` and `replaceInFile`) enforce a "read-first" policy. Before you can modify an existing file, you must read it first using `readFile`. This prevents accidental overwrites and ensures you understand the current file state before making changes.

**Example:**

```typescript
import { readFile, writeToFile, replaceInFile, createFileReadTracker } from '@polka-codes/core';

// Create a read tracker for your session
const readSet = createFileReadTracker();
const toolContext = { readSet };

// 1. Read the file first (required for existing files)
await readFile.handler(provider, { path: 'src/config.js' }, toolContext);

// 2. Now you can write to it
await writeToFile.handler(
  provider,
  { path: 'src/config.js', content: 'new content' },
  toolContext
);

// 3. Or use replaceInFile for targeted edits
await replaceInFile.handler(
  provider,
  {
    path: 'src/config.js',
    diff: `<<<<<<< SEARCH
old value
=======
new value
>>>>>>> REPLACE`
  },
  toolContext
);
```

**Note:** New files can still be created without reading first. The read-first requirement only applies to existing files.

### Line Numbers

All file reads include line numbers for easy reference:

```
     1→import React from 'react';
     2→
     3→function App() {
     4→  return <div>Hello</div>;
     5→}
```

### Partial File Reading

You can read specific sections of a file using `offset` and `limit` parameters:

```typescript
// Read lines 100-150 of a large file
await readFile.handler(provider, {
  path: 'large-file.ts',
  offset: 100,  // Skip first 100 lines
  limit: 50     // Read 50 lines
});
```

### Tool Context

The `ToolContext` type allows you to pass session-level state to tool handlers:

```typescript
import type { ToolContext } from '@polka-codes/core';

interface ToolContext {
  readSet?: Set<string>;           // Track which files have been read
  metadata?: Record<string, unknown>; // Additional session data
}

// Create context for your workflow
const context: ToolContext = {
  readSet: createFileReadTracker(),
  metadata: {
    sessionId: 'my-session',
    startTime: Date.now()
  }
};
```

### Backward Compatibility

All safety features are **backward compatible**:

- The `context` parameter in tool handlers is optional
- Existing code without read tracking continues to work
- Tools without context behave as before (no read-first enforcement)

### File Read Tracker API

```typescript
import {
  createFileReadTracker,  // Create a new tracking Set
  markAsRead,             // Mark a file as read
  hasBeenRead,            // Check if a file has been read
  getReadFiles,           // Get all read file paths
  getReadCount            // Get count of read files
} from '@polka-codes/core';

const readSet = createFileReadTracker();
markAsRead(readSet, 'src/app.ts');
console.log(hasBeenRead(readSet, 'src/app.ts')); // true
console.log(getReadCount(readSet)); // 1
```

---

*This README was generated by polka.codes*
