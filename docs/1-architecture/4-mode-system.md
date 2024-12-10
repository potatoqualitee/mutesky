# Mode System Architecture

## Overview

MuteSky operates in two distinct modes:
- Simple Mode: Context-based filtering with filter levels (0-3)
- Advanced Mode: Direct keyword management

The system maintains consistency between these modes while preserving user preferences.

## Weight System Implementation

### 1. Filter Level System
```javascript
// Map filter levels to thresholds
function getWeightThreshold(filterLevel) {
    switch(filterLevel) {
        case 0: return 3;  // Minimal (most restrictive)
        case 1: return 2;  // Moderate
        case 2: return 1;  // Extensive
        case 3: return 0;  // Complete (most inclusive)
        default: return 3;
    }
}
```

### 2. Filter Level Handler
```javascript
export function handleFilterLevelChange(event) {
    const level = event.detail.level;
    state.filterLevel = level;

    // Store current exceptions
    const currentExceptions = new Set(state.selectedExceptions);

    // Clear and rebuild active keywords
    state.activeKeywords.clear();
    state.selectedContexts.forEach(contextId => {
        const context = state.contextGroups[contextId];
        if (context?.categories) {
            context.categories.forEach(category => {
                if (!currentExceptions.has(category)) {
                    const keywords = getAllKeywordsForCategory(category, true);
                    keywords.forEach(keyword => state.activeKeywords.add(keyword));
                }
            });
        }
    });

    // Restore exceptions and update UI
    state.selectedExceptions = currentExceptions;
    renderInterface();
}
```

## Context System Implementation

### 1. Context Toggle Handler
```javascript
export async function handleContextToggle(contextId) {
    // Store currently unchecked keywords
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    if (state.selectedContexts.has(contextId)) {
        // Unchecking context
        state.selectedContexts.delete(contextId);

        // Remove exceptions for this context
        context.categories.forEach(category => {
            state.selectedExceptions.delete(category);
            cache.invalidateCategory(category);
        });

        // Mark keywords for removal but keep temporarily for getMuteUnmuteCounts
        const keywordsToRemove = new Set();
        for (const category of context.categories) {
            if (!state.selectedExceptions.has(category)) {
                const keywords = cache.getKeywords(category, true);
                for (const keyword of keywords) {
                    if (!uncheckedKeywords.has(keyword)) {
                        keywordsToRemove.add(keyword);
                    }
                }
            }
        }

        // Remove after counts are calculated
        for (const keyword of keywordsToRemove) {
            state.activeKeywords.delete(keyword);
        }
    } else {
        // Checking context
        state.selectedContexts.add(contextId);

        // Add keywords while respecting unchecked state
        for (const category of context.categories) {
            if (!state.selectedExceptions.has(category)) {
                const keywords = cache.getKeywords(category, true);
                for (const keyword of keywords) {
                    if (!uncheckedKeywords.has(keyword)) {
                        state.activeKeywords.add(keyword);
                    }
                }
            }
        }
    }

    // Update UI with debouncing
    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
```

### 2. Exception Handler
```javascript
export async function handleExceptionToggle(category) {
    // Store unchecked state
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    const wasException = state.selectedExceptions.has(category);
    if (wasException) {
        state.selectedExceptions.delete(category);
    } else {
        state.selectedExceptions.add(category);
    }

    cache.invalidateCategory(category);

    // Only rebuild keywords in simple mode
    if (state.mode === 'simple') {
        // Clear and rebuild active keywords
        state.activeKeywords.clear();
        for (const contextId of state.selectedContexts) {
            activateContextKeywords(contextId, cache);
        }

        // Re-apply original muted keywords
        for (const keyword of state.originalMutedKeywords) {
            if (!state.activeKeywords.has(keyword)) {
                state.activeKeywords.add(keyword);
            }
        }

        // Re-apply unchecked status
        for (const keyword of uncheckedKeywords) {
            state.activeKeywords.delete(keyword);
            state.manuallyUnchecked.add(keyword);
        }
    }
}
```

## Mode-Specific State Management

### 1. Simple Mode State Updates
```javascript
export async function updateSimpleModeState() {
    if (!state.authenticated) return;

    // Only rebuild keywords in simple mode
    if (state.mode === 'simple') {
        // Check contexts
        for (const contextId of Array.from(state.selectedContexts)) {
            const contextState = cache.getContextState(contextId);
            if (contextState === 'none') {
                state.selectedContexts.delete(contextId);
            }
        }

        cache.clear();
        rebuildActiveKeywords();
    }

    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
```

### 2. Advanced Mode State
```javascript
export function handleKeywordToggle(keyword, enabled) {
    if (enabled) {
        state.activeKeywords.add(keyword);
        state.manuallyUnchecked.delete(keyword);
    } else {
        state.activeKeywords.delete(keyword);
        state.manuallyUnchecked.add(keyword);
    }

    cache.invalidateCategory(getKeywordCategory(keyword));
    notifyKeywordChanges();
}
```

## State Preservation

### 1. Keyword State Preservation
```javascript
// Store unchecked state before changes
const uncheckedKeywords = new Set(state.manuallyUnchecked);

// Re-apply after changes
for (const keyword of uncheckedKeywords) {
    state.activeKeywords.delete(keyword);
    state.manuallyUnchecked.add(keyword);
}
```

### 2. Context State Tracking
```javascript
getContextState(contextId) {
    const context = state.contextGroups[contextId];
    if (!context?.categories) return 'none';

    let allNone = true;
    for (const category of context.categories) {
        // Skip excepted categories
        if (state.selectedExceptions.has(category)) continue;

        const categoryState = this.getCategoryState(category);
        if (categoryState !== 'none') {
            allNone = false;
            break;
        }
    }
    return allNone ? 'none' : 'partial';
}
```

## Performance Optimizations

### 1. Cache System
```javascript
const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),

    invalidateCategory(category) {
        const now = Date.now();
        if (now - this.lastUpdate < 50) return;
        this.lastUpdate = now;
        this.keywords.delete(category);
        this.categoryStates.delete(category);
        this.contextKeywords.delete(category);
        this.activeKeywordsByCategory.delete(category);
    }
};
```

### 2. Debounced Updates
```javascript
const createDebouncedUpdate = () => {
    let timeout;
    return async (fn) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(async () => {
            await fn();
        }, 16);
    };
};
```

## Best Practices

### 1. State Updates
- Store unchecked state before changes
- Re-apply unchecked state after changes
- Use proper cache invalidation
- Maintain mode-specific behavior

### 2. Performance
- Use caching for expensive operations
- Debounce UI updates
- Throttle cache invalidation
- Batch related operations

### 3. Mode Synchronization
- Respect mode hierarchy
- Preserve exceptions when valid
- Update UI immediately
- Defer persistence to mute/unmute

### 4. Error Prevention
- Validate state before changes
- Handle edge cases properly
- Maintain consistent state
- Provide clear feedback
