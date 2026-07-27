import { z } from 'zod'

export const TodoStatus = z.enum(['open', 'completed', 'closed'])

export const TodoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: TodoStatus,
})

export type TodoItem = z.infer<typeof TodoItemSchema>

export const UpdateTodoItemInputSchema = z
  .object({
    operation: z.enum(['add', 'update']).describe('Add a new item or update an existing item.'),
    id: z.string().min(1).nullish().describe('Item id. Required for update.'),
    parentId: z.string().min(1).nullish().describe('Parent id for a child item.'),
    title: z.string().min(1).nullish().describe('Item title. Required for add.'),
    description: z.string().nullish().describe('Item details.'),
    status: TodoStatus.nullish().describe('Item status.'),
  })
  .superRefine((data, ctx) => {
    if (data.operation === 'add') {
      if (!data.title) {
        ctx.addIssue({
          code: 'custom',
          message: 'Title is required for "add" operation',
          path: ['title'],
        })
      }
    } else if (data.operation === 'update') {
      if (!data.id) {
        ctx.addIssue({
          code: 'custom',
          message: 'ID is required for "update" operation',
          path: ['id'],
        })
      }
    }
  })

export type UpdateTodoItemInput = z.infer<typeof UpdateTodoItemInputSchema>

export const UpdateTodoItemOutputSchema = z.object({
  id: z.string(),
})
export type UpdateTodoItemOutput = z.infer<typeof UpdateTodoItemOutputSchema>
