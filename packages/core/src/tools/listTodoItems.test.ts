import { describe, expect, it, spyOn } from 'bun:test'
import listTodoItems from './listTodoItems'
import type { TodoProvider } from './provider'
import type { TodoItem } from './todo'

describe('listTodoItems', () => {
  const mockTodos: TodoItem[] = [
    { id: '10', title: 'item 10', description: '', status: 'open' },
    { id: '2', title: 'item 2', description: '', status: 'completed' },
    { id: '1.2', title: 'sub-item 1.2', description: '', status: 'completed' },
    { id: '1.1', title: 'sub-item 1.1', description: '', status: 'open' },
    { id: '1', title: 'item 1', description: '', status: 'open' },
  ]

  const createMockProvider = (items: TodoItem[]): TodoProvider => ({
    listTodoItems: async (id?: string | null, status?: string | null) => {
      let resultItems = id ? items.filter((item) => item.id.startsWith(`${id}.`)) : items

      if (status) {
        resultItems = resultItems.filter((item) => item.status === status)
      }

      resultItems.sort((a, b) => {
        const aParts = a.id.split('.')
        const bParts = b.id.split('.')
        const len = Math.min(aParts.length, bParts.length)
        for (let i = 0; i < len; i++) {
          const comparison = aParts[i].localeCompare(bParts[i], undefined, { numeric: true })
          if (comparison !== 0) {
            return comparison
          }
        }
        return aParts.length - bParts.length
      })

      return resultItems
    },
    getTodoItem: () => {
      throw new Error('Function not implemented.')
    },
    updateTodoItem: () => {
      throw new Error('Function not implemented.')
    },
  })

  it('should list all todo items sorted correctly', async () => {
    const provider = createMockProvider(mockTodos)
    const result = await listTodoItems.handler(provider, {})
    expect(result).toMatchSnapshot()
  })

  it('should filter items by status', async () => {
    const provider = createMockProvider(mockTodos)
    const result = await listTodoItems.handler(provider, { status: 'completed' })
    expect(result).toMatchSnapshot()
  })

  it('should list sub-items for a given id', async () => {
    const provider = createMockProvider(mockTodos)
    const listSpy = spyOn(provider, 'listTodoItems')
    const result = await listTodoItems.handler(provider, { id: '1' })
    expect(listSpy).toHaveBeenCalledWith('1', undefined)
    expect(result).toMatchSnapshot()
  })
})
