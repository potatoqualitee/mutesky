# Known Issues and Solutions

## Mode System Issues

### 1. Checkbox Persistence in Advanced Mode

**Problem**: Checkboxes would visually check for half a second then uncheck themselves.

**Root Cause**: State management conflict between modes where updateSimpleModeState() was rebuilding keywords and losing direct changes.

**Original Code**:
```javascript
// Before the fix:
export async function updateSimpleModeState() {
    // Check contexts
    for (const contextId of Array.from(state.selectedContexts)) {
        const contextState = cache.getContextState(contextId);
        if (contextState === 'none') {
            state.selectedContexts.delete(contextId);
        }
    }

    cache.clear();
    rebuildActiveKeywords(); // <-- This was the problem
}
```

**Flow of the Issue**:
1. Click checkbox in advanced mode -> handleKeywordToggle adds/removes keyword
2. updateSimpleModeState runs
3. rebuildActiveKeywords clears all keywords
4. Rebuilds only from contexts
5. Loses direct checkbox changes

**Solution**:
```javascript
export async function updateSimpleModeState() {
    if (!state.authenticated) return;

    // Only rebuild keywords in simple mode
    if (state.mode === 'simple') {  // <-- Added mode check
        // Check contexts and rebuild keywords
        for (const contextId of Array.from(state.selectedContexts)) {
            const contextState = cache.getContextState(contextId);
            if (contextState === 'none') {
                state.selectedContexts.delete(contextId);
            }
        }

        cache.clear();
        rebuildActiveKeywords();  // <-- Only runs in simple mode now
    }

    // Maintain async performance optimizations
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
```

**Result**:
- Simple mode derives keywords from contexts
- Advanced mode preserves direct modifications
- Both modes maintain expected behavior
- Performance optimizations preserved

## Case Sensitivity Issues

### 1. Duplicate Keywords

**Problem**: Keywords like "Paris Agreement" appearing multiple times with different cases, particularly when switching between modes.

**Root Cause**: Inconsistent case handling across different parts of the codebase, especially during mode transitions and context handling.

**Solution**: Implemented comprehensive case-insensitive handling across all keyword operations:
```javascript
// Helper function for case-insensitive removal
export function removeKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const activeKeyword of state.activeKeywords) {
        if (activeKeyword.toLowerCase() === lowerKeyword) {
            state.activeKeywords.delete(activeKeyword);
            break;
        }
    }
}

// Helper function for case-sensitive addition with deduplication
function addKeywordWithCase(keyword) {
    // First remove any existing case variations
    removeKeyword(keyword);
    // Then add with original case
    state.activeKeywords.add(keyword);
}
```

**Implementation Details**:
- Case-insensitive checks using isKeywordActive()
- Case-insensitive removal using removeKeyword()
- Case-preserving addition using addKeywordWithCase()
- Consistent handling across mode switches and context changes

**Result**:
- No more duplicate keywords with different cases
- Maintains proper keyword counts during mode switches
- Preserves original case for display purposes
- Consistent behavior across all operations

### 2. Payload Size Issues

**Problem**: "413 Payload Too Large" error when sending to Bluesky.

**Root Cause**: Duplicate keywords with different cases inflating payload size.

**Solution**: Case-insensitive deduplication is now handled consistently across all operations, preventing duplicates from being added in the first place.

## Authentication Issues

### 1. Missing DID in State

**Problem**: "No DID set in state" error during state saves.

**Root Cause**: Inconsistent DID handling across components.

**Solution**: Centralized DID management:
```javascript
class AuthService {
    verifyDID() {
        if (!state.did) {
            throw new Error('No DID set in state');
        }
        return state.did;
    }
}
```

### 2. Session State Inconsistency

**Problem**: Different components using different auth state checks.

**Solution**: Standardized auth checking:
```javascript
export function isAuthenticated() {
    return state.authenticated && state.did;
}
```

## State Persistence Issues

### 1. Lost State After Login

**Problem**: User preferences not persisting across sessions.

**Solution**: Implemented proper state restoration flow:
```javascript
async function handleLogin() {
    const did = await auth.getDID();
    state.did = did;
    await loadSavedState();
    await initializeUI();
}
```

### 2. Premature State Saves

**Problem**: State saving before user confirms changes.

**Solution**: Tied state persistence to explicit user actions:
```javascript
async function handleMuteUnmute() {
    await processChanges();
    await saveState();
}
```

## Best Practices for Prevention

### 1. Mode Management
- Verify mode before state rebuilds
- Respect mode hierarchy
- Test mode transitions
- Document mode-specific flows

### 2. State Management
- Centralize DID handling
- Standardize auth checks
- Defer state saves to user actions
- Implement proper error recovery

### 3. Case Sensitivity
- Use case-insensitive storage
- Preserve original case
- Implement deduplication
- Verify payload sizes

### 4. Testing
- Test mode transitions
- Verify state persistence
- Check case handling
- Monitor performance

### 5. Error Handling
- Implement proper error boundaries
- Provide clear error messages
- Handle edge cases
- Log relevant context
