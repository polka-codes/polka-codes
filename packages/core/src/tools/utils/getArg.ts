import type { ToolParameterValue } from '../../tool'

export const getString = <T extends string>(
  args: Partial<Record<T, string>> | ToolParameterValue,
  name: T,
  defaultValue?: string,
): string => {
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error(`Invalid argument type: ${name} ${args}`)
  }
  const ret = args[name] ?? defaultValue
  if (ret === undefined) {
    throw new Error(`Missing required argument: ${name}`)
  }
  if (typeof ret !== 'string') {
    throw new Error(`Invalid argument type: ${name} ${ret}`)
  }
  return ret
}

export const getStringArray = <T extends string>(
  args: Partial<Record<T, ToolParameterValue>>,
  name: T,
  defaultValue?: string[],
): string[] => {
  const ret = args[name]
  if (ret === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  if (ret === '') {
    return []
  }
  if (typeof ret !== 'string') {
    throw new Error(`Invalid argument type: ${name} ${ret}`)
  }
  return ret.split(',').map((s) => s.trim())
}

export const getBoolean = <T extends string>(args: Partial<Record<T, ToolParameterValue>>, name: T, defaultValue?: boolean): boolean => {
  const ret = args[name]
  if (ret === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  if (typeof ret !== 'string') {
    throw new Error(`Invalid argument type: ${name} ${ret}`)
  }
  switch (ret.toLowerCase()) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      throw new Error(`Invalid argument value: ${name} ${ret}`)
  }
}

export const getInt = <T extends string>(args: Partial<Record<T, ToolParameterValue>>, name: T, defaultValue?: number): number => {
  const ret = args[name]
  if (ret === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  if (typeof ret !== 'string') {
    throw new Error(`Invalid argument type: ${name} ${ret}`)
  }
  const parsed = Number.parseInt(ret)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid argument value: ${name} ${ret}`)
  }
  return parsed
}

export const getArray = <T extends string>(
  args: Partial<Record<T, ToolParameterValue>> | ToolParameterValue,
  name: T,
  defaultValue?: ToolParameterValue[],
): ToolParameterValue[] => {
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error(`Invalid argument type: ${name} ${args}`)
  }
  const ret = args[name]
  if (ret === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  if (Array.isArray(ret)) {
    return ret
  }
  return [ret]
}
