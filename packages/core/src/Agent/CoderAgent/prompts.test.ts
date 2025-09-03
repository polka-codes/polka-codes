import { expect, test } from 'bun:test'

import {
  attemptCompletion,
  delegate,
  executeCommand,
  fetchUrl,
  handOver,
  listFiles,
  readBinaryFile,
  readFile,
  removeFile,
  renameFile,
  replaceInFile,
  searchFiles,
  writeToFile,
} from '../../tools'
import { fullSystemPrompt } from './prompts'

const agentTools = [
  attemptCompletion,
  delegate,
  executeCommand,
  fetchUrl,
  handOver,
  listFiles,
  readBinaryFile,
  readFile,
  removeFile,
  renameFile,
  replaceInFile,
  searchFiles,
  writeToFile,
]

test('fullSystemPrompt', () => {
  const prompt = fullSystemPrompt(
    {
      os: 'Linux',
    },
    agentTools,
    'tool_',
    ['custom instructions', 'more'],
    {
      test: 'test',
      check: {
        command: 'check',
        description: 'Check the code',
      },
      format: {
        command: 'format',
        description: 'Format the code',
      },
    },
    false,
  )

  expect(prompt).toMatchSnapshot()
})
