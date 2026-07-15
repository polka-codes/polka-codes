// JSON-friendly counterparts for AI SDK message types.

import type { JSONValue } from '@ai-sdk/provider'
import {
  type AssistantContent,
  type CustomPart,
  type DataContent,
  type FileData,
  type FilePart,
  type ImagePart,
  isProviderReference,
  type ModelMessage,
  type ProviderOptions,
  type ProviderReference,
  type ReasoningFilePart,
  type ReasoningPart,
  type SystemModelMessage,
  type TextPart,
  type ToolApprovalRequest,
  type ToolApprovalResponse,
  type ToolResultOutput,
  type ToolResultPart,
  type UserContent,
} from '@ai-sdk/provider-utils'

type JsonBinaryContent =
  | { type: 'base64'; value: string }
  | { type: 'url'; value: string }
  | { type: 'reference'; value: ProviderReference }

type JsonFileDataContent = JsonBinaryContent | { type: 'text'; value: string }

export interface JsonImagePart extends Omit<ImagePart, 'image'> {
  image: JsonBinaryContent
}

export interface JsonFilePart extends Omit<FilePart, 'data'> {
  data: JsonFileDataContent
}

interface JsonReasoningFilePart extends Omit<ReasoningFilePart, 'data'> {
  data: Exclude<JsonBinaryContent, { type: 'reference' }>
}

export type JsonUserModelMessage = {
  role: 'user'
  content: JsonUserContent
  providerOptions?: ProviderOptions
}

export type JsonUserContent = string | Array<TextPart | JsonImagePart | JsonFilePart>

type JsonAssistantModelMessage = {
  role: 'assistant'
  content: JsonAssistantContent
  providerOptions?: ProviderOptions
}

interface JsonToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: JSONValue
  providerOptions?: ProviderOptions
  providerExecuted?: boolean
}

type ToolResultContentPart = Extract<ToolResultOutput, { type: 'content' }>['value'][number]
type JsonToolResultContentPart =
  | Exclude<ToolResultContentPart, { type: 'file' }>
  | (Omit<Extract<ToolResultContentPart, { type: 'file' }>, 'data'> & { data: JsonFileDataContent })
type JsonToolResultOutput =
  | Exclude<ToolResultOutput, { type: 'content' }>
  | (Omit<Extract<ToolResultOutput, { type: 'content' }>, 'value'> & { value: JsonToolResultContentPart[] })

interface JsonToolResultPart extends Omit<ToolResultPart, 'output'> {
  output: JsonToolResultOutput
}

type JsonToolModelMessage = {
  role: 'tool'
  content: Array<JsonToolResultPart | ToolApprovalResponse>
  providerOptions?: ProviderOptions
}

type JsonAssistantContent =
  | string
  | Array<
      | TextPart
      | CustomPart
      | JsonFilePart
      | ReasoningPart
      | JsonReasoningFilePart
      | JsonToolCallPart
      | JsonToolResultPart
      | ToolApprovalRequest
    >

export type JsonModelMessage = SystemModelMessage | JsonUserModelMessage | JsonAssistantModelMessage | JsonToolModelMessage

export type JsonResponseMessage = JsonAssistantModelMessage | JsonToolModelMessage

const toBase64 = (data: DataContent): string => {
  if (typeof data === 'string') return data
  if (data instanceof Uint8Array) return Buffer.from(data).toString('base64')
  return Buffer.from(data).toString('base64')
}

const toJsonImageContent = (data: ImagePart['image']): JsonBinaryContent => {
  if (data instanceof URL) return { type: 'url', value: data.toString() }
  if (typeof data === 'string' || data instanceof Uint8Array || data instanceof ArrayBuffer) {
    return { type: 'base64', value: toBase64(data) }
  }
  return { type: 'reference', value: data }
}

const toJsonReasoningFileContent = (data: ReasoningFilePart['data']): Exclude<JsonBinaryContent, { type: 'reference' }> => {
  if (data instanceof URL) return { type: 'url', value: data.toString() }
  if (typeof data === 'string' || data instanceof Uint8Array || data instanceof ArrayBuffer) {
    return { type: 'base64', value: toBase64(data) }
  }
  switch (data.type) {
    case 'data':
      return { type: 'base64', value: toBase64(data.data) }
    case 'url':
      return { type: 'url', value: data.url.toString() }
  }
}

const toJsonFileDataContent = (data: FilePart['data']): JsonFileDataContent => {
  if (data instanceof URL) return { type: 'url', value: data.toString() }
  if (typeof data === 'string' || data instanceof Uint8Array || data instanceof ArrayBuffer) {
    return { type: 'base64', value: toBase64(data) }
  }
  if (isProviderReference(data)) return { type: 'reference', value: data }
  switch (data.type) {
    case 'data':
      return { type: 'base64', value: toBase64(data.data) }
    case 'url':
      return { type: 'url', value: data.url.toString() }
    case 'reference':
      return { type: 'reference', value: data.reference }
    case 'text':
      return { type: 'text', value: data.text }
  }
}

const toJsonToolResultOutput = (output: ToolResultOutput): JsonToolResultOutput => {
  if (output.type !== 'content') return output
  return {
    ...output,
    value: output.value.map((part) => (part.type === 'file' ? { ...part, data: toJsonFileDataContent(part.data) } : part)),
  }
}

const toJsonToolResultPart = (part: ToolResultPart): JsonToolResultPart => ({
  ...part,
  output: toJsonToolResultOutput(part.output),
})

const toJsonUserContent = (content: UserContent): JsonUserContent => {
  if (typeof content === 'string') return content
  return content.map((part) => {
    switch (part.type) {
      case 'image':
        return { ...part, image: toJsonImageContent(part.image) }
      case 'file':
        return { ...part, data: toJsonFileDataContent(part.data) }
      default:
        return part
    }
  })
}

const toJsonAssistantContent = (content: AssistantContent): JsonAssistantContent => {
  if (typeof content === 'string') return content
  return content.map((part) => {
    switch (part.type) {
      case 'file':
        return { ...part, data: toJsonFileDataContent(part.data) }
      case 'reasoning-file':
        return { ...part, data: toJsonReasoningFileContent(part.data) }
      case 'tool-call':
        return { ...part, input: part.input as JSONValue }
      case 'tool-result':
        return toJsonToolResultPart(part)
      default:
        return part
    }
  })
}

export const toJsonModelMessage = (msg: ModelMessage): JsonModelMessage => {
  switch (msg.role) {
    case 'user':
      return { ...msg, content: toJsonUserContent(msg.content) }
    case 'assistant':
      return { ...msg, content: toJsonAssistantContent(msg.content) }
    case 'tool':
      return {
        ...msg,
        content: msg.content.map((part) => (part.type === 'tool-result' ? toJsonToolResultPart(part) : part)),
      }
    default:
      return msg
  }
}

const fromJsonBinaryContent = (data: JsonBinaryContent): DataContent | URL | ProviderReference => {
  switch (data.type) {
    case 'base64':
      return Buffer.from(data.value, 'base64')
    case 'url':
      return new URL(data.value)
    case 'reference':
      return data.value
  }
}

const fromJsonTaggedFileData = (data: JsonFileDataContent): FileData => {
  switch (data.type) {
    case 'base64':
      return { type: 'data', data: Buffer.from(data.value, 'base64') }
    case 'url':
      return { type: 'url', url: new URL(data.value) }
    case 'reference':
      return { type: 'reference', reference: data.value }
    case 'text':
      return { type: 'text', text: data.value }
  }
}

const fromJsonFileDataContent = (data: JsonFileDataContent): FilePart['data'] => fromJsonTaggedFileData(data)

const fromJsonReasoningFileData = (data: Exclude<JsonBinaryContent, { type: 'reference' }>): ReasoningFilePart['data'] =>
  data.type === 'base64' ? { type: 'data', data: Buffer.from(data.value, 'base64') } : { type: 'url', url: new URL(data.value) }

const fromJsonToolResultOutput = (output: JsonToolResultOutput): ToolResultOutput => {
  if (output.type !== 'content') return output
  return {
    ...output,
    value: output.value.map((part) => (part.type === 'file' ? { ...part, data: fromJsonTaggedFileData(part.data) } : part)),
  }
}

const fromJsonToolResultPart = (part: JsonToolResultPart): ToolResultPart => ({
  ...part,
  output: fromJsonToolResultOutput(part.output),
})

const fromJsonUserContent = (content: JsonUserContent): UserContent => {
  if (typeof content === 'string') return content
  return content.map((part) => {
    switch (part.type) {
      case 'image':
        return { ...part, image: fromJsonBinaryContent(part.image) }
      case 'file':
        return { ...part, data: fromJsonFileDataContent(part.data) }
      default:
        return part
    }
  })
}

const fromJsonAssistantContent = (content: JsonAssistantContent): AssistantContent => {
  if (typeof content === 'string') return content
  return content.map((part) => {
    switch (part.type) {
      case 'file':
        return { ...part, data: fromJsonFileDataContent(part.data) }
      case 'reasoning-file':
        return { ...part, data: fromJsonReasoningFileData(part.data) }
      case 'tool-result':
        return fromJsonToolResultPart(part)
      default:
        return part
    }
  })
}

export const fromJsonModelMessage = (msg: JsonModelMessage): ModelMessage => {
  switch (msg.role) {
    case 'user':
      return { ...msg, content: fromJsonUserContent(msg.content) }
    case 'assistant':
      return { ...msg, content: fromJsonAssistantContent(msg.content) }
    case 'tool':
      return {
        ...msg,
        content: msg.content.map((part) => (part.type === 'tool-result' ? fromJsonToolResultPart(part) : part)),
      }
    default:
      return msg
  }
}
