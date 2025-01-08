import pino from 'pino'

let logger: pino.Logger | undefined = undefined

export const getLogger = () => {
  if (!logger) {
    logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      redact: ['apiKey'],
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    })
  }
  return logger
}

export const setLogger = (newLogger: pino.Logger) => {
  logger = newLogger
}

// Create namespaced loggers for different services
export const createServiceLogger = (service: string) => getLogger().child({ service })

export type Logger = pino.Logger
