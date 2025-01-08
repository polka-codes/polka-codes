export const getString = <T extends string>(args: Partial<Partial<Record<T, string>>>, name: T, defaultValue?: string): string => {
  const ret = args[name] ?? defaultValue
  if (!ret) {
    throw new Error(`Missing required argument: ${name}`)
  }
  return ret
}

export const getStringArray = <T extends string>(args: Partial<Record<T, string>>, name: T, defaultValue?: string[]): string[] => {
  const ret = args[name]
  if (!ret) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  return ret.split(',')
}

export const getBoolean = <T extends string>(args: Partial<Record<T, string>>, name: T, defaultValue?: boolean): boolean => {
  const ret = args[name]
  if (!ret) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  switch (ret.toLowerCase()) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      throw new Error(`Invalid argument value: ${name}`)
  }
}

export const getInt = <T extends string>(args: Partial<Record<T, string>>, name: T, defaultValue?: number): number => {
  const ret = args[name]
  if (!ret) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required argument: ${name}`)
    }
    return defaultValue
  }
  const parsed = Number.parseInt(ret)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid argument value: ${name}`)
  }
  return parsed
}
