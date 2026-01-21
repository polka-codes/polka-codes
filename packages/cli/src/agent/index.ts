/**
 * Autonomous Agent Module
 *
 * This module provides an autonomous agent system for the Polka Codes CLI.
 * It can work in two modes:
 * - Goal-directed: Takes a high-level goal and breaks it down into executable tasks
 * - Continuous improvement: Automatically discovers and fixes issues in the codebase
 */

// Configuration
export * from './config'
export * from './constants'
export type { DebugLoggerConfig } from './debug-logger'
// Debug logging and progress tracking
export { createDebugLoggerFromEnv, DebugLogger, DebugLoggerChild } from './debug-logger'
export * from './errors'
export { TaskExecutor } from './executor'
export { GoalDecomposer } from './goal-decomposer'
export { HealthMonitor } from './health-monitor'
export type { ContinuousImprovementLoop } from './improvement-loop'
export { createContinuousImprovementLoop } from './improvement-loop'
export { MetricsCollector } from './metrics'
// Main orchestrator
export { AutonomousAgent } from './orchestrator'
export type { TaskPlanner } from './planner'
export { createTaskPlanner } from './planner'
export type { ProgressOptions } from './progress'
export { createMultiProgress, createProgress, createSpinner, formatDuration, MultiProgress, Progress, Spinner } from './progress'
export { type ResourceLimitExceeded, type ResourceLimits, ResourceMonitor } from './resource-monitor'
// Safety systems
export { ApprovalManager } from './safety/approval'
export { SafetyChecker } from './safety/checks'
export { InterruptHandler } from './safety/interrupt'
export { SessionManager } from './session'
// Core components
export { AgentStateManager } from './state-manager'
export type { TaskDiscoveryEngine } from './task-discovery'
export { createTaskDiscoveryEngine } from './task-discovery'
export { TaskHistory } from './task-history'
// Core types and constants
export * from './types'
// Phase 2: Execution components
export { WorkflowAdapter } from './workflow-adapter'
