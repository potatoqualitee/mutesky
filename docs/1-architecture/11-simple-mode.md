# Simple Mode Technical Implementation

## Overview

Simple mode provides an intuitive interface for content filtering through contexts, filter levels, and exceptions. This document details the technical implementation of these components.

## Core Components

### 1. Filter Level System
```javascript
class SimpleMode extends HTMLElement {
    constructor() {
        this.currentLevel = 0;  // Default level (Minimal/most restrictive)
    }

    updateLevel(level) {
        if (level === this.currentLevel) return;
        this.currentLevel = level;
        state.filterLevel = level;
        this.updateFilterUI();
    }
}
```

### 2. Weight Threshold System
```javascript
function getWeightThreshold(filterLevel) {
    // Map levels to thresholds (0-3)
    switch(filterLevel) {
        case 0: return 3;  // Minimal (most restrictive)
        case 1: return 2;  // Moderate
        case 2: return 1;  // Extensive
        case 3: return 0;  // Complete (most inclusive)
        default: return 3; // Default to most restrictive
    }
}
```

### 3. Context Management System

#### Context Selection Handler
```javascript
export function handleContextToggle(contextId) {
    if (!state.authenticated) return;

    const isSelected = state.selectedContexts.has(contextId);
    const context = state.contextGroups[contextId];

    // Store unchecked state
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    if (isSelected) {
        // Remove context
        state.selectedContexts.delete(contextId);

        // Clear exceptions
        context.categories.forEach(category => {
            state.selectedExceptions.delete(category);
            cache.invalidateCategory(category);
        });

        // Mark keywords for removal
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

        // Remove after counts calculated
        for (const keyword of keywordsToRemove) {
            state.activeKeywords.delete(keyword);
        }
    } else {
        // Add context
        state.selectedContexts.add(contextId);

        // Add keywords
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

### 4. Exception System

#### Exception Toggle Handler
```javascript
export function handleExceptionToggle(category) {
    if (!state.authenticated) return;

    // Store unchecked state
    const uncheckedKeywords = new Set(state.manuallyUnchecked);

    const wasException = state.selectedExceptions.has(category);
    if (wasException) {
        state.selectedExceptions.delete(category);
    } else {
        state.selectedExceptions.add(category);
    }

    cache.invalidateCategory(category);

    // Rebuild keywords in simple mode
    if (state.mode === 'simple') {
        state.activeKeywords.clear();

        // Rebuild from contexts
        for (const contextId of state.selectedContexts) {
            activateContextKeywords(contextId, cache);
        }

        // Re-apply original muted
        for (const keyword of state.originalMutedKeywords) {
            if (!state.activeKeywords.has(keyword)) {
                state.activeKeywords.add(keyword);
            }
        }

        // Re-apply unchecked
        for (const keyword of uncheckedKeywords) {
            state.activeKeywords.delete(keyword);
            state.manuallyUnchecked.add(keyword);
        }
    }

    // Update UI
    const debouncedUpdate = createDebouncedUpdate();
    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
```

## Performance Optimizations

### 1. Caching System
```javascript
const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),
    lastUpdate: 0,

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

## State Management

### 1. Component State
```javascript
class SimpleMode extends HTMLElement {
    constructor() {
        this.currentLevel = 0;
        this.currentExceptions = new Set();
    }

    connectedCallback() {
        // Restore from last saved state
        this.currentLevel = state.filterLevel;
        this.currentExceptions = new Set(state.selectedExceptions);
        this.setupEventListeners();
    }
}
```

### 2. State Persistence Rules
```javascript
async function handleMuteSubmit() {
    // Process changes
    await processChanges();

    // Save state including:
    // - Filter level
    // - Selected contexts
    // - Active keywords
    // - Exceptions
    await saveState();
}
```

## Event Handling

### 1. Filter Level Changes
```javascript
handleFilterLevelChange(event) {
    const level = parseInt(event.target.value);
    this.updateLevel(level);
    this.updateFilterUI();
    notifyKeywordChanges();
}
```

### 2. Context Changes
```javascript
handleContextChange(event) {
    const contextId = event.target.dataset.context;
    handleContextToggle(contextId);
    this.updateExceptions(this.getActiveExceptions());
}
```

## Best Practices

### 1. State Updates
```javascript
// Always update UI immediately
this.updateFilterUI();

// But defer persistence
debouncedUpdate(async () => {
    renderInterface();
    await saveState();
});
```

### 2. Performance
```javascript
// Use cache for expensive operations
const keywords = cache.getKeywords(category, true);

// Throttle updates
if (now - this.lastUpdate < 50) return;

// Batch operations
processBatchKeywords(keywords, operation);
```

### 3. Error Prevention
```javascript
// Validate all inputs
if (level < 0 || level > 3) return;

// Handle edge cases
if (!context?.categories) return 'none';

// Maintain consistency
if (this.isProcessing) return;
```

## Testing Considerations

### 1. State Transitions
```javascript
// Test level changes
async function testLevelChange() {
    const before = getCurrentState();
    await updateLevel(newLevel);
    const after = getCurrentState();
    assert(validateStateTransition(before, after));
}
```

### 2. Performance Monitoring
```javascript
// Monitor update timing
const start = performance.now();
await operation();
const duration = performance.now() - start;
console.debug(`Operation took ${duration}ms`);
```

### 3. Edge Cases
```javascript
// Test rapid updates
async function testRapidUpdates() {
    for (let i = 0; i < 100; i++) {
        await handleContextToggle(contextId);
    }
}
```

This implementation ensures efficient performance while maintaining a clear and intuitive user interface.
