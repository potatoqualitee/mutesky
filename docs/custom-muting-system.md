# Mutesky Custom Muting System

## Overview

Mutesky provides a specialized keyword muting system that respects user's existing muted keywords while providing a curated list of additional keywords to mute. The system is designed to be non-destructive - it will never remove keywords that users have muted outside of our curated list.

For detailed information about state management, safety considerations, and API flows, see [State Management and Safety Flows](state-management.md).

## Key Concepts

### Keyword Types

1. **Curated Keywords**
   - Keywords from our predefined list
   - Can be muted/unmuted through the UI
   - Case-insensitive matching (e.g., "Biden" matches "biden")
   - Original case from our list is preserved when muting

2. **User's Custom Keywords**
   - Keywords the user has muted outside our list
   - Never shown in UI but tracked in state
   - Preserved during all operations
   - Stored in lowercase for consistent comparison

### State Management

1. **Key State Components**
   - `activeKeywords`: Currently checked keywords from our list (preserves original case)
   - `originalMutedKeywords`: All user's muted keywords in lowercase (includes both custom and managed)
   - `sessionMutedKeywords`: New keywords muted this session
   - `selectedContexts`: Contexts that have any active keywords
   - `selectedExceptions`: Categories that are partially selected

2. **Case Handling**
   - All comparisons are done case-insensitive
   - Original case is preserved when displaying and muting
   - State storage uses lowercase for consistency

### Muting Behavior

1. **Initial Load**
   - Fetches user's currently muted keywords from Bluesky
   - Shows checkmarks only for our keywords that user has muted
   - Preserves all keywords in originalMutedKeywords (lowercase)
   - Maintains original case in activeKeywords for our managed keywords

2. **Unmuting Rules**
   - Can only unmute keywords that exist in our list
   - Case-insensitive matching (e.g., "Pence" in our list matches user's "pence")
   - Never unmutes user's custom keywords
   - Verifies against originalMutedKeywords in lowercase

3. **Muting Rules**
   - Can mute any keyword from our list
   - Preserves case from our list
   - Never affects user's custom keywords
   - Updates both activeKeywords and originalMutedKeywords

### Context and Category Behavior

1. **Context Selection**
   - A context is selected if any of its categories have active keywords
   - A context is fully selected (no exceptions) when all keywords in all its categories are active
   - When a context becomes fully selected, all category exceptions are cleared

2. **Category Exceptions**
   - A category is marked as an exception if some but not all of its keywords are active
   - Exceptions are automatically cleared when all keywords in the category become active
   - When all categories in a context are fully selected, no exceptions remain for that context

## Example Scenarios

### Scenario 1: Mixed Keywords
```
User's muted keywords: ['biden', 'kitty', 'ELON']
Our list includes: ['Biden', 'DeSantis', 'Pence']

State:
originalMutedKeywords: ['biden', 'kitty', 'elon']  // All lowercase
activeKeywords: ['Biden']  // Original case from our list

Initial UI State:
✓ Biden (checkmark, can unmute - matches 'biden')
□ DeSantis (no checkmark, can mute)
□ Pence (no checkmark, can mute)
('kitty' and 'ELON' preserved but not shown)
```

### Scenario 2: Complete Context Selection
```
Context "Political Discord" includes categories:
- "US Political Figures" with keywords ['Biden', 'Trump', 'Harris']
- "Political Organizations" with keywords ['Democrat', 'Republican']

When all keywords are selected:
- Both categories show no exceptions
- Context appears fully selected in Simple mode
- No partial selection indicators shown
```

## Implementation Details

1. **Case-Sensitive State Management**
```javascript
// Store all keywords in lowercase for comparison
userKeywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    state.originalMutedKeywords.add(lowerKeyword);

    // If it's one of our managed keywords, add to activeKeywords with proper case
    const originalCase = ourKeywordsMap.get(lowerKeyword);
    if (originalCase) {
        state.activeKeywords.add(originalCase);
    }
});
```

2. **Safe Keyword Comparison**
```javascript
// Check if keyword exists in our list (case-insensitive)
const wasOriginallyMuted = state.originalMutedKeywords.has(keyword.toLowerCase());
const isInOurList = ourKeywords.has(keyword.toLowerCase());
```

3. **Context Completion Check**
```javascript
// Check if all categories in context are complete
let allCategoriesComplete = true;
context.categories.forEach(category => {
    const categoryKeywords = state.keywordGroups[category] || [];
    const activeInCategory = categoryKeywords.filter(k => activeKeywords.has(k));

    if (activeInCategory.length < categoryKeywords.length) {
        allCategoriesComplete = false;
        state.selectedExceptions.add(category);
    }
});

// If context is complete, clear all exceptions
if (allCategoriesComplete) {
    context.categories.forEach(category => {
        state.selectedExceptions.delete(category);
    });
}
```

## Best Practices

1. **Preserving User Keywords**
   - Store all keywords in lowercase for comparison
   - Maintain original case for display and muting
   - Never modify keywords not in our list
   - Track both custom and managed keywords in state

2. **UI Clarity**
   - Only show manageable keywords in UI
   - Clear button text showing mute/unmute counts
   - Refresh state after operations
   - Log all operations for verification
   - Show clear indicators for complete vs partial selection

3. **Error Prevention**
   - Use case-insensitive comparison for safety checks
   - Preserve original case from our list when muting
   - Verify keyword existence before unmuting
   - Maintain consistent state across operations

## Button States

1. **No Changes**
   - Text: "No changes"
   - When: No keywords selected/deselected

2. **New Mutes**
   - Text: "Mute X new"
   - When: Selected keywords not currently muted

3. **Unmuting**
   - Text: "Unmute Y existing"
   - When: Deselected keywords that were previously muted

4. **Combined**
   - Text: "Mute X new, Unmute Y existing"
   - When: Both muting and unmuting operations pending
