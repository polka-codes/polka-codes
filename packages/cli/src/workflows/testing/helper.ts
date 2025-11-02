import { expect, mock } from 'bun:test'
import { createContext } from '@polka-codes/core'
import type { CliToolRegistry } from '../../workflow-tools'

// This is a helper type to extract the input and output types from the ToolSignature
type ToolIO<T> = T extends { input: infer I; output: infer O } ? { input: I; output: O } : never

export type ExpectedToolCall<T extends keyof CliToolRegistry> = {
  toolName: T
  args: ToolIO<CliToolRegistry[T]>['input']
  returnValue: ToolIO<CliToolRegistry[T]>['output']
  isError?: boolean
}

export function createTestProxy(expectedCalls: ExpectedToolCall<keyof CliToolRegistry>[]) {
  const remainingCalls = [...expectedCalls]

  const proxy = new Proxy({} as any, {
    get(_target, prop: string | symbol) {
      return async (args: any) => {
        if (prop === 'taskEvent') {
          return undefined
        }
        const expectedCall = remainingCalls.shift()
        if (!expectedCall) {
          throw new Error(`Unexpected tool call: ${String(prop)}`)
        }
        const { returnValue, isError, ...matchableExpectedCall } = expectedCall
        expect({ toolName: prop, args }).toMatchObject(matchableExpectedCall)

        if (isError) {
          throw returnValue
        }
        return Promise.resolve(returnValue)
      }
    },
  })

  const logger = {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  }

  const context = createContext<CliToolRegistry>(proxy, undefined, logger)
  const assert = () => {
    expect(remainingCalls).toBeEmpty()
  }

  return { context, assert, logger }
}
