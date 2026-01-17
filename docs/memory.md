# Memory Management

The Polka Codes CLI includes a powerful, persistent memory store backed by SQLite. This allows AI agents to remember context across sessions, track todos, manage bugs, and maintain decision logs.

## Features

- **Persistent Storage**: All memories are stored in `~/.config/polka-codes/memory.sqlite`
- **Project Isolation**: Each project has its own memory scope
- **Global Memory**: Share memories across all projects
- **Structured Queries**: Filter by type, status, priority, tags
- **Import/Export**: Backup and migrate your memory
- **Secure**: Database files created with 0600 permissions (owner read/write only)
- **Concurrent Safe**: Multiple CLI processes can read/write simultaneously

## Quick Start

Memory is enabled by default. No configuration needed!

```bash
# List all memory entries
polka memory list

# Add a todo (via AI agent)
polka code "Add a task to fix the login bug"

# View the todo
polka memory list --type todo

# Mark it as done
polka code "Mark the login bug task as completed"
```

## Configuration

Memory is configured in your global `~/.config/polka-codes/config.yml`:

```yaml
memory:
  enabled: true              # Enable/disable memory store
  type: sqlite               # Storage backend (only sqlite supported)
  path: ~/.config/polka-codes/memory.sqlite  # Database location
```

To disable memory entirely:

```yaml
memory:
  enabled: false
```

## Commands

### `polka memory list`

List memory entries with optional filters.

```bash
# List all entries
polka memory list

# Filter by type
polka memory list --type todo
polka memory list --type bug
polka memory list --type decision
polka memory list --type note

# Filter by status
polka memory list --status open
polka memory list --status done

# Filter by priority
polka memory list --priority critical
polka memory list --priority high

# Filter by tags
polka memory list --tags "bug,urgent"

# Search in content and name
polka memory list --search "authentication"

# Sort results
polka memory list --sort-by updated --sort-order desc

# Limit results
polka memory list --limit 10

# Pagination
polka memory list --limit 10 --offset 20

# JSON output (for scripting)
polka memory list --format json | jq '.[] | select(.priority == "critical")'
```

**Output Formats:**

Table format (default):
```
Memory Entries:
────────────────────────────────────────────────────────────────────────────────
Name: fix-login-bug
Type: todo
Status: open
Priority: high
Tags: bug,auth
Updated: 1/17/2026, 12:34:56 PM
Content:
Fix the authentication issue where users cannot log in with special characters in passwords.
────────────────────────────────────────────────────────────────────────────────

Total: 1 entries
```

JSON format:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "fix-login-bug",
    "scope": "project:/Users/user/projects/myapp",
    "content": "Fix the authentication issue...",
    "entry_type": "todo",
    "status": "open",
    "priority": "high",
    "tags": "bug,auth",
    "created_at": 1737105696000,
    "updated_at": 1737105696000,
    "last_accessed": 1737105696000
  }
]
```

### `polka memory read <name>`

Read a specific memory entry.

```bash
# Read as text (default)
polka memory read fix-login-bug

# Read as JSON
polka memory read fix-login-bug --format json

# Output: Fix the authentication issue where users cannot log in...
```

### `polka memory delete <name>`

Delete a memory entry.

```bash
# Requires confirmation
polka memory delete old-entry
# Output: Are you sure you want to delete memory entry "old-entry"?
#         This action cannot be undone.
#         Use --force to skip this confirmation.

# Skip confirmation
polka memory delete old-entry --force
# Output: Memory entry "old-entry" deleted.
```

### `polka memory rename <oldName> <newName>`

Rename a memory entry.

```bash
polka memory rename fix-auth fix-authentication
# Output: Memory entry renamed from "fix-auth" to "fix-authentication".
```

### `polka memory export [options]`

Export memory entries to JSON.

```bash
# Export all entries to default file (memory-export-TIMESTAMP.json)
polka memory export

# Export to specific file
polka memory export --output backup.json

# Export only global scope
polka memory export --scope global > global-memory.json

# Export only project scope
polka memory export --scope project > project-memory.json

# Export filtered entries
polka memory export --type todo > todos.json
polka memory export --status open --type bug > open-bugs.json
```

### `polka memory import <file>`

Import memory entries from JSON.

```bash
# Import (skips conflicts)
polka memory import backup.json

# Import and merge with existing data
polka memory import --merge backup.json

# Import with validation
# - Invalid entries are skipped
# - Invalid priorities default to null
# - Missing required fields are reported
polka memory import backup.json
# Output: Imported 42 entries, skipped 3 entries.
```

**Import File Format:**

```json
[
  {
    "name": "fix-login-bug",
    "content": "Fix the authentication issue...",
    "entry_type": "todo",
    "status": "open",
    "priority": "high",
    "tags": "bug,auth"
  }
]
```

### `polka memory status`

Show database statistics.

```bash
polka memory status
```

**Output:**
```
Memory Store Status:
────────────────────────────────────────────────────────────────────────────────
Database: /Users/user/.config/polka-codes/memory.sqlite
Total entries: 42
Database size: 45.23 KB

Entries by type:
  todo: 15
  bug: 8
  decision: 12
  note: 7
────────────────────────────────────────────────────────────────────────────────
```

## Memory Entry Types

Memory entries can have different types:

- **`todo`**: Task items with status, priority
- **`bug`**: Bug reports with priority
- **`decision`**: Architectural decisions and rationale
- **`note`**: General notes and documentation

## Memory Entry Fields

Each memory entry has the following fields:

- **`name`**: Unique identifier (required)
- **`content`**: The actual content (required)
- **`entry_type`**: Type of entry (todo, bug, decision, note)
- **`status`**: Current status (open, done, etc.)
- **`priority`**: Importance level (low, medium, high, critical)
- **`tags`**: Comma-separated tags for organization

## Project vs Global Scope

Memory entries are scoped by project:

**Project Scope:**
- Each project (directory with `.polkacodes.yml`) has its own memory
- Created when you run `polka` commands within a project directory
- Stored with scope `project:/absolute/path/to/project`

**Global Scope:**
- Shared across all projects
- Created when you run `polka` commands outside a project directory
- Stored with scope `global`

```bash
# In a project directory
cd ~/projects/myapp
polka memory list  # Shows only myapp's memory

# Outside any project
cd ~
polka memory list  # Shows global memory
```

## Security

The memory store implements several security features:

1. **File Permissions**: Database files created with `0600` (owner read/write only)
2. **SQL Injection Prevention**: All queries use parameterized statements
3. **Path Traversal Protection**: Validated paths cannot escape home directory
4. **Input Validation**: All user inputs are validated and sanitized
5. **Transaction Safety**: ACID guarantees with automatic rollback on errors

## Database Location

The default database location is:

```bash
~/.config/polka-codes/memory.sqlite
```

You can change this in your config:

```yaml
memory:
  path: ~/custom/path/memory.sqlite
```

**Database File:**

- Automatically created on first use
- Directory created with `0700` permissions (owner rwx only)
- File created with `0600` permissions (owner rw only)
- Backed up automatically if corrupted

## Corruption Recovery

If the database becomes corrupted, it will automatically:

1. Detect the corruption via integrity check
2. Backup the corrupted file to `memory.sqlite.corrupted.TIMESTAMP`
3. Create a new, empty database
4. Continue operation

You can then import from a backup:

```bash
# List available backups
ls -la ~/.config/polka-codes/memory.sqlite.corrupted.*

# If you have a recent export, import it
polka memory import memory-export-1737105696000.json
```

## Performance

The memory store is optimized for typical usage:

- **Scale**: Designed for 100-1,000 entries per project
- **Indexes**: Optimized indexes on `(scope, type)` and `updated_at`
- **Queries**: Default limit of 1000 entries per query
- **Concurrent**: WAL mode allows multiple readers simultaneously

## Troubleshooting

### Memory Disabled Error

```
Memory store is not enabled. Enable it in config with memory.enabled: true
```

**Solution**: Enable memory in `~/.config/polka-codes/config.yml`:
```yaml
memory:
  enabled: true
```

### Database Locked Error

```
[SQLiteMemoryStore] Retryable error, retrying in 100ms...
```

**Solution**: This is normal. Multiple CLI processes are writing simultaneously. The store will automatically retry with exponential backoff.

### Path Escapes Home Directory

```
Path escapes home directory: ~/.config/../../../etc/passwd
```

**Solution**: Don't use `..` in your database path. Use a direct path:
```yaml
memory:
  path: ~/my-memory.sqlite  # Good
  path: ~/.config/myapp/memory.sqlite  # Good
  path: ~/.config/../data/memory.sqlite  # Bad - will error
```

## Examples

### Todo Tracking

```bash
# AI agent adds todos
polka code "Add a todo to refactor the auth module"
polka code "Add a high-priority todo to fix the security vulnerability"

# List all todos
polka memory list --type todo

# List only open todos
polka memory list --type todo --status open

# Show high-priority todos
polka memory list --type todo --priority high,critical

# Mark as done (via agent)
polka code "Mark the auth refactor todo as completed"
```

### Bug Tracking

```bash
# Log a bug
polka code "Add a bug report: users cannot reset passwords"

# List all bugs
polka memory list --type bug

# Show critical bugs
polka memory list --type bug --priority critical

# Search for authentication bugs
polka memory list --type bug --search "auth"
```

### Decision Logging

```bash
# Record a decision
polka code "Document the decision to use PostgreSQL over MySQL"

# View all decisions
polka memory list --type decision

# Export decisions for documentation
polka memory export --type decision > decisions.json
```

### Backup and Restore

```bash
# Regular backup
polka memory export --output "backups/memory-$(date +%Y%m%d).json"

# Restore from backup
polka memory import backups/memory-20250117.json

# Merge partial backup
polka memory import --merge partial-backup.json
```

### Memory Migration

When moving a project to a new location:

```bash
# In old project
cd ~/projects/old-location
polka memory export --scope project > old-memory.json

# In new project
cd ~/projects/new-location
polka memory import old-memory.json
```

## API Usage

Memory is also available programmatically:

```typescript
import { SQLiteMemoryStore } from '@polka-codes/cli-shared'

const store = new SQLiteMemoryStore(
  { enabled: true, type: 'sqlite', path: '~/.config/polka-codes/memory.sqlite' },
  process.cwd()
)

// Create or update
await store.updateMemory('replace', 'my-entry', 'Entry content', {
  entry_type: 'note',
  status: 'open',
  priority: 'high',
  tags: 'important'
})

// Read
const content = await store.readMemory('my-entry')

// Query
const todos = await store.queryMemory({
  type: 'todo',
  status: 'open'
}, { operation: 'select' })

// Cleanup
store.close()
```

## Best Practices

1. **Regular Backups**: Export memory regularly, especially before major changes
2. **Meaningful Names**: Use descriptive, unique names for entries
3. **Consistent Types**: Use appropriate entry types (todo, bug, decision, note)
4. **Tag Organization**: Use tags to group related entries
5. **Status Tracking**: Update status as work progresses
6. **Priority Levels**: Use priority to indicate urgency

## Limitations

- **Database Path**: Must be within home directory (no parent directory references)
- **Query Limit**: Maximum 10,000 entries per query (configurable)
- **Concurrency**: Only one writer at a time (multiple readers OK)
- **Scale**: Optimized for <10,000 entries per project

## Future Enhancements

Planned improvements:

- [ ] Full-text search with FTS5
- [ ] Memory expiration/TTL
- [ ] Memory compression for old entries
- [ ] Memory export to Markdown
- [ ] Memory search across all scopes
- [ ] Memory analytics and insights
