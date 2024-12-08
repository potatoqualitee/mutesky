# Muting System Architecture

## Overview

MuteSky provides a specialized keyword muting system that respects user's existing muted keywords while providing a curated list of additional keywords to mute. The system is non-destructive - it never removes keywords that users have muted outside of our curated list.

## Core Components

### 1. MuteService
```javascript
class MuteService {
    constructor(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        this.cachedKeywords = null;
        this.cachedPreferences = null;
    }
}
```

### 2. Mute Settings
```javascript
const settings = loadMuteSettings();
{
    scope: 'all' | 'tags-only',         // Where to apply muting
    duration: number,                    // Mute duration in days
    excludeFollows: boolean             // Whether to exclude followed users
}
```

### 3. Keyword Types

1. **Curated Keywords**
   - From our predefined list
   - Can be muted/unmuted through UI
   - Case-insensitive matching
   - Original case preserved when muting
   - Support mute settings (scope, duration, excludes)

2. **User's Custom Keywords**
   - Muted outside our list
   - Never shown in UI but tracked
   - Preserved during all operations
   - Stored lowercase for comparison
   - Original settings preserved

## Implementation Details

### 1. Keyword Preservation
```javascript
// Separate user's custom keywords
const userCustomKeywords = currentMutedPref.items
    .filter(item => !ourKeywordsSet.has(item.value.toLowerCase()))
    .map(item => ({
        value: item.value,
        targets: item.targets || ['content', 'tag']
    }));

// Create new items for selected keywords
const newManagedItems = selectedKeywords
    .filter(keyword => ourKeywordsSet.has(keyword.toLowerCase()))
    .map(keyword => ({
        value: keyword,
        targets: settings.scope === 'tags-only' ? ['tag'] : ['content', 'tag'],
        ...(settings.excludeFollows && { actorTarget: 'notFollowed' }),
        ...(expiresAt && { expires: expiresAt.toISOString() })
    }));

// Combine preserving user's keywords
const updatedItems = [
    ...userCustomKeywords,    // Preserve all user's custom keywords
    ...newManagedItems        // Only include selected keywords from our list
];
```

### 2. Case Sensitivity Handling
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

### 3. Caching System
```javascript
class MuteService {
    async getMutedKeywords(forceRefresh = false) {
        // Return cached keywords if available
        if (!forceRefresh && this.cachedKeywords !== null) {
            return this.cachedKeywords;
        }

        // Fetch and cache new keywords
        const response = await agent.api.app.bsky.actor.getPreferences();
        this.cachedPreferences = response.data.preferences;
        const mutedWordsPref = this.cachedPreferences.find(
            pref => pref.$type === 'app.bsky.actor.defs#mutedWordsPref'
        );
        this.cachedKeywords = mutedWordsPref?.items?.map(item => item.value) || [];
        return this.cachedKeywords;
    }
}
```

## Muting Operations

### 1. Initial Load
```javascript
async function initializeKeywordState() {
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

### 2. Muting Process
```javascript
async function handleMuteSubmit() {
    // Get current mute settings
    const settings = loadMuteSettings();

    // Apply settings to keywords
    const keywordsToMute = Array.from(state.activeKeywords)
        .filter(k => !state.originalMutedKeywords.has(k.toLowerCase()));

    // Update on Bluesky
    await muteService.updateMutedKeywords(keywordsToMute, ourKeywordsList);

    // Update local state
    keywordsToMute.forEach(k => {
        state.originalMutedKeywords.add(k.toLowerCase());
        state.sessionMutedKeywords.add(k);
    });
}
```

### 3. Unmuting Process
```javascript
// Can only unmute our keywords
function canUnmuteKeyword(keyword) {
    return ourKeywordsMap.has(keyword.toLowerCase());
}

// Preserve user's custom keywords during unmute
const userCustomKeywords = currentMutedPref.items
    .filter(item => !ourKeywordsSet.has(item.value.toLowerCase()));
```

## Error Handling

### 1. Session Errors
```javascript
if (error.status === 401) {
    // Dispatch event for session refresh
    const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
    window.dispatchEvent(refreshEvent);
    // Clear caches
    this.cachedKeywords = null;
    this.cachedPreferences = null;
}
```

### 2. Cache Management
```javascript
setSession(session) {
    this.agent = session ? new Agent(session) : null;
    this.session = session;
    // Clear caches when session changes
    this.cachedKeywords = null;
    this.cachedPreferences = null;
}
```

## Best Practices

1. Keyword Management
   - Store keywords lowercase for comparison
   - Preserve original case for display/muting
   - Never modify user's custom keywords
   - Track both custom and managed keywords
   - Use caching for efficient lookups

2. Error Prevention
   - Validate session before operations
   - Handle case sensitivity properly
   - Verify keyword existence
   - Maintain consistent state
   - Clear caches on errors

3. Performance
   - Cache expensive API calls
   - Batch keyword updates
   - Throttle rapid operations
   - Clear caches appropriately
   - Use efficient data structures

4. User Experience
   - Preserve user preferences
   - Provide clear feedback
   - Handle errors gracefully
   - Maintain responsive UI
   - Show accurate mute counts
