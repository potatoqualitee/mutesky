# Troubleshooting Guide

This guide provides a systematic approach to diagnosing and fixing common issues in MuteSky.

## Problem Categories

### 1. Mode Switching Issues

**Symptoms**:
- Keywords muted in advanced mode show as "to unmute" in simple mode
- Checkboxes in advanced mode check then uncheck after half second
- State inconsistency between modes

**Diagnostic Steps**:
1. Check mode state:
```javascript
console.debug('[Mode] Current mode:', state.mode);
console.debug('[Mode] Active keywords:', state.activeKeywords.size);
console.debug('[Mode] Original muted:', state.originalMutedKeywords.size);
```

2. Verify state hierarchy:
```javascript
// Advanced mode should be source of truth
console.debug('[State] Advanced selections:', {
    activeKeywords: Array.from(state.activeKeywords),
    manuallyUnchecked: Array.from(state.manuallyUnchecked)
});

// Simple mode should derive from this
console.debug('[State] Simple mode state:', {
    selectedContexts: Array.from(state.selectedContexts),
    selectedExceptions: Array.from(state.selectedExceptions)
});
```

### 2. State Management Issues

**Symptoms**:
- Inconsistent state across mode switches
- Lost preferences after operations
- Unexpected state changes

**Diagnostic Steps**:
1. Check state relationships:
```javascript
console.debug('[State] State relationships:', {
    activeKeywords: state.activeKeywords.size,
    originalMuted: state.originalMutedKeywords.size,
    sessionMuted: state.sessionMutedKeywords.size,
    manuallyUnchecked: state.manuallyUnchecked.size
});
```

2. Verify state persistence:
```javascript
// Check storage key
const storageKey = getStorageKey();
console.debug('[Storage] Current key:', storageKey);

// Check saved state
const savedState = localStorage.getItem(storageKey);
console.debug('[Storage] Saved state exists:', !!savedState);
```

### 3. Case Sensitivity Issues

**Symptoms**:
- Keywords not matching case variants
- Duplicate keywords with different cases
- Large payload sizes to Bluesky

**Diagnostic Steps**:
1. Check case handling:
```javascript
// Log case variants
const keyword = 'Example';
console.debug('[Case] Variants:', {
    original: keyword,
    lower: keyword.toLowerCase(),
    stored: state.originalMutedKeywords.has(keyword.toLowerCase()),
    active: state.activeKeywords.has(keyword)
});
```

2. Check payload size:
```javascript
// Log unique keywords
const uniqueKeywords = new Set(
    Array.from(state.activeKeywords).map(k => k.toLowerCase())
);
console.debug('[Payload] Unique keywords:', uniqueKeywords.size);
```

### 4. Authentication Issues

**Symptoms**:
- "No DID set in state" errors
- Inconsistent auth state
- Session refresh problems

**Diagnostic Steps**:
1. Check auth state:
```javascript
console.debug('[Auth] State:', {
    authenticated: state.authenticated,
    did: state.did,
    hasSession: !!session
});
```

2. Verify DID consistency:
```javascript
// Check DID across components
console.debug('[DID] Storage key:', getStorageKey());
console.debug('[DID] State DID:', state.did);
console.debug('[DID] Session DID:', session?.did);
```

## Common Fixes

### 1. Mode Switching Fix
```javascript
export async function updateSimpleModeState() {
    if (!state.authenticated) return;

    // Only rebuild in simple mode
    if (state.mode === 'simple') {
        // Your mode-specific logic here
    }

    await debouncedUpdate(async () => {
        renderInterface();
        await saveState();
    });
}
```

### 2. State Persistence Fix
```javascript
function saveState() {
    if (!state.did) {
        console.error('[State] Cannot save - no DID');
        return;
    }

    const key = getStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify({
            // Your state here
        }));
    } catch (error) {
        console.error('[State] Save failed:', error);
    }
}
```

### 3. Case Sensitivity Fix
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

### 4. Auth State Fix
```javascript
function isAuthenticated() {
    return state.authenticated && state.did;
}

// Use consistently across all files
if (!isAuthenticated()) {
    console.error('[Auth] Not authenticated');
    return;
}
```

## Prevention Checklist

### 1. Mode Switching
- [ ] Verify mode before state rebuilds
- [ ] Respect mode hierarchy
- [ ] Test mode transitions
- [ ] Log state changes

### 2. State Management
- [ ] Check DID before operations
- [ ] Verify state relationships
- [ ] Test persistence
- [ ] Handle errors gracefully

### 3. Case Sensitivity
- [ ] Use lowercase for comparisons
- [ ] Preserve original case
- [ ] Check payload sizes
- [ ] Implement deduplication

### 4. Authentication
- [ ] Verify DID consistency
- [ ] Handle session refresh
- [ ] Test auth flows
- [ ] Log auth state changes

## Debugging Tools

### 1. State Inspector
```javascript
function inspectState() {
    return {
        mode: state.mode,
        auth: {
            authenticated: state.authenticated,
            did: state.did
        },
        keywords: {
            active: state.activeKeywords.size,
            original: state.originalMutedKeywords.size,
            session: state.sessionMutedKeywords.size,
            unchecked: state.manuallyUnchecked.size
        },
        contexts: {
            selected: state.selectedContexts.size,
            exceptions: state.selectedExceptions.size
        }
    };
}
```

### 2. Storage Validator
```javascript
function validateStorage() {
    const key = getStorageKey();
    try {
        const saved = localStorage.getItem(key);
        const parsed = JSON.parse(saved);
        return {
            valid: true,
            data: parsed
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}
```

## Best Practices

1. Always log state changes:
```javascript
console.debug('[State] Before:', inspectState());
// Make changes
console.debug('[State] After:', inspectState());
```

2. Verify auth state consistently:
```javascript
if (!isAuthenticated()) {
    console.error('[Auth] Operation failed - not authenticated');
    return;
}
```

3. Handle errors gracefully:
```javascript
try {
    await operation();
} catch (error) {
    console.error('[Error]', {
        operation: 'name',
        error: error.message,
        state: inspectState()
    });
}
```

4. Test mode transitions thoroughly:
```javascript
async function testModeTransition() {
    console.debug('[Test] Before switch:', inspectState());
    await switchMode(newMode);
    console.debug('[Test] After switch:', inspectState());
}
