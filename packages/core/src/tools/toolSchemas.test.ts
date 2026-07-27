import { describe, expect, it } from 'bun:test'
import { toJSONSchema } from 'zod'
import askFollowupQuestion from './askFollowupQuestion'
import executeCommand from './executeCommand'
import fetchUrl from './fetchUrl'
import listFiles from './listFiles'
import readFile from './readFile'

describe('core tool JSON schemas', () => {
  it('exposes canonical arrays for multi-value inputs', () => {
    expect(toJSONSchema(readFile.parameters)).toMatchObject({
      properties: { path: { type: 'array', minItems: 1 } },
      required: ['path'],
    })
    expect(toJSONSchema(fetchUrl.parameters)).toMatchObject({
      properties: { url: { type: 'array', minItems: 1 } },
      required: ['url'],
    })
    expect(readFile.parameters.parse({ path: ['file,with-comma.ts'] }).path).toEqual(['file,with-comma.ts'])
    expect(fetchUrl.parameters.parse({ url: ['https://example.com/a,b'] }).url).toEqual(['https://example.com/a,b'])
  })

  it('does not require fields that have handler defaults', () => {
    expect(toJSONSchema(executeCommand.parameters)).toMatchObject({ required: ['command'] })
    expect(toJSONSchema(listFiles.parameters)).toMatchObject({ required: ['path'] })

    const questionSchema = toJSONSchema(askFollowupQuestion.parameters) as unknown as {
      properties: { questions: { items: { required?: string[] } } }
    }
    expect(questionSchema.properties.questions.items.required).toEqual(['prompt'])
  })

  it('rejects invalid offsets, limits, and counts', () => {
    expect(readFile.parameters.safeParse({ path: ['file.ts'], offset: -1 }).success).toBe(false)
    expect(readFile.parameters.safeParse({ path: ['file.ts'], limit: 0 }).success).toBe(false)
    expect(listFiles.parameters.safeParse({ path: '.', maxCount: 0 }).success).toBe(false)
    expect(listFiles.parameters.safeParse({ path: '.', maxCount: 1.5 }).success).toBe(false)
  })
})
