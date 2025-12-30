# Dynamic Workflow Control Flow

This document describes the control flow features available in dynamic workflows.

## Features

The following control flow constructs are now supported:

1. **While Loops** - Repeat steps while a condition is true
2. **If/Else Branches** - Conditionally execute different steps
3. **Break Statement** - Exit a loop early
4. **Continue Statement** - Skip to the next iteration of a loop

## While Loops

Execute a set of steps repeatedly while a condition evaluates to true.

```yaml
workflows:
  countdown:
    task: "Count down from 5 to 1"
    inputs:
      - id: count
        description: "Starting number"
        default: 5

    steps:
      - id: countDown
        while:
          condition: "state.count > 0"
          steps:
            - id: showCount
              task: "Display current count"
              output: count
        output: result
```

The condition expression has access to:
- `input` - The workflow input values
- `state` - The current workflow state (outputs from previous steps)

**Safety:** While loops are limited to 1000 iterations to prevent infinite loops.

## If/Else Branches

Conditionally execute different sets of steps based on a condition.

```yaml
workflows:
  processValue:
    task: "Process a value differently based on its range"
    inputs:
      - id: value
        description: "Value to process"
        default: 10

    steps:
      - id: checkRange
        if:
          condition: "input.value > 100"
          thenBranch:
            - id: handleLarge
              task: "Handle large value"
              tools: ["internet"]
          elseBranch:
            - id: handleSmall
              task: "Handle small value"
              tools: ["readonly"]
        output: result
```

You can omit the `elseBranch` if you only need conditional execution:

```yaml
steps:
  - id: optionalStep
    if:
      condition: "state.enabled"
      thenBranch:
        - id: doWork
          task: "Do optional work"
```

## Break Statement

Exit a while loop early.

```yaml
steps:
  - id: searchLoop
    while:
      condition: "state.index < state.items.length"
      steps:
        - id: checkItem
          task: "Check if current item matches"
          output: found

        - id: breakIfFound
          if:
            condition: "state.found"
            thenBranch:
              - break: true

        - id: incrementIndex
          task: "Move to next item"
```

## Continue Statement

Skip to the next iteration of a while loop.

```yaml
steps:
  - id: processLoop
    while:
      condition: "state.index < state.items.length"
      steps:
        - id: checkIfValid
          task: "Check if current item is valid"
          output: isValid

        - id: skipInvalid
          if:
            condition: "!state.isValid"
            thenBranch:
              - continue: true

        - id: processValid
          task: "Process valid item"
```

## Nested Control Flow

You can nest control flow structures:

```yaml
steps:
  - id: outerLoop
    while:
      condition: "state.i < 10"
      steps:
        - id: innerLoop
          while:
            condition: "state.j < 5"
            steps:
              - id: doNestedWork
                task: "Process nested iteration"

        - id: checkCondition
          if:
            condition: "state.i % 2 === 0"
            thenBranch:
              - id: evenHandler
                task: "Handle even iteration"
```

## Condition Expression Syntax

Conditions are JavaScript expressions that have access to:
- `input` - Workflow input values
- `state` - Current workflow state (including outputs from previous steps)

Examples:
- `state.count < 5`
- `input.value > 100 && input.value < 1000`
- `state.items.length === 0`
- `state.user.isLoggedIn === true`
- `!state.isEmpty`

## Output Handling

Control flow structures can have an `output` field to store their result:

```yaml
steps:
  - id: myLoop
    while:
      condition: "state.count < 10"
      steps:
        - id: doWork
          task: "Do some work"
    output: loopResult  # Stores the last result from the loop

# Later steps can access it
  - id: useResult
    task: "Process loop result: ${state.loopResult}"
```

## Complete Example

Here's a complete workflow that searches files until finding a match:

```yaml
workflows:
  searchUntilFound:
    task: "Search through files until finding a target string"
    inputs:
      - id: target
        description: "String to search for"
      - id: maxFiles
        description: "Maximum number of files to search"
        default: 10

    steps:
      - id: initialize
        task: "Initialize search state"
        output: searchState

      - id: searchLoop
        while:
          condition: "!state.found && state.fileIndex < input.maxFiles"
          steps:
            - id: getNextFile
              task: "Get the next file to search"
              tools: ["readonly"]
              output: filePath

            - id: searchFile
              task: "Search file for target: ${input.target}"
              tools: ["readonly"]
              output: matchFound

            - id: checkFound
              if:
                condition: "state.matchFound"
                thenBranch:
                  - id: recordSuccess
                    task: "Record the successful search"
                    output: found
                  - break: true

            - id: incrementIndex
              task: "Increment file index"
              output: fileIndex

        output: searchResult

    output: searchResult
```

## Error Handling

If a condition expression fails to evaluate, the workflow will error with details about which step and condition failed.

Example error:
```
Failed to evaluate condition: input.value > max. Error: max is not defined
```

Make sure all variables in your conditions exist in `input` or `state`.
