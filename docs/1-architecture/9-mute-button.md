# Mute Button Architecture

## Overview

The mute button is a critical UI component that appears in multiple locations and handles complex state synchronization and bulk operations. This document details its architecture and performance optimizations.

## Core Architecture

### 1. UI Components
```javascript
// Button locations
const elements = {
    muteButton: document.getElementById('muteButton'),        // Main interface
    navMuteButton: document.getElementById('navMuteButton')   // Navigation bar
};
```

### 2. State Synchronization
```javascript
export function updateMuteButton() {
    const buttonText = getButtonText();
    const hasChanges = buttonText !== 'No changes';

    // Update main button
    if (elements.muteButton) {
        elements.muteButton.textContent = buttonText;
        elements.muteButton.classList.toggle('visible', hasChanges);
    }

    // Sync nav button
    if (elements.navMuteButton) {
        elements.navMuteButton.textContent = buttonText;
        elements.navMuteButton.classList.toggle('visible', hasChanges);
    }
}
```

## Bulk Operations

### 1. Disable All Operation
```javascript
// Atomic operation for instant feedback
function handleDisableAll() {
    state.activeKeywords.clear();
    state.lastBulkAction = 'disable';
    updateMuteButton();
}
```

### 2. Enable All Operation
```javascript
function handleEnableAll() {
    // Gather categories
    const allCategories = [
        ...Object.keys(state.keywordGroups),
        ...Object.keys(state.displayConfig.combinedCategories || {})
    ];

    let processedCount = 0;

    // Progressive processing
    function processNextCategory() {
        if (processedCount >= allCategories.length) return;

        const category = allCategories[processedCount++];
        const keywords = keywordCache.getKeywordsForCategory(category);

        // Process in batches
        processBatchKeywords(keywords, keyword => {
            state.activeKeywords.add(keyword);
        });

        // Schedule next batch
        requestAnimationFrame(processNextCategory);
    }

    state.lastBulkAction = 'enable';
    processNextCategory();
}
```

## Performance Optimizations

### 1. Keyword Caching
```javascript
const keywordCache = {
    categoryKeywords: new Map(),
    lastUpdate: 0,
    updateThreshold: 16,  // One frame duration

    getKeywordsForCategory(category) {
        const cached = this.categoryKeywords.get(category);
        if (cached && Date.now() - this.lastUpdate < this.updateThreshold) {
            return cached;
        }

        const keywords = getAllKeywordsForCategory(category);
        this.categoryKeywords.set(category, keywords);
        this.lastUpdate = Date.now();
        return keywords;
    }
};
```

### 2. Batch Processing
```javascript
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

### 3. Debounced Updates
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
        }, 16);
    };
})();
```

## Button States

### 1. Text Calculation
```javascript
function getButtonText() {
    const { toMute, toUnmute } = getMuteUnmuteCounts();

    if (toMute === 0 && toUnmute === 0) {
        return 'No changes';
    }

    const parts = [];
    if (toMute > 0) parts.push(`Mute ${toMute} new`);
    if (toUnmute > 0) parts.push(`Unmute ${toUnmute} existing`);

    return parts.join(', ');
}
```

### 2. Visibility Control
```javascript
function updateButtonVisibility() {
    const hasChanges = getButtonText() !== 'No changes';
    elements.muteButton?.classList.toggle('visible', hasChanges);
    elements.navMuteButton?.classList.toggle('visible', hasChanges);
}
```

## Implementation Benefits

1. UI Consistency
   - Synchronized state across button instances
   - Clear visual feedback
   - Consistent button text
   - Proper visibility states

2. Performance
   - Responsive during bulk operations
   - No UI blocking
   - Smooth animations
   - Efficient memory usage

3. User Experience
   - Progressive feedback
   - Clear operation status
   - Responsive interface
   - Predictable behavior

## Best Practices

1. State Updates
   - Use debounced updates
   - Batch operations
   - Cache calculations
   - Maintain consistency

2. Performance
   - Process in chunks
   - Use requestAnimationFrame
   - Implement caching
   - Optimize memory usage

3. UI Feedback
   - Show clear status
   - Update progressively
   - Maintain responsiveness
   - Handle edge cases

4. Error Prevention
   - Validate state
   - Handle missing elements
   - Clear timeouts
   - Cancel animations
