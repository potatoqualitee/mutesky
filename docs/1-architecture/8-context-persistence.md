# Context Persistence Architecture

## Core Principle

The fundamental principle is that **advanced mode is the source of truth**, not simple mode. This architectural decision ensures consistent state management and reliable user experience.

## Implementation Architecture

### 1. State Hierarchy
```javascript
// Advanced mode drives the system
state.activeKeywords = new Set();          // Source of truth
state.originalMutedKeywords = new Set();   // All muted keywords
state.manuallyUnchecked = new Set();       // User preferences
state.selectedContexts = new Set();        // UI state
state.selectedExceptions = new Set();      // Exception tracking
```

### 2. Multi-User Support
```javascript
// Storage key format
const storageKey = `muteskyState-${state.did}`;

// User state isolation
class StateManager {
    getStorageKey() {
        if (!state.did) {
            throw new Error('No DID set in state');
        }
        return `muteskyState-${state.did}`;
    }
}
```

### 3. State Flow

#### Initialization
1. Set DID in state when user authenticates
2. Load saved state from DID-specific localStorage key
3. Restore advanced mode selections first
4. If in simple mode:
   - Derive context selections from advanced mode state
   - Generate appropriate keywords from those contexts
5. Maintain manually unchecked keywords across modes
6. Sync with external services (e.g., Bluesky)

#### Updates
```javascript
// Advanced Mode Updates
function handleAdvancedModeUpdate() {
    // Direct modifications preserved
    state.activeKeywords.add(keyword);
    // Changes saved to DID-specific storage
    saveState();
    // Simple mode respects these changes
    updateSimpleModeState();
}

// Simple Mode Updates
function handleSimpleModeUpdate() {
    // Context selections generate keywords
    const contextKeywords = getContextKeywords(contextId);
    // But don't override advanced mode
    contextKeywords.forEach(keyword => {
        if (!state.manuallyUnchecked.has(keyword)) {
            state.activeKeywords.add(keyword);
        }
    });
}
```

## Case Sensitivity Handling

### 1. Comparison Rules
```javascript
// Store lowercase for comparison
const lowerKeyword = keyword.toLowerCase();
state.originalMutedKeywords.add(lowerKeyword);

// Preserve original case for display
const originalCase = ourKeywordsMap.get(lowerKeyword);
if (originalCase) {
    state.activeKeywords.add(originalCase);
}
```

### 2. Implementation Locations
- **state.js**: Case-insensitive comparisons
- **contextUtils.js**: Case-insensitive activation
- **contextCache.js**: Case-insensitive lookups

## Exception Handling

### 1. Bulk Actions
```javascript
// Track bulk actions
state.lastBulkAction = action; // 'enable' or 'disable'

// Clear exceptions on commit
if (state.lastBulkAction) {
    clearExceptions();
    state.lastBulkAction = null;
}
```

### 2. Exception Rules
- Only clear when mute/unmute follows bulk action
- Regular operations preserve exceptions
- Exceptions persist across sessions
- Valid exceptions restored on login

## Cache System

### 1. Memory Management
```javascript
const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),

    shouldInvalidate() {
        const now = Date.now();
        if (now - this.lastUpdate < 50) return false;
        this.lastUpdate = now;
        return true;
    }
};
```

### 2. Performance Features
- Frame-timed updates (16ms)
- Batch processing
- Smart invalidation
- Category-specific caching

## Error Recovery

### 1. State Recovery
```javascript
try {
    loadState();
} catch (error) {
    // Preserve unchecked keywords
    const unchecked = new Set(state.manuallyUnchecked);
    resetState();
    state.manuallyUnchecked = unchecked;
}
```

### 2. Cache Invalidation
```javascript
function invalidateCache() {
    // Clear on mode transitions
    cache.clear();
    // Invalidate affected categories
    affectedCategories.forEach(category => {
        cache.invalidateCategory(category);
    });
}
```

## File Structure

### 1. Core Files
- **contextState.js**: State initialization and updates
- **contextHandlers.js**: Context and exception management
- **contextUtils.js**: Core utilities and processing
- **contextCache.js**: Caching implementation
- **keywordHandlers.js**: Bulk actions and toggles
- **muteHandlers.js**: Mute operations and integration
- **state.js**: Core state structure and persistence

### 2. Key Functions
```javascript
// State Initialization
export async function initializeState() {
    const did = await auth.getDID();
    state.did = did;
    await loadSavedState();
    await initializeUI();
}

// Context Management
export async function handleContextToggle(contextId) {
    const uncheckedKeywords = new Set(state.manuallyUnchecked);
    // Update state while preserving preferences
    updateContextState(contextId, uncheckedKeywords);
    await debouncedUpdate(() => {
        renderInterface();
        saveState();
    });
}
```

## Best Practices

1. State Management
   - Use DID-specific storage keys
   - Derive simple mode from advanced
   - Sync external services when needed
   - Preserve user preferences

2. Error Handling
   - Maintain unchecked keywords
   - Handle mode transitions
   - Implement error boundaries
   - Clear caches appropriately

3. Performance
   - Use efficient data structures
   - Implement proper caching
   - Batch operations
   - Debounce updates

4. Multi-User Support
   - Isolate user states
   - Clean state switching
   - Preserve preferences
   - Handle edge cases
