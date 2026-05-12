import { type Logger, type TaskEvent, TaskEventKind } from '@polka-codes/core'

export type WorkflowProgressEvent =
  | { kind: 'workflow-started' }
  | { kind: 'model-output-started' }
  | { kind: 'tool-call-started'; tool: string }
  | { kind: 'tool-call-finished'; tool: string }
  | { kind: 'write-attempted'; path: string }
  | { kind: 'write-finished'; path: string }
  | { kind: 'write-rejected'; path: string; reason: string }
  | { kind: 'fix-started'; command: string }
  | { kind: 'fix-failed'; command: string; exitCode: number }
  | { kind: 'fix-succeeded'; command: string }
  | { kind: 'workflow-finished'; success: boolean }

export type WorkflowProgressCallback = (event: WorkflowProgressEvent) => void | Promise<void>
export type CodeWorkflowEvent = WorkflowProgressEvent

export type WorkflowProgressState = {
  modelOutputStarted: boolean
}

export function createWorkflowProgressEmitter(
  onEvent: WorkflowProgressCallback | undefined,
  logger: Pick<Logger, 'warn'>,
): WorkflowProgressCallback {
  return async (event) => {
    if (!onEvent) {
      return
    }

    try {
      await onEvent(event)
    } catch (error) {
      logger.warn(`Workflow progress callback failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export function workflowProgressEventsFromTaskEvent(event: TaskEvent, state: WorkflowProgressState): WorkflowProgressEvent[] {
  switch (event.kind) {
    case TaskEventKind.StartRequest:
      if (state.modelOutputStarted) {
        return []
      }
      state.modelOutputStarted = true
      return [{ kind: 'model-output-started' }]
    case TaskEventKind.ToolUse:
      return [{ kind: 'tool-call-started', tool: event.tool }]
    case TaskEventKind.ToolReply:
    case TaskEventKind.ToolError:
      return [{ kind: 'tool-call-finished', tool: event.tool }]
    default:
      return []
  }
}
