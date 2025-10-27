import { describe, expect, it, spyOn } from 'bun:test'
import listTodoItems from './listTodoItems'
import type { TodoProvider } from './provider'
import type { TodoItem } from './todo'

describe('listTodoItems', () => {
  const mockTodos: TodoItem[] = [
    { id: '10', title: 'item 10', description: '', relevantFileList: [], status: 'open' },
    { id: '2', title: 'item 2', description: '', relevantFileList: [], status: 'completed' },
    { id: '1.2', title: 'sub-item 1.2', description: '', relevantFileList: [], status: 'completed' },
    { id: '1.1', title: 'sub-item 1.1', description: '', relevantFileList: [], status: 'open' },
    { id: '1', title: 'item 1', description: '', relevantFileList: [], status: 'open' },
  ]

  it('should list all todo items sorted correctly', async () => {
    const provider: TodoProvider = {
      listTodoItems: async () => mockTodos,
      getTodoItem: () => {
        throw new Error('Function not implemented.')
      },
      updateTodoItem: () => {
        throw new Error('Function not implemented.')
      },
    }
    const result = await listTodoItems.handler(provider, {})
    expect(result).toMatchSnapshot()
  })

  it('should filter items by status', async () => {
    const provider: TodoProvider = {
      listTodoItems: async () => mockTodos,
      getTodoItem: () => {
        throw new Error('Function not implemented.')
      },
      updateTodoItem: () => {
        throw new Error('Function not implemented.')
      },
    }
    const result = await listTodoItems.handler(provider, { status: 'completed' })
    expect(result).toMatchSnapshot()
  })

  it('should list sub-items for a given id', async () => {
    const provider: TodoProvider = {
      listTodoItems: async () => mockTodos.filter((item) => item.id.startsWith('1.')),
      getTodoItem: () => {
        throw new Error('Function not implemented.')
      },
      updateTodoItem: () => {
        throw new Error('Function not implemented.')
      },
    }
    const listSpy = spyOn(provider, 'listTodoItems')
    const result = await listTodoItems.handler(provider, { id: '1' })
    expect(listSpy).toHaveBeenCalledWith('1')
    expect(result).toMatchSnapshot()
  })
})
