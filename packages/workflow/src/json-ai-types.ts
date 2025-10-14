// JSON friendly type for ai-sdk types

import type { JSONValue } from '@ai-sdk/provider'
import type {
  AssistantContent,
  DataContent,
  ModelMessage,
  ProviderOptions,
  ReasoningPart,
  SystemModelMessage,
  TextPart,
  ToolModelMessage,
  ToolResultPart,
  UserContent,
} from '@ai-sdk/provider-utils'

type JsonDataContent = {
  type: 'base64' | 'url'
  value: string
}

interface JsonImagePart {
  type: 'image'
  /**
  Image data. Can either be:

  - data: a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer
  - URL: a URL that points to the image
     */
  image: JsonDataContent
  /**
  Optional IANA media type of the image.

  @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
  mediaType?: string
  /**
  Additional provider-specific metadata. They are passed through
  to the provider from the AI SDK and enable provider-specific
  functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions
}

/**
File content part of a prompt. It contains a file.
 */
interface JsonFilePart {
  type: 'file'
  /**
  File data. Can either be:

  - data: a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer
  - URL: a URL that points to the image
     */
  data: JsonDataContent
  /**
  Optional filename of the file.
     */
  filename?: string
  /**
  IANA media type of the file.

  @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
  mediaType: string
  /**
  Additional provider-specific metadata. They are passed through
  to the provider from the AI SDK and enable provider-specific
  functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions
}

/**
A user message. It can contain text or a combination of text and images.
 */
export type JsonUserModelMessage = {
  role: 'user'
  content: JsonUserContent
  /**
      Additional provider-specific metadata. They are passed through
      to the provider from the AI SDK and enable provider-specific
      functionality that can be fully encapsulated in the provider.
       */
  providerOptions?: ProviderOptions
}

/**
  Content of a user message. It can be a string or an array of text and image parts.
   */
type JsonUserContent = string | Array<TextPart | JsonImagePart | JsonFilePart>

/**
An assistant message. It can contain text, tool calls, or a combination of text and tool calls.
 */
type JsonAssistantModelMessage = {
  role: 'assistant'
  content: JsonAssistantContent
  /**
    Additional provider-specific metadata. They are passed through
    to the provider from the AI SDK and enable provider-specific
    functionality that can be fully encapsulated in the provider.
     */
  providerOptions?: ProviderOptions
}

interface JsonToolCallPart {
  type: 'tool-call'
  /**
  ID of the tool call. This ID is used to match the tool call with the tool result.
   */
  toolCallId: string
  /**
  Name of the tool that is being called.
   */
  toolName: string
  /**
  Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
  input: JSONValue
  /**
  Additional provider-specific metadata. They are passed through
  to the provider from the AI SDK and enable provider-specific
  functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions
  /**
  Whether the tool call was executed by the provider.
   */
  providerExecuted?: boolean
}

/**
Content of an assistant message.
It can be a string or an array of text, image, reasoning, redacted reasoning, and tool call parts.
 */
type JsonAssistantContent = string | Array<TextPart | JsonFilePart | ReasoningPart | JsonToolCallPart | ToolResultPart>

export type JsonModelMessage = SystemModelMessage | JsonUserModelMessage | JsonAssistantModelMessage | ToolModelMessage

export type JsonResponseMessage = JsonAssistantModelMessage | ToolModelMessage

const toJsonDataContent = (data: DataContent | URL): JsonDataContent => {
  if (data instanceof URL) {
    return {
      type: 'url',
      value: data.toString(),
    }
  }
  if (typeof data === 'string') {
    // Assume it's base64 encoded
    return {
      type: 'base64',
      value: data,
    }
  }
  let buffer: Buffer
  if (data instanceof Uint8Array) {
    buffer = Buffer.from(data)
  } else if (data instanceof Buffer) {
    buffer = data
  } else {
    buffer = Buffer.from(data)
  }
  return {
    type: 'base64',
    value: buffer.toString('base64'),
  }
}

const toJsonUserContent = (content: UserContent): JsonUserContent => {
  if (typeof content === 'string') {
    return content
  }
  return content.map((part) => {
    switch (part.type) {
      case 'image':
        return {
          ...part,
          image: toJsonDataContent(part.image),
        }
      case 'file':
        return {
          ...part,
          data: toJsonDataContent(part.data),
        }
    }
    return part
  })
}

const toJsonAssistantContent = (content: AssistantContent): JsonAssistantContent => {
  if (typeof content === 'string') {
    return content
  }
  return content.map((part) => {
    switch (part.type) {
      case 'file':
        return {
          ...part,
          data: toJsonDataContent(part.data),
        }
      case 'tool-call':
        return {
          ...part,
          input: part.input as JSONValue,
        }
    }
    return part
  })
}

export const toJsonModelMessage = (msg: ModelMessage): JsonModelMessage => {
  switch (msg.role) {
    case 'user':
      return {
        ...msg,
        content: toJsonUserContent(msg.content),
      }
    case 'assistant':
      return {
        ...msg,
        content: toJsonAssistantContent(msg.content),
      }
  }
  return msg
}

const fromJsonDataContent = (data: JsonDataContent): DataContent | URL => {
  if (data.type === 'url') {
    return new URL(data.value)
  }
  return Buffer.from(data.value, 'base64')
}

const fromJsonUserContent = (content: JsonUserContent): UserContent => {
  if (typeof content === 'string') {
    return content
  }
  return content.map((part) => {
    switch (part.type) {
      case 'image':
        return {
          ...part,
          image: fromJsonDataContent(part.image),
        }
      case 'file':
        return {
          ...part,
          data: fromJsonDataContent(part.data),
        }
    }
    return part
  })
}

const fromJsonAssistantContent = (content: JsonAssistantContent): AssistantContent => {
  if (typeof content === 'string') {
    return content
  }
  return content.map((part) => {
    switch (part.type) {
      case 'file':
        return {
          ...part,
          data: fromJsonDataContent(part.data),
        }
    }
    return part
  })
}

export const fromJsonModelMessage = (msg: JsonModelMessage): ModelMessage => {
  switch (msg.role) {
    case 'system':
      return msg
    case 'user':
      return {
        ...msg,
        content: fromJsonUserContent(msg.content),
      }
    case 'assistant':
      return {
        ...msg,
        content: fromJsonAssistantContent(msg.content),
      }
  }
  return msg
}
