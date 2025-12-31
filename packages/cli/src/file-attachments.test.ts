import { describe, expect, it } from 'bun:test'
import type { JsonFilePart, JsonImagePart } from '@polka-codes/core'
import {
  attachFilesToContent,
  countFilesByType,
  createUserMessageWithFiles,
  filterFilesByMediaType,
  getDocuments,
  getImages,
} from './file-attachments'

describe('file-attachments', () => {
  describe('attachFilesToContent', () => {
    it('should return content unchanged when no files provided', () => {
      const content = 'Hello, world!'
      const result = attachFilesToContent(content)
      expect(result).toBe(content)
    })

    it('should return content unchanged when empty array provided', () => {
      const content = 'Hello, world!'
      const result = attachFilesToContent(content, [])
      expect(result).toBe(content)
    })

    it('should attach files to string content', () => {
      const content = 'Hello, world!'
      const files: JsonFilePart[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
      ]
      const result = attachFilesToContent(content, files)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ type: 'text', text: content })
      expect(result[1]).toEqual(files[0])
    })

    it('should attach files to array content', () => {
      const content = [{ type: 'text', text: 'Hello' }]
      const files: JsonImagePart[] = [
        {
          type: 'image',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          mediaType: 'image/png',
        },
      ]
      const result = attachFilesToContent(content, files)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(content[0])
      expect(result[1]).toEqual(files[0])
    })

    it('should attach multiple files', () => {
      const content = 'Check these files'
      const files: (JsonFilePart | JsonImagePart)[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
        {
          type: 'image',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          mediaType: 'image/png',
        },
      ]
      const result = attachFilesToContent(content, files)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ type: 'text', text: content })
      expect(result[1]).toEqual(files[0])
      expect(result[2]).toEqual(files[1])
    })
  })

  describe('createUserMessageWithFiles', () => {
    it('should create user message without files', () => {
      const result = createUserMessageWithFiles('Hello')

      expect(result).toEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      })
    })

    it('should create user message with files', () => {
      const files: JsonFilePart[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
      ]
      const result = createUserMessageWithFiles('Check this file', files)

      expect(result.role).toBe('user')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content).toHaveLength(2)
      expect(result.content[0]).toEqual({ type: 'text', text: 'Check this file' })
      expect(result.content[1]).toEqual(files[0])
    })
  })

  describe('filterFilesByMediaType', () => {
    const files: (JsonFilePart | JsonImagePart)[] = [
      { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
      { type: 'file', data: 'data:application/json;base64,eyJ0ZXN0IjoidHJ1ZSJ9', filename: 'test.json', mediaType: 'application/json' },
      { type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' },
      { type: 'image', image: 'data:image/jpeg;base64,DEF', mediaType: 'image/jpeg' },
      { type: 'file', data: 'data:text/plain;base64,V29ybGQ=', filename: 'world.txt' }, // no mediaType
    ]

    it('should filter files by string media type', () => {
      const result = filterFilesByMediaType(files, 'text/plain')

      expect(result).toHaveLength(1)
      expect(result[0].mediaType).toBe('text/plain')
    })

    it('should filter files by RegExp media type', () => {
      const result = filterFilesByMediaType(files, /^image\//)

      expect(result).toHaveLength(2)
      expect(result.every((f) => f.mediaType?.startsWith('image/'))).toBe(true)
    })

    it('should filter files by application media type', () => {
      const result = filterFilesByMediaType(files, 'application/json')

      expect(result).toHaveLength(1)
      expect(result[0].mediaType).toBe('application/json')
    })

    it('should return empty array when no files match', () => {
      const result = filterFilesByMediaType(files, 'video/mp4')

      expect(result).toHaveLength(0)
    })

    it('should exclude files without mediaType', () => {
      const result = filterFilesByMediaType(files, 'text/plain')

      expect(result.every((f) => f.mediaType !== undefined)).toBe(true)
    })
  })

  describe('getImages', () => {
    it('should extract image files from mixed array', () => {
      const files: (JsonFilePart | JsonImagePart)[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
        { type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' },
        { type: 'image', image: 'data:image/jpeg;base64,DEF', mediaType: 'image/jpeg' },
      ]

      const result = getImages(files)

      expect(result).toHaveLength(2)
      expect(result.every((f) => f.type === 'image')).toBe(true)
    })

    it('should return empty array when no images', () => {
      const files: JsonFilePart[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
      ]

      const result = getImages(files)

      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      const result = getImages([])

      expect(result).toHaveLength(0)
    })
  })

  describe('getDocuments', () => {
    it('should extract document files from mixed array', () => {
      const files: (JsonFilePart | JsonImagePart)[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
        { type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' },
        { type: 'file', data: 'data:application/pdf;base64,REF=', filename: 'test.pdf', mediaType: 'application/pdf' },
      ]

      const result = getDocuments(files)

      expect(result).toHaveLength(2)
      expect(result.every((f) => f.type === 'file')).toBe(true)
    })

    it('should return empty array when no documents', () => {
      const files: JsonImagePart[] = [{ type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' }]

      const result = getDocuments(files)

      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      const result = getDocuments([])

      expect(result).toHaveLength(0)
    })
  })

  describe('countFilesByType', () => {
    it('should count files by type', () => {
      const files: (JsonFilePart | JsonImagePart)[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
        { type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' },
        { type: 'image', image: 'data:image/jpeg;base64,DEF', mediaType: 'image/jpeg' },
        { type: 'file', data: 'data:application/pdf;base64,REF=', filename: 'test.pdf', mediaType: 'application/pdf' },
      ]

      const result = countFilesByType(files)

      expect(result).toEqual({
        images: 2,
        documents: 2,
        total: 4,
      })
    })

    it('should return zero counts for empty array', () => {
      const result = countFilesByType([])

      expect(result).toEqual({
        images: 0,
        documents: 0,
        total: 0,
      })
    })

    it('should count only images', () => {
      const files: JsonImagePart[] = [
        { type: 'image', image: 'data:image/png;base64,ABC', mediaType: 'image/png' },
        { type: 'image', image: 'data:image/jpeg;base64,DEF', mediaType: 'image/jpeg' },
      ]

      const result = countFilesByType(files)

      expect(result).toEqual({
        images: 2,
        documents: 0,
        total: 2,
      })
    })

    it('should count only files', () => {
      const files: JsonFilePart[] = [
        { type: 'file', data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt', mediaType: 'text/plain' },
        { type: 'file', data: 'data:application/pdf;base64,REF=', filename: 'test.pdf', mediaType: 'application/pdf' },
      ]

      const result = countFilesByType(files)

      expect(result).toEqual({
        images: 0,
        documents: 2,
        total: 2,
      })
    })
  })
})
