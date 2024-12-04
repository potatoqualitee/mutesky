# Filter Level Race Condition Fix

## The Problem

A race condition existed between state initialization and component initialization:

```
[SimpleMode] Initializing with filter level: 0  // Component initializes with default value
...
[State] Loading filter level from storage: 2    // State loads correct value from localStorage
[State] Loaded filter level (with fallback): 2  // But component already initialized with 0
```

This caused the UI to show the wrong filter level until the user clicked to change it.

## The Solution

1. Added an updateLevel method to SimpleMode component:
```js
updateLevel(level) {
    if (level === this.currentLevel) return;
    console.log('[SimpleMode] External update changing level from', this.currentLevel, 'to', level);
    this.currentLevel = level;
    this.updateFilterUI();
}
```

2. Added explicit updates in main.js at key lifecycle points:
```js
// After initial state load and UI initialization
const simpleMode = document.querySelector('simple-mode');
if (simpleMode) {
    console.log('[Main] Updating SimpleMode component with loaded filter level:', state.filterLevel);
    simpleMode.updateLevel(state.filterLevel);
}
```

## The Flow

1. Page Load:
```
[SimpleMode] Initializing with filter level: 0     // Component creates with default
[State] Loading filter level from storage: 2       // State loads from localStorage
[Main] Updating SimpleMode component with level: 2 // Main.js updates component
[SimpleMode] External update changing level from 0 to 2
```

2. State Changes:
- SimpleMode component updates state through setActiveLevel()
- Main.js handles filterLevelChange events
- State saves to localStorage
- UI stays in sync through the explicit update flow

## Key Points

1. Component Initialization:
   - SimpleMode starts with default level (0)
   - This is expected as state hasn't loaded yet

2. State Loading:
   - State loads from localStorage
   - Contains the persisted filter level

3. Synchronization:
   - Main.js acts as coordinator
   - Explicitly updates SimpleMode after state loads
   - Also updates after auth changes and visibility changes

4. Benefits:
   - No complex state management needed
   - Clear, predictable initialization flow
   - Easy to maintain and debug with logging
   - Resilient to timing differences

## Logs Example

```
[SimpleMode] Initializing with filter level: 0                    // Initial creation
[State] Loading filter level from storage: 2                      // State loads
[State] Loaded filter level (with fallback): 2
[Main] Updating SimpleMode component with loaded filter level: 2  // Main.js syncs
[SimpleMode] External update changing level from 0 to 2          // Component updates
```

This solution ensures the UI always reflects the correct filter level, regardless of initialization timing.
