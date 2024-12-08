# Authentication Architecture

## Overview

MuteSky uses Bluesky's OAuth implementation through the `@atproto/oauth-client-browser` library. The system ensures proper session management, token refresh, and state persistence across user sessions.

## OAuth Flow

1. Initial Setup
```javascript
this.client = await BrowserOAuthClient.load({
    clientId: 'https://mutesky.app/client-metadata.json',
    handleResolver: 'https://bsky.social/'
});
```

2. Sign In Process
   - User enters Bluesky handle
   - App initiates OAuth flow with `client.signIn(handle)`
   - User redirects to Bluesky for authorization
   - Bluesky redirects to callback page
   - Callback processes response and establishes session

## Session Management

### Components

1. AuthService (js/auth.js)
   - Handles OAuth client initialization
   - Manages sign in/out operations
   - Provides session refresh capabilities

2. BlueskyService (js/bluesky.js)
   - Coordinates between services
   - Handles session state changes
   - Manages session refresh events

3. Individual Services
   - Maintain own session references
   - Handle API calls with current session
   - Dispatch refresh events when needed

### Session States

1. No Session
   - Initial app load
   - After sign out
   - After failed authentication

2. Active Session
   - After successful sign in
   - After successful token refresh
   - Contains valid access token

3. Expired Session
   - Token has expired
   - Triggers refresh flow
   - Temporary state during refresh

## Token Refresh Mechanism

1. Detection
```javascript
if (error.status === 401) {
    // Dispatch event for session refresh
    const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
    window.dispatchEvent(refreshEvent);
}
```

2. Handling
```javascript
setupSessionRefreshHandler() {
    window.addEventListener('mutesky:session:refresh:needed', async () => {
        if (this.isRefreshing) return; // Prevent multiple refreshes

        try {
            this.isRefreshing = true;
            const result = await this.auth.refreshSession();
            if (result.success) {
                // Update services with new session
                this.profile.setSession(result.session);
                this.mute.setSession(result.session);
            } else {
                await this.signOut();
            }
        } finally {
            this.isRefreshing = false;
        }
    });
}
```

## Callback System

### 1. Callback Page Structure
```html
<div class="callback-container">
    <h2>Authentication Successful</h2>
    <p class="status-text">✨ Rendering keywords</p>
    <div class="progress-container">
        <div class="progress-bar"></div>
    </div>
    <p id="error" class="error-message"></p>
    <a href="/" class="home-link">Return to app</a>
</div>
```

### 2. Event System
- `mutesky:auth:complete`: Fired when OAuth callback processing finishes
- `mutesky:setup:complete`: Fired when initial data loading finishes

### 3. Error Handling
```javascript
showError(message) {
    this.container.classList.add('error');
    this.titleElement.textContent = 'Authentication Failed';
    this.errorElement.textContent = message;
    this.homeLink.style.display = 'block';
}
```

## Error Handling

1. Token Expiration
   - Detected through 401 responses
   - Triggers automatic refresh attempt
   - Retries failed operation if refresh succeeds
   - Signs out user if refresh fails

2. Network Issues
   - Services clear cached data on errors
   - Errors are logged with context
   - User-friendly error messages displayed

3. Race Conditions
   - Prevents multiple simultaneous refresh attempts
   - Maintains consistent session state across services
   - Cleans up properly on sign out

## Implementation Details

1. Session Storage
   - OAuth client handles token storage
   - Services maintain runtime session references
   - No sensitive data stored in localStorage

2. Service Coordination
```javascript
// Example: Updating services with new session
this.profile.setSession(result.session);
this.mute.setSession(result.session);
this.ui.updateLoginState(true);
```

3. Error Recovery
```javascript
try {
    await operation();
} catch (error) {
    if (error.status === 401) {
        // Trigger refresh flow
        window.dispatchEvent(new CustomEvent('mutesky:session:refresh:needed'));
    }
    // Clear any cached data
    this.cachedData = null;
}
```

## Best Practices

1. Session Management
   - Clear cached data when session changes
   - Handle 401 errors at service level
   - Use event system for refresh coordination
   - Prevent multiple simultaneous refreshes

2. Error Handling
   - Provide clear user feedback
   - Log errors with context
   - Clean up state on failures
   - Handle race conditions

3. Security
   - No sensitive data in localStorage
   - Clear all state on logout
   - Validate session before operations
   - Handle token refresh securely
