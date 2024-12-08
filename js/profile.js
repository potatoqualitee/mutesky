import { Agent } from '@atproto/api'

export class ProfileService {
    constructor(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
        this.handle = null; // Store handle for mute count updates
    }

    // Made synchronous - just sets properties
    setSession(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
    }

    async getProfile() {
        // Ensure we're using the latest session
        if (!this.agent || !this.session) throw new Error('Not logged in');

        // Create a fresh agent instance to ensure we're using the latest session
        const agent = new Agent(this.session);

        try {
            const response = await agent.getProfile({
                actor: this.session.did
            });
            return response.data;
        } catch (error) {
            // Check if it's an unauthorized error (401)
            if (error.status === 401) {
                // Dispatch event for session refresh
                const refreshEvent = new CustomEvent('mutesky:session:refresh:needed');
                window.dispatchEvent(refreshEvent);
            }
            console.error('Failed to get profile:', error);
            return null;
        }
    }

    updateUI(profile) {
        if (!profile) return;

        const handleEl = document.getElementById('bsky-handle');
        const dropdownHandleEl = document.getElementById('dropdown-handle');
        const displayNameEl = document.getElementById('user-display-name');
        const profilePic = document.querySelector('.profile-pic');

        if (handleEl) {
            // Store handle for mute count updates
            this.handle = profile.handle;
            handleEl.textContent = `@${profile.handle}`;
        }

        if (dropdownHandleEl) {
            dropdownHandleEl.textContent = `@${profile.handle}`;
        }

        if (displayNameEl) {
            displayNameEl.textContent = profile.displayName || profile.handle;
        }

        if (profilePic && profile.avatar) {
            profilePic.style.backgroundImage = `url(${profile.avatar})`;
            profilePic.style.backgroundSize = 'cover';
            profilePic.style.backgroundPosition = 'center';
        }
    }

    // Updated method to show mute count in both places
    updateMuteCount(count) {
        const muteCountEl = document.getElementById('total-mute-count');
        const handleEl = document.getElementById('bsky-handle');

        if (muteCountEl) {
            muteCountEl.textContent = `${count} muted`;
        }

        if (handleEl && this.handle) {
            handleEl.textContent = `@${this.handle} - ${count} mutes`;
        }
    }

    resetUI() {
        const profilePic = document.querySelector('.profile-pic');
        const handleEl = document.getElementById('bsky-handle');
        const dropdownHandleEl = document.getElementById('dropdown-handle');
        const displayNameEl = document.getElementById('user-display-name');
        const muteCountEl = document.getElementById('total-mute-count');

        if (profilePic) {
            profilePic.style.backgroundImage = 'none';
        }

        if (handleEl) {
            handleEl.textContent = '';
        }

        if (dropdownHandleEl) {
            dropdownHandleEl.textContent = '';
        }

        if (displayNameEl) {
            displayNameEl.textContent = '';
        }

        if (muteCountEl) {
            muteCountEl.textContent = '0 muted';
        }

        this.handle = null; // Clear stored handle
    }
}
