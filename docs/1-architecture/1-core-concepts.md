# Core Architecture Concepts

## Overview

MuteSky is built around several key architectural concepts that form its foundation:

## State Management

### Core State Components
```javascript
export const state = {
    // Authentication
    authenticated: false,
    did: null,                          // Track current user's DID

    // Mode
    mode: 'simple',                     // 'simple' or 'advanced'

    // Keywords and Groups
    keywordGroups: {},                  // All available keyword groups
    contextGroups: {},                  // All available context groups
    displayConfig: {},                  // UI display configuration

    // Keyword Sets
    activeKeywords: new Set(),          // Currently checked keywords (only from our list)
    originalMutedKeywords: new Set(),   // All user's muted keywords (for safety check)
    sessionMutedKeywords: new Set(),    // New keywords muted this session
    manuallyUnchecked: new Set(),       // Keywords user has manually unchecked (persists across sessions)

    // Selection State
    selectedContexts: new Set(),        // Currently selected contexts
    selectedExceptions: new Set(),      // Categories marked as exceptions
    selectedCategories: new Set(),      // Currently selected categories

    // UI State
    searchTerm: '',                     // Current search filter
    filterMode: 'all',                  // Current filter mode
    menuOpen: false,                    // Menu visibility state
    lastModified: null,                 // Last-Modified header from keywords file

    // Filter Settings
    filterLevel: 0,                     // Current filter level (0=Minimal to 3=Complete)
    lastBulkAction: null                // Track when enable/disable all is used
}
```

### State Persistence

1. Storage Key Generation
```javascript
function getStorageKey() {
    if (!state.did) {
        throw new Error('No DID set in state');
    }
    return `muteskyState-${state.did}`;
}
```

2. Saved State Structure
```javascript
const saveData = {
    activeKeywords: Array.from(state.activeKeywords),
    selectedCategories: Array.from(state.selectedCategories),
    selectedContexts: Array.from(state.selectedContexts),
    selectedExceptions: Array.from(state.selectedExceptions),
    manuallyUnchecked: Array.from(state.manuallyUnchecked),
    mode: state.mode,
    lastModified: state.lastModified,
    filterLevel: state.filterLevel,
    lastBulkAction: state.lastBulkAction
}
```

3. State Loading Process
- Clear existing selections (except manuallyUnchecked)
- Load saved state from localStorage
- Restore case-sensitive keywords using keyword map
- Initialize default values if no saved state
- Preserve manuallyUnchecked across errors

4. Error Recovery
```javascript
try {
    // Load state operations
} catch (error) {
    // Preserve manuallyUnchecked set
    const unchecked = new Set(state.manuallyUnchecked);
    resetState();
    state.manuallyUnchecked = unchecked;
}
```

### State Reset Behavior

1. Preserved State:
   - Authentication (did, authenticated)
   - Mute state (originalMutedKeywords, sessionMutedKeywords)
   - Manual unchecks (manuallyUnchecked)

2. Reset State:
   - Mode (returns to 'simple')
   - Selections (contexts, exceptions, categories)
   - UI state (search, filter, menu)
   - Filter level (returns to 0)

### Cache Management

1. Cache Structure
```javascript
const cache = {
    keywords: new Map(),           // Cached keywords by category
    categoryStates: new Map(),     // Cached category states
    contextKeywords: new Map(),    // Cached context-specific keywords
    activeKeywordsByCategory: new Map(),  // Active keywords per category
    lastUpdate: 0                  // For throttling updates
}
```

2. Cache Invalidation
```javascript
invalidateCategory(category) {
    const now = Date.now();
    if (now - this.lastUpdate < 50) return;
    this.lastUpdate = now;
    // Clear relevant caches
}
```

3. Performance Optimization
```javascript
const debouncedUpdate = (() => {
    let timeout;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            fn();
            notifyKeywordChanges();
        }, 16);
    };
})();
```

## Mode System

### Simple Mode
- Context-based filtering with filter levels (0-3)
- Keywords derived from selected contexts
- Exceptions for granular control
- Filter levels determine keyword thresholds:
  * Level 0 (Minimal) = Most restrictive
  * Level 1 (Moderate) = Balanced filtering
  * Level 2 (Extensive) = Broader inclusion
  * Level 3 (Complete) = Most inclusive

### Advanced Mode
- Direct keyword management
- Source of truth for keyword state
- Maintains original case of keywords
- No automatic keyword rebuilding

### Mode Synchronization
- Advanced mode is source of truth
- Simple mode derives from advanced mode state
- Changes in advanced mode reflect in simple mode
- Exceptions preserved across mode switches

## Best Practices

1. State Operations
   - Always verify DID before state operations
   - Use consistent auth state checking
   - Maintain proper mode hierarchy
   - Defer state saves to explicit actions

2. Error Handling
   - Preserve manuallyUnchecked across errors
   - Handle case sensitivity properly
   - Validate state before operations
   - Provide clear error messages

3. Performance
   - Use cache for expensive calculations
   - Throttle rapid updates (50ms threshold)
   - Clear cache on filter level changes
   - Batch process large operations

4. Mode Management
   - Respect mode hierarchy
   - Preserve exceptions when valid
   - Update UI immediately
   - Defer persistence to mute/unmute
