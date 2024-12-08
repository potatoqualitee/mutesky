# Understanding MuteSky's Authentication

## How Authentication Works

When you use MuteSky, you're actually connecting it to your Bluesky account. Think of it like giving a trusted assistant permission to help manage your muted keywords. Here's how it works:

## The Login Process

1. **Enter Your Handle**
   - Type in your Bluesky handle (like @you.bsky.social)
   - MuteSky uses this to start the connection process
   - It's like telling the system "This is who I am"

2. **Authorize with Bluesky**
   - You'll be taken to Bluesky's website
   - Bluesky asks "Do you want to let MuteSky help manage your mutes?"
   - You approve the connection
   - It's like giving MuteSky a special key to help manage your mutes

3. **Back to MuteSky**
   - After approval, you return to MuteSky
   - You'll see a loading screen while we:
     * Set up your connection
     * Load your current muted keywords
     * Prepare your personalized interface

## What's Happening Behind the Scenes

1. **Secure Connection**
   - MuteSky gets a secure token from Bluesky
   - Like a special pass that proves you gave permission
   - This token is handled securely and never stored permanently

2. **Session Management**
   - Your session stays active while you use MuteSky
   - If it expires, we automatically refresh it
   - You don't need to keep logging in

3. **Error Handling**
   - If something goes wrong, you'll see clear error messages
   - We automatically try to fix connection issues
   - You can always try logging in again if needed

## Common Questions

### "Do I need to log in every time?"
No! Your session persists until you:
- Click "Sign Out"
- Clear your browser data
- The session naturally expires (we handle renewal automatically)

### "Is it safe to authorize MuteSky?"
Yes! MuteSky:
- Only asks for permissions it needs
- Never stores your Bluesky password
- Uses secure OAuth (the same system many apps use)
- Can only help manage mutes, nothing else

### "What if I see an error?"
Most errors can be fixed by:
1. Refreshing the page
2. Signing out and back in
3. Clearing browser cache if needed

### "What happens if I lose connection?"
- MuteSky tries to reconnect automatically
- Your changes are preserved
- You might need to log in again if reconnection fails

## Pro Tips

1. **Stay Signed In**
   - Don't clear browser data if you want to stay logged in
   - MuteSky handles session renewal automatically
   - Your preferences are preserved between sessions

2. **Watch for Status Messages**
   - The app shows clear status updates
   - You'll know exactly what's happening
   - Error messages explain any issues

3. **Handle Errors Gracefully**
   - If you see an error, try refreshing first
   - Sign out and back in if refresh doesn't work
   - Contact support if problems persist

## Security Notes

1. **What MuteSky Can Do**
   - View your current muted keywords
   - Add or remove muted keywords
   - That's it! No posting, following, or other actions

2. **What MuteSky Can't Do**
   - Post on your behalf
   - Follow/unfollow accounts
   - Access your private messages
   - Change your account settings

Remember: MuteSky is designed to be a helpful tool for managing your muted keywords while respecting your privacy and security. You're always in control and can revoke access at any time through your Bluesky settings.
