import { Agent } from '@atproto/api'
import { blueskyService } from './bluesky.js'

export class ProfileService {
    constructor(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
    }

    setSession(session) {
        this.agent = session ? new Agent(session) : null;
        this.session = session;
    }

    async getProfile() {
        if (!this.agent || !this.session) throw new Error('Not logged in');
        try {
            const response = await this.agent.getProfile({
                actor: this.session.did
            });
            return response.data;
        } catch (error) {
            console.error('Failed to get profile:', error);
            return null;
        }
    }

    async updateUI(profile) {
        if (!profile) return;

        const handleEl = document.getElementById('bsky-handle');
        const displayNameEl = document.getElementById('user-display-name');
        const profilePic = document.querySelector('.profile-pic');

        if (handleEl) {
            const userKeywords = await blueskyService.mute.getMutedKeywords();
            handleEl.textContent = `@${profile.handle} - ${userKeywords.length} mutes`;
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

    resetUI() {
        const profilePic = document.querySelector('.profile-pic');
        const handleEl = document.getElementById('bsky-handle');
        const displayNameEl = document.getElementById('user-display-name');

        if (profilePic) {
            profilePic.style.backgroundImage = 'none';
        }

        if (handleEl) {
            handleEl.textContent = '';
        }

        if (displayNameEl) {
            displayNameEl.textContent = '';
        }
    }
}
