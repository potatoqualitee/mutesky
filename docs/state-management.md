# State Management and Safety Flows

## Overview
This document explains how state is managed across the application, particularly focusing on the synchronization between UI state, local storage, and Bluesky's server state.

For detailed information about the custom muting system, keyword management, and UI behavior, see [Custom Muting System](custom-muting-system.md).

## State Layers

### 1. UI State
- **Simple Mode**: High-level context selections (`selectedContexts`)
- **Advanced Mode**: Individual keyword selections (`activeKeywords`)
- Both modes share the same underlying keyword state but present different views

### 2. Local Storage
- Persists selections between page loads
- Stored via `saveState()` in state.js
- Restored via `loadState()` when:
  - Application initializes
  - Window regains focus

### 3. Server State (Bluesky)
- Source of truth for muted keywords
- Synced during initialization and updates
- Verified through double-fetch pattern

## State Synchronization Flow

### Initial Load
```
1. Application starts
   ├─ Load state from localStorage
   ├─ Fetch display config
   └─ Load keyword and context groups

2. Authentication completes
   ├─ Initialize keyword state
   │  └─ Fetch current muted keywords from Bluesky
   ├─ Update simple mode state if needed
   └─ Render interface
```

### Update Flow (Mute Operation)
```
1. User initiates mute operation
   ├─ Get current preferences from Bluesky
   ├─ Apply local changes
   ├─ Update server state
   └─ Verify through second fetch

2. State refresh
   ├─ Fetch updated preferences
   ├─ Update local state
   └─ Re-render interface
```

## Safety Considerations

### Double-Fetch Pattern
The application uses a double-fetch pattern during mute operations:
1. **First Fetch**: Gets current state before update
2. **Update Operation**: Applies changes to server
3. **Second Fetch**: Verifies changes were applied correctly

#### Benefits
- Ensures UI accurately reflects server state
- Catches any partial failures or race conditions
- Provides verification that updates succeeded

#### Trade-offs
- One extra API call per update operation
- Slightly longer operation time
- Acceptable cost since:
  - Updates are infrequent user actions
  - Accuracy is more important than speed
  - Prevents user confusion from mismatched state

### Window Focus Handling
When the window regains focus:
1. Reload state from localStorage
2. If in simple mode:
   - Update simple mode state to sync context selections
   - Ensures high-level checkboxes match underlying keywords
3. Re-render interface

This ensures the UI stays consistent even when the browser may have cleared memory state.

## State Recovery

### Error Handling
- Failed updates show user-friendly error messages
- State remains unchanged if update fails
- Automatic retry is not implemented to avoid confusion

### Session Management
- Session changes clear cached state
- New session triggers fresh state initialization
- Prevents state leakage between users

## Design Decisions

### Why Double-Fetch?
1. **Safety**: Ensures UI matches reality
2. **Verification**: Confirms updates succeeded
3. **Consistency**: Prevents partial state updates
4. **Cost vs Benefit**:
   - Extra API call is acceptable
   - Updates are rare user actions
   - Accuracy is priority

### Why Load State on Focus?
1. **Browser Behavior**: May clear memory
2. **User Experience**: Needs accurate state
3. **Simple Mode**: Requires context sync
4. **Prevention**: Avoids confusion from stale state

## Best Practices

1. **State Updates**
   - Always verify server state after updates
   - Use optimistic updates carefully
   - Provide clear feedback to users

2. **Error Handling**
   - Show clear error messages
   - Maintain last known good state
   - Allow retry of failed operations

3. **Performance**
   - Cache where appropriate
   - Minimize unnecessary refreshes
   - Balance accuracy vs speed

## Documentation Structure
This document focuses on state management flows and safety considerations, while [Custom Muting System](custom-muting-system.md) covers the keyword management system and UI behavior. Together, these documents provide a complete picture of how the application manages and synchronizes state across different layers while maintaining data integrity.
