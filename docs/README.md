# MuteSky Documentation

## Overview

This documentation is organized into three main sections:
1. User Guides - Human-friendly explanations of how MuteSky works
2. Architecture - Technical documentation of system design and implementation
3. Development - Implementation details and troubleshooting guides

## Documentation Structure

### 1. User Guides
Easy-to-understand explanations for users and developers.

1. [Understanding Modes](3-guides/1-understanding-modes.md)
   - Simple vs Advanced Mode explained
   - When to use each mode
   - Real-world examples
   - Pro tips and best practices

2. [Muting Explained](3-guides/2-muting-explained.md)
   - How muting works with Bluesky
   - Keyword preservation
   - Settings and options
   - Common questions answered

3. [State Persistence](3-guides/3-state-persistence.md)
   - When changes are saved
   - What gets saved
   - Real-world examples
   - Troubleshooting guide

### 2. Architecture
Technical documentation for developers.

1. [Core Concepts](1-architecture/1-core-concepts.md)
   - Two-mode system overview
   - State management hierarchy
   - Persistence model
   - Multi-user support

2. [Authentication](1-architecture/2-authentication.md)
   - OAuth implementation
   - Session management
   - Token refresh mechanism
   - Callback system

3. [Muting System](1-architecture/3-muting-system.md)
   - Keyword types and management
   - Muting behavior
   - Case sensitivity handling
   - API integration

4. [Mode System](1-architecture/4-mode-system.md)
   - Simple mode components
   - Advanced mode components
   - Mode synchronization
   - State management

5. [Performance](1-architecture/5-performance.md)
   - Core optimizations
   - Bulk operations
   - State updates
   - Memory management

6. [Click Performance](1-architecture/6-click-performance.md)
   - Set operations optimization
   - Enhanced caching system
   - Deferred UI updates
   - Response time improvements

### 3. Development
Implementation details and troubleshooting.

1. [Known Issues](2-development/1-known-issues.md)
   - Mode-related issues
   - Case sensitivity problems
   - Authentication issues
   - Performance concerns

## Key Concepts

### State Management
- Advanced mode is source of truth
- State only saves on mute/unmute
- DID-specific storage keys
- Case-insensitive comparisons

### Performance
- Set operations for O(1) lookups
- Debounced UI updates
- Progressive bulk operations
- Efficient caching system

### Mode System
- Simple mode: Context-based filtering
- Advanced mode: Direct keyword management
- Synchronized state between modes
- Exception handling for granular control

### Authentication
- Bluesky OAuth integration
- Token refresh mechanism
- Session state management
- Multi-user support

## Contributing

When working with this codebase:

1. State Management
   - Follow the established hierarchy
   - Respect the persistence model
   - Maintain case sensitivity rules
   - Handle exceptions properly

2. Performance
   - Use provided optimization patterns
   - Implement proper caching
   - Follow bulk operation patterns
   - Monitor memory usage

3. Error Handling
   - Follow established patterns
   - Provide clear error messages
   - Implement proper recovery
   - Log relevant context

4. Testing
   - Verify mode transitions
   - Test case sensitivity
   - Check state persistence
   - Monitor performance

## Documentation Updates

When updating documentation:

1. Consider Both Audiences
   - Add/update technical docs in Architecture
   - Add/update user guides in Guides
   - Keep explanations appropriate for each audience

2. Maintain Structure
   - Keep sections focused and concise
   - Include relevant code examples
   - Update the README.md index
   - Cross-reference related sections

3. Include Real-World Context
   - Add practical examples
   - Explain the "why" not just the "how"
   - Address common questions
   - Provide troubleshooting tips
