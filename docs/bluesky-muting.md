# Understanding Bluesky's Muting System

## Overview
Bluesky provides a robust keyword muting system through its `app.bsky.actor.putPreferences` endpoint. This document explains how the system works and how to implement it using the @atproto/api package.

## API Structure

### Endpoint
```
PUT https://[host]/xrpc/app.bsky.actor.putPreferences
```

### Authentication
- Requires Bearer token authentication
- Token obtained through OAuth flow using @atproto/oauth-client-browser

### Request Structure
The muting preferences are sent as part of a larger preferences object:

```typescript
interface MutedWord {
  id?: string                                    // Optional unique identifier
  value: string                                  // The word/phrase to mute
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

### Required Packages
```json
{
  "@atproto/api": "^0.13.18",
  "@atproto/oauth-client-browser": "^0.3.2"
}
```

### Authentication Flow
```javascript
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

// Initialize OAuth client
const client = await BrowserOAuthClient.load({
  clientId: `http://localhost?scope=${scopes}&redirect_uri=${redirectUri}`,
  handleResolver: 'https://bsky.social/'
});

// Get session
const result = await client.init();
const session = result.session;
```

### Muting Implementation
```javascript
import { Agent } from '@atproto/api'

class MuteService {
  constructor(session) {
    this.agent = session ? new Agent(session) : null;
  }

  async muteKeyword(keyword) {
    if (!this.agent) throw new Error('Not logged in');

    const prefs = {
      $type: 'app.bsky.actor.defs#mutedWordsPref',
      items: [{
        value: keyword,
        targets: ['content', 'tag'],
        actorTarget: 'all'
      }]
    };

    await this.agent.api.app.bsky.actor.putPreferences({
      preferences: [prefs]
    });
  }
}
```

## Features

### Muting Options
1. **Content Types**
   - Post content
   - Tags/hashtags

2. **Target Scope**
   - All users
   - Exclude following

3. **Advanced Features**
   - Phrase muting (e.g., "white male", "That's it. That's the")
   - Expiration dates
   - Category-based muting

### State Management
- Preferences are stored server-side
- Changes take effect immediately across all Bluesky clients
- Local caching can be implemented for UI responsiveness

## Example Usage

### Basic Keyword Mute
```javascript
await muteService.muteKeyword('javascript');
```

### Phrase Mute with Expiration
```javascript
const prefs = {
  $type: 'app.bsky.actor.defs#mutedWordsPref',
  items: [{
    value: "that's the tweet",
    targets: ['content'],
    actorTarget: 'all',
    expiresAt: '2024-12-31T23:59:59Z'
  }]
};
```

### Category-Based Muting
```javascript
const politicalTerms = ['election', 'vote', 'campaign'];
const prefs = {
  $type: 'app.bsky.actor.defs#mutedWordsPref',
  items: politicalTerms.map(term => ({
    value: term,
    targets: ['content', 'tag'],
    actorTarget: 'all'
  }))
};
```

## Best Practices

1. **Error Handling**
   - Always verify agent/session before making API calls
   - Handle network errors gracefully
   - Provide user feedback for success/failure

2. **Performance**
   - Batch multiple mute operations when possible
   - Cache current mute preferences locally
   - Update UI optimistically

3. **User Experience**
   - Allow users to review muted words
   - Provide clear feedback when content is muted
   - Support easy unmuting
