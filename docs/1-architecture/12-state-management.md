# Centralized State Management System

## Overview

MuteSky uses a centralized state management system to handle user preferences, filter levels, and keyword selections. The system is explicitly tied to user actions to ensure predictable behavior.

## Core Components

### 1. State Structure
```javascript
// state.js
export const state = {
    // Authentication
    authenticated: false,
    did: null,

    // Mode
    mode: 'simple',

    // Keywords
    activeKeywords: new Set(),          // Currently checked keywords
    originalMutedKeywords: new Set(),   // All muted keywords (lowercase)
    sessionMutedKeywords: new Set(),    // New mutes this session
    manuallyUnchecked: new Set(),       // User's manual unchecks

    // Selections
    selectedContexts: new Set(),
    selectedExceptions: new Set(),
    selectedCategories: new Set(),

    // Settings
    filterLevel: 0,
    targetKeywordCount: 100,
    lastBulkAction: null
};
```

### 2. State Persistence Rules

#### When State Saves
```javascript
async function handleMuteSubmit() {
    // Save complete state after mute/unmute
    const saveData = {
        activeKeywords: Array.from(state.activeKeywords),
        selectedCategories: Array.from(state.selectedCategories),
        selectedContexts: Array.from(state.selectedContexts),
        selectedExceptions: Array.from(state.selectedExceptions),
        mode: state.mode,
        filterLevel: state.filterLevel,
        targetKeywordCount: state.targetKeywordCount,
        lastBulkAction: state.lastBulkAction
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(saveData));
}
```

#### What Doesn't Auto-Save
- Filter level changes
- Context toggles
- Exception toggles
- Mode switches
- Individual keyword toggles
- Enable/disable all actions
- Logout operations

### 3. State Restoration Flow

#### Login Restoration
```javascript
async function restoreState() {
    const savedState = localStorage.getItem(getStorageKey());
    if (savedState) {
        const data = JSON.parse(savedState);

        // Restore with proper case handling
        const keywordMap = getKeywordsWithCase();
        state.activeKeywords = new Set(
            data.activeKeywords.map(keyword =>
                keywordMap.get(keyword.toLowerCase()) || keyword
            )
        );

        // Restore selections
        state.selectedCategories = new Set(data.selectedCategories);
        state.selectedContexts = new Set(data.selectedContexts);
        state.selectedExceptions = new Set(data.selectedExceptions);

        // Restore settings
        state.mode = data.mode || 'simple';
        state.filterLevel = data.filterLevel || 0;
        state.targetKeywordCount = data.targetKeywordCount || 100;
        state.lastBulkAction = data.lastBulkAction || null;
    }
}
```

#### Session Management
```javascript
// During session
function handleStateChange() {
    // Update UI immediately
    renderInterface();

    // But don't save until mute/unmute
    notifyKeywordChanges();
}

// On logout
function handleLogout() {
    // Preserve last saved state
    // Don't auto-save current state
    resetUIState();
}
```

## Implementation Details

### 1. Filter Level Management
```javascript
function updateFilterLevel(level) {
    // Update immediately
    state.filterLevel = level;
    state.targetKeywordCount = getTargetCount(level);

    // Update UI
    updateFilterUI();

    // Don't save until mute/unmute
    notifyKeywordChanges();
}

function getTargetCount(level) {
    const targets = {
        0: 100,    // Minimal
        1: 300,    // Moderate
        2: 500,    // Extensive
        3: 2000    // Complete
    };
    return targets[level] || 100;
}
```

### 2. State Change Handlers
```javascript
// Context changes
function handleContextToggle(contextId) {
    const isSelected = state.selectedContexts.has(contextId);
    if (isSelected) {
        state.selectedContexts.delete(contextId);
    } else {
        state.selectedContexts.add(contextId);
    }

    // Update UI only
    renderInterface();
}

// Exception changes
function handleExceptionToggle(category) {
    const wasException = state.selectedExceptions.has(category);
    if (wasException) {
        state.selectedExceptions.delete(category);
    } else {
        state.selectedExceptions.add(category);
    }

    // Update UI only
    renderInterface();
}
```

### 3. Mode Transitions
```javascript
function switchMode(newMode) {
    // Update mode
    state.mode = newMode;

    // Update UI
    if (newMode === 'simple') {
        initializeSimpleMode();
    } else {
        initializeAdvancedMode();
    }

    // Don't save until mute/unmute
    renderInterface();
}
```

## Best Practices

### 1. State Updates
```javascript
// DO: Update UI immediately
function handleChange() {
    updateState();
    renderInterface();
}

// DON'T: Save automatically
function handleChange() {
    updateState();
    saveState();  // Wrong! Wait for mute/unmute
}
```

### 2. User Actions
```javascript
// DO: Allow experimentation
function handleFilterChange(level) {
    updateFilterLevel(level);
    // Don't save - let user experiment
}

// DO: Save on explicit action
async function handleMuteClick() {
    await processChanges();
    await saveState();  // Correct! User explicitly acted
}
```

### 3. State Restoration
```javascript
// DO: Restore from last save
async function initializeState() {
    await restoreState();
    renderInterface();
}

// DON'T: Mix current and saved state
function restoreState() {
    const saved = loadSavedState();
    // Wrong! Don't mix current and saved state
    state.activeKeywords = new Set([
        ...saved.activeKeywords,
        ...state.activeKeywords
    ]);
}
```

## Error Prevention

### 1. State Validation
```javascript
function validateState(state) {
    if (!state.did) {
        throw new Error('No DID set in state');
    }

    if (state.filterLevel < 0 || state.filterLevel > 3) {
        state.filterLevel = 0;  // Reset to safe default
    }
}
```

### 2. Safe State Updates
```javascript
function updateState(changes) {
    // Create backup
    const backup = { ...state };

    try {
        Object.assign(state, changes);
        validateState(state);
    } catch (error) {
        // Restore from backup on error
        Object.assign(state, backup);
        throw error;
    }
}
```

### 3. Consistent State Loading
```javascript
async function loadState() {
    try {
        await restoreState();
    } catch (error) {
        // On error, reset to defaults but preserve DID
        const did = state.did;
        resetState();
        state.did = did;
    }
}
```

This centralized approach ensures consistent state management while maintaining a clear and predictable persistence model.
