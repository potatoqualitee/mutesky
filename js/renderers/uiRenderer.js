import { elements } from '../dom.js';
import { state } from '../state.js';
import { blueskyService } from '../bluesky.js';
import { filterKeywordGroups } from '../categoryManager.js';
import { getButtonText } from '../handlers/muteHandlers.js';

export function updateBlueskyUI() {
    // Update handle display if user is logged in
    if (state.authenticated && blueskyService.session) {
        const handle = blueskyService.session.handle || blueskyService.session.sub;
        if (elements.bskyHandle) {
            elements.bskyHandle.textContent = `@${handle}`;
        }
    }

    // Update auth button visibility
    if (elements.authButton) {
        elements.authButton.style.display = state.authenticated ? 'none' : 'block';
    }

    // Update user menu visibility
    if (elements.userMenuDropdown) {
        elements.userMenuDropdown.classList.toggle('visible', state.menuOpen && state.authenticated);
    }
}

export function updateEnableDisableButtons() {
    const searchTerm = state.searchTerm.toLowerCase();
    if (searchTerm) {
        const filteredCount = Object.values(filterKeywordGroups(false))
            .reduce((count, keywords) => count + keywords.length, 0);
        if (elements.enableAllBtn) {
            elements.enableAllBtn.textContent = `Enable (${filteredCount})`;
        }
        if (elements.disableAllBtn) {
            elements.disableAllBtn.textContent = `Disable (${filteredCount})`;
        }
    } else {
        if (elements.enableAllBtn) {
            elements.enableAllBtn.textContent = 'Enable All';
        }
        if (elements.disableAllBtn) {
            elements.disableAllBtn.textContent = 'Disable All';
        }
    }
}

export function updateLastUpdate() {
    if (elements.sidebarLastUpdate) {
        if (state.lastModified) {
            elements.sidebarLastUpdate.textContent = state.lastModified;
        } else {
            elements.sidebarLastUpdate.textContent = 'checking...';
        }
    }
}

export function updateStatusCounts() {
    const total = Object.values(state.keywordGroups).flat().length;
    const active = calculateKeywordCount();

    if (elements.activeCount) {
        elements.activeCount.textContent = `${active}/${total} terms`;
    }
}

export function updateMuteButton() {
    const buttonText = getButtonText();
    const hasChanges = buttonText !== 'No changes';

    if (elements.muteButton) {
        elements.muteButton.textContent = buttonText;
        elements.muteButton.classList.toggle('visible', hasChanges);
    }

    if (elements.navMuteButton) {
        elements.navMuteButton.textContent = buttonText;
        elements.navMuteButton.classList.toggle('visible', hasChanges);
    }
}

function calculateKeywordCount() {
    return state.activeKeywords.size;
}
