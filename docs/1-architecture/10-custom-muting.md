# Custom Muting System Implementation

## Overview

MuteSky's custom muting system is designed to be non-destructive - it respects and preserves user's existing muted keywords while providing a curated list of additional keywords to mute. This document details the implementation specifics and example scenarios.

## Implementation Details

### 1. Keyword Type Handling
```javascript
// Store all keywords in lowercase for comparison
userKeywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    state.originalMutedKeywords.add(lowerKeyword);

    // If it's one of our managed keywords, add to activeKeywords with proper case
    const originalCase = ourKeywordsMap.get(lowerKeyword);
    if (originalCase) {
        state.activeKeywords.add(originalCase);
        cache.invalidateCategory(getKeywordCategory(originalCase));
    }
});
```

### 2. Safe Keyword Comparison
```javascript
// Check if keyword exists in our list (case-insensitive)
const cachedKeywords = cache.getKeywords(category, true);
const wasOriginallyMuted = state.originalMutedKeywords.has(keyword.toLowerCase());
const isInOurList = cachedKeywords.has(keyword.toLowerCase());
```

### 3. Context Completion Check
```javascript
// Check if all categories in context are complete
let allCategoriesComplete = true;
context.categories.forEach(category => {
    const categoryKeywords = cache.getKeywords(category, true);
    const activeInCategory = cache.getActiveKeywordsForCategory(category);

    if (activeInCategory.size < categoryKeywords.size) {
        allCategoriesComplete = false;
        state.selectedExceptions.add(category);
    }
});

// If context is complete, clear all exceptions
if (allCategoriesComplete) {
    context.categories.forEach(category => {
        state.selectedExceptions.delete(category);
        cache.invalidateCategory(category);
    });
}
```

## Example Scenarios

### 1. Mixed Keywords Scenario
```javascript
// Initial State
const userMutedKeywords = ['biden', 'kitty', 'ELON'];
const ourKeywordsList = ['Biden', 'DeSantis', 'Pence'];

// Resulting State
state.originalMutedKeywords = new Set(['biden', 'kitty', 'elon']);  // All lowercase
state.activeKeywords = new Set(['Biden']);  // Original case from our list
cache.keywords = new Map([
    ['politics', new Set(['Biden', 'DeSantis', 'Pence'])]
]);

// UI State
// ✓ Biden (checkmark, can unmute - matches 'biden')
// □ DeSantis (no checkmark, can mute)
// □ Pence (no checkmark, can mute)
// Note: 'kitty' and 'ELON' preserved but not shown
```

### 2. Complete Context Selection
```javascript
// Context Structure
const politicalContext = {
    id: 'political-discord',
    categories: [
        {
            id: 'us-political-figures',
            keywords: ['Biden', 'Trump', 'Harris']
        },
        {
            id: 'political-organizations',
            keywords: ['Democrat', 'Republican']
        }
    ]
};

// When all keywords selected:
// - Both categories show no exceptions
// - Context appears fully selected in Simple mode
// - No partial selection indicators
// - Cache maintains efficient lookup
```

### 3. Partial Selection Handling
```javascript
// Category with some keywords selected
const category = 'us-political-figures';
const keywords = ['Biden', 'Trump', 'Harris'];
const selectedKeywords = ['Biden', 'Trump'];

// Results in:
state.selectedExceptions.add(category);  // Marked as partial
cache.invalidateCategory(category);      // Cache updated
```

## State Transitions

### 1. Initial Load
```javascript
async function initializeState() {
    // Get user's currently muted keywords
    const mutedKeywords = await muteService.getMutedKeywords();

    // Store in lowercase for comparison
    state.originalMutedKeywords = new Set(
        mutedKeywords.map(k => k.toLowerCase())
    );

    // Show checkmarks for our keywords that user has muted
    const ourKeywordsMap = getOurKeywordsMap();
    mutedKeywords.forEach(keyword => {
        const originalCase = ourKeywordsMap.get(keyword.toLowerCase());
        if (originalCase) {
            state.activeKeywords.add(originalCase);
        }
    });
}
```

### 2. Adding New Keywords
```javascript
function addKeyword(keyword) {
    // Preserve case from our list
    const originalCase = ourKeywordsMap.get(keyword.toLowerCase());
    if (originalCase) {
        state.activeKeywords.add(originalCase);
        state.originalMutedKeywords.add(keyword.toLowerCase());
        cache.invalidateCategory(getKeywordCategory(originalCase));
    }
}
```

### 3. Removing Keywords
```javascript
function removeKeyword(keyword) {
    // Only remove if it's in our list
    if (ourKeywordsMap.has(keyword.toLowerCase())) {
        state.activeKeywords.delete(keyword);
        // Note: originalMutedKeywords updated only after API call succeeds
        cache.invalidateCategory(getKeywordCategory(keyword));
    }
}
```

## Edge Cases

### 1. Case Mismatches
```javascript
// User has "BITCOIN" muted
// Our list has "Bitcoin"
// Result: "Bitcoin" shows as checked, preserves our case when toggled
```

### 2. Partial Context Selection
```javascript
// Some keywords in a context are muted externally
// Result: Context shows as partially selected
// Exceptions are properly tracked
```

### 3. Bulk Operations
```javascript
// Enable All with external mutes
// Result: Preserves external mutes
// Updates only our managed keywords
```

## Best Practices

1. Case Sensitivity
   - Always compare in lowercase
   - Preserve original case for display
   - Use consistent case in storage
   - Handle case variants properly

2. State Management
   - Track both managed and custom keywords
   - Preserve user preferences
   - Handle state transitions cleanly
   - Maintain cache consistency

3. Performance
   - Use efficient data structures
   - Implement proper caching
   - Batch operations when possible
   - Handle large datasets gracefully

4. Error Prevention
   - Validate all operations
   - Handle edge cases
   - Preserve user data
   - Maintain consistency
