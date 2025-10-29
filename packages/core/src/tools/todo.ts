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
    operation: z.enum(['add', 'update']),
    id: z.string().nullish(),
    parentId: z.string().nullish(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    status: TodoStatus.nullish(),
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
