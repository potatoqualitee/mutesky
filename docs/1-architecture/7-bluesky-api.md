# Bluesky API Integration

## Overview

This document details how MuteSky integrates with Bluesky's API, specifically focusing on the muting system implementation through the `app.bsky.actor.putPreferences` endpoint.

## API Specifications

### Endpoint
```
PUT https://[host]/xrpc/app.bsky.actor.putPreferences
```

### Authentication
- Bearer token authentication required
- Token obtained via OAuth flow using @atproto/oauth-client-browser

### Data Structures

```typescript
interface MutedWord {
    id?: string                                    // Optional unique identifier
    value: string                                  // Word/phrase to mute
    targets: ('content' | 'tag')[]                 // Where to apply muting
    actorTarget: 'all' | 'exclude-following'       // Who to apply muting to
    expiresAt?: string                            // Optional expiration date
}

interface MutedWordsPref {
    $type: 'app.bsky.actor.defs#mutedWordsPref'
    items: MutedWord[]
}
```

## Implementation

### Required Dependencies
```json
{
    "@atproto/api": "^0.13.18",
    "@atproto/oauth-client-browser": "^0.3.2"
}
```

### Core Service Implementation
```javascript
import { Agent } from '@atproto/api'

class MuteService {
    constructor(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        this.cachedKeywords = null;
        this.cachedPreferences = null;
    }

    setSession(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        // Clear caches when session changes
        this.cachedKeywords = null;
        this.cachedPreferences = null;
    }

    async getMutedKeywords(forceRefresh = false) {
        if (!this.session) {
            throw new Error('Not logged in');
        }

        if (!forceRefresh && this.cachedKeywords !== null) {
            return this.cachedKeywords;
        }

        const agent = new Agent(this.session);
        const response = await agent.api.app.bsky.actor.getPreferences();
        this.cachedPreferences = response.data.preferences;

        const mutedWordsPref = this.cachedPreferences.find(
            pref => pref.$type === 'app.bsky.actor.defs#mutedWordsPref'
        );

        this.cachedKeywords = mutedWordsPref?.items?.map(item => item.value) || [];
        return this.cachedKeywords;
    }

    async updateMutedKeywords(selectedKeywords, ourKeywordsList) {
        if (!this.session) {
            throw new Error('Not logged in');
        }

        const agent = new Agent(this.session);
        const response = await agent.api.app.bsky.actor.getPreferences();
        this.cachedPreferences = response.data.preferences;

        // Create efficient lookup
        const ourKeywordsSet = new Set(ourKeywordsList.map(k => k.toLowerCase()));

        // Find current muted words pref
        const mutedWordsIndex = this.cachedPreferences.findIndex(
            pref => pref.$type === 'app.bsky.actor.defs#mutedWordsPref'
        );

        // Get current or create new
        const currentMutedPref = mutedWordsIndex >= 0 ?
            this.cachedPreferences[mutedWordsIndex] : {
                $type: 'app.bsky.actor.defs#mutedWordsPref',
                items: []
            };

        // Preserve user's custom keywords
        const userCustomKeywords = currentMutedPref.items
            .filter(item => !ourKeywordsSet.has(item.value.toLowerCase()));

        // Create new items with settings
        const newManagedItems = selectedKeywords
            .filter(keyword => ourKeywordsSet.has(keyword.toLowerCase()))
            .map(keyword => ({
                value: keyword,
                targets: ['content', 'tag'],
                actorTarget: 'all'
            }));

        // Combine preserving user's keywords
        const updatedItems = [
            ...userCustomKeywords,
            ...newManagedItems
        ];

        // Update preferences
        const updatedMutedPref = {
            $type: 'app.bsky.actor.defs#mutedWordsPref',
            items: updatedItems
        };

        if (mutedWordsIndex >= 0) {
            this.cachedPreferences[mutedWordsIndex] = updatedMutedPref;
        } else {
            this.cachedPreferences.push(updatedMutedPref);
        }

        // Update on Bluesky
        await agent.api.app.bsky.actor.putPreferences({
            preferences: this.cachedPreferences
        });

        // Clear caches after successful update
        this.cachedKeywords = null;
        this.cachedPreferences = null;
    }
}
```

## Advanced Features

### 1. Muting Options
```javascript
// Content type targeting
const contentTypeOptions = {
    contentOnly: ['content'],
    tagsOnly: ['tag'],
    both: ['content', 'tag']
};

// Actor targeting
const actorTargetOptions = {
    all: 'all',
    excludeFollowing: 'exclude-following'
};
```

### 2. Expiration Support
```javascript
const muteWithExpiration = {
    value: keyword,
    targets: ['content', 'tag'],
    actorTarget: 'all',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
};
```

### 3. Batch Operations
```javascript
const batchMuteKeywords = async (keywords) => {
    const items = keywords.map(keyword => ({
        value: keyword,
        targets: ['content', 'tag'],
        actorTarget: 'all'
    }));

    const prefs = {
        $type: 'app.bsky.actor.defs#mutedWordsPref',
        items
    };

    await agent.api.app.bsky.actor.putPreferences({
        preferences: [prefs]
    });
};
```

## Error Handling

### 1. Session Errors
```javascript
try {
    await operation();
} catch (error) {
    if (error.status === 401) {
        // Trigger session refresh
        window.dispatchEvent(new CustomEvent('mutesky:session:refresh:needed'));
    }
    // Clear caches
    this.cachedKeywords = null;
    this.cachedPreferences = null;
    throw error;
}
```

### 2. Network Issues
```javascript
try {
    await agent.api.app.bsky.actor.putPreferences(/* ... */);
} catch (error) {
    console.error('API Error:', error);
    // Extract API error message if available
    const apiError = error.message || 'Failed to update muted keywords';
    throw new Error(apiError);
}
```

## Best Practices

1. Error Handling
   - Verify session before API calls
   - Handle network errors gracefully
   - Provide clear error messages
   - Implement proper retry logic

2. Performance
   - Cache muted keywords list
   - Batch multiple mute operations
   - Clear caches on session change
   - Update UI optimistically

3. User Experience
   - Preserve user's custom keywords
   - Handle case sensitivity properly
   - Provide clear feedback
   - Support easy unmuting

4. Security
   - Always use fresh agent instances
   - Clear sensitive data on logout
   - Validate input before API calls
   - Handle session expiration properly
