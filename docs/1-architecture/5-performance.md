# Performance Optimizations

## Overview

MuteSky implements sophisticated performance optimizations to ensure responsive UI and efficient data handling, particularly for operations involving large sets of keywords and frequent state updates.

## Core Optimizations

### 1. Set Operations
```javascript
// State implementation using Sets for O(1) operations
export const state = {
    activeKeywords: new Set(),          // O(1) lookup
    originalMutedKeywords: new Set(),   // O(1) lookup
    sessionMutedKeywords: new Set(),    // O(1) lookup
    manuallyUnchecked: new Set(),       // O(1) lookup
    selectedContexts: new Set(),        // O(1) lookup
    selectedExceptions: new Set(),      // O(1) lookup
    selectedCategories: new Set()        // O(1) lookup
};

// Example usage
if (state.activeKeywords.has(keyword)) {  // O(1) instead of O(n)
    state.activeKeywords.delete(keyword); // O(1) operation
}
```

### 2. Multi-Level Caching System
```javascript
const cache = {
    keywords: new Map(),
    categoryStates: new Map(),
    contextKeywords: new Map(),
    activeKeywordsByCategory: new Map(),
    lastUpdate: 0,

    getKeywords(category, sortByWeight = false) {
        const key = `${category}-${sortByWeight}`;
        if (!this.keywords.has(key)) {
            this.keywords.set(key, new Set(getAllKeywordsForCategory(category, sortByWeight)));
        }
        return this.keywords.get(key);
    },

    invalidateCategory(category) {
        const now = Date.now();
        if (now - this.lastUpdate < 50) return; // Throttle updates
        this.lastUpdate = now;

        const patterns = [`${category}-true`, `${category}-false`];
        patterns.forEach(p => this.keywords.delete(p));
        this.activeKeywordsByCategory.delete(category);
    }
};
```

### 3. Progressive Processing
```javascript
function processNextCategory() {
    if (processedCount >= allCategories.length) return;

    const category = allCategories[processedCount++];
    const keywords = keywordCache.getKeywordsForCategory(category);

    // Process in chunks
    processBatchKeywords(keywords, keyword => {
        state.activeKeywords.add(keyword);
    });

    // Schedule next chunk
    requestAnimationFrame(processNextCategory);
}

function processBatchKeywords(keywords, operation) {
    const chunkSize = 100;
    const chunks = Array.from(keywords);

    let index = 0;
    function processNextChunk() {
        if (index >= chunks.length) return;

        const end = Math.min(index + chunkSize, chunks.length);
        for (let i = index; i < end; i++) {
            operation(chunks[i]);
        }

        index += chunkSize;
        requestAnimationFrame(processNextChunk);
    }

    processNextChunk();
}
```

### 4. Debounced Updates
```javascript
const debouncedUpdate = (() => {
    let timeout;
    let frameRequest;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(() => {
                fn();
                notifyKeywordChanges();
            });
        }, 16); // One frame duration
    };
})();

// Usage
debouncedUpdate(() => {
    renderInterface();
    saveState();
});
```

## State Update Optimizations

### 1. Batched State Changes
```javascript
// Before: Multiple individual updates
state.activeKeywords.add(keyword1);
state.activeKeywords.add(keyword2);
saveState();
renderInterface();

// After: Batched updates with debouncing
keywords.forEach(k => state.activeKeywords.add(k));
debouncedUpdate(() => {
    saveState();
    renderInterface();
});
```

### 2. Efficient State Persistence
```javascript
const debouncedSave = (() => {
    let timeout;
    return () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            const saveData = {
                activeKeywords: Array.from(state.activeKeywords),
                selectedCategories: Array.from(state.selectedCategories),
                selectedContexts: Array.from(state.selectedContexts),
                selectedExceptions: Array.from(state.selectedExceptions),
                manuallyUnchecked: Array.from(state.manuallyUnchecked),
                mode: state.mode,
                lastModified: state.lastModified,
                targetKeywordCount: state.targetKeywordCount,
                filterLevel: state.filterLevel,
                lastBulkAction: state.lastBulkAction
            };
            try {
                localStorage.setItem(getStorageKey(), JSON.stringify(saveData));
            } catch (error) {
                console.error('Error saving state:', error);
            }
        }, 16);
    };
})();
```

## Memory Management

### 1. Cache Size Control
```javascript
shouldInvalidate() {
    const now = Date.now();
    if (now - this.lastUpdate < 50) return false;
    this.lastUpdate = now;
    return true;
}

invalidateCategory(category) {
    if (!this.shouldInvalidate()) return;
    // Clear relevant caches
    this.keywords.delete(category);
    this.categoryStates.delete(category);
}
```

### 2. Efficient Data Structures
```javascript
// Use Maps for key-value lookups
const keywordCache = {
    categoryKeywords: new Map(),
    lastUpdate: 0,
    updateThreshold: 16
};

// Use Sets for unique collections
const uniqueKeywords = new Set(keywords);
```

## UI Optimizations

### 1. Frame-Aligned Updates
```javascript
function updateUI() {
    requestAnimationFrame(() => {
        renderInterface();
        updateMuteButton();
    });
}
```

### 2. Throttled Operations
```javascript
const throttledUIUpdate = (() => {
    let lastUpdate = 0;
    return (fn) => {
        const now = Date.now();
        if (now - lastUpdate < 16) return;
        lastUpdate = now;
        fn();
    };
})();
```

## Best Practices

### 1. Data Structures
- Use Sets for unique collections
- Maps for key-value lookups
- Batch array operations
- Minimize object creation

### 2. UI Updates
- Debounce rapid changes
- Use requestAnimationFrame
- Batch DOM operations
- Throttle expensive updates

### 3. Memory Management
- Clear unused caches
- Limit cache sizes
- Batch similar operations
- Use efficient structures

### 4. State Operations
- Batch state changes
- Debounce saves
- Use Set operations
- Implement proper throttling

### 5. Error Prevention
- Validate data before processing
- Handle edge cases
- Provide fallbacks
- Monitor performance metrics
