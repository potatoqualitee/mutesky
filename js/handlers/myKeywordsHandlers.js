import { state } from '../state.js';
import { addMyKeywords, removeMyKeyword, getSubmittableKeywords } from '../myKeywords.js';
import { measureJsonBytes, MAX_PREFERENCES_BYTES } from '../mute.js';
import { loadMuteSettings, getExpirationDate } from '../settings/muteSettings.js';
import { renderInterface } from '../renderer.js';
import { escapeHtml, escapeJsAttr } from '../utils/escape.js';
import { notifyKeywordChanges } from './keywords/ui-utils.js';

export function handleMyKeywordsModalToggle() {
    const modal = document.getElementById('my-keywords-modal');
    if (!modal) return;

    modal.classList.toggle('visible');
    if (modal.classList.contains('visible')) {
        setFeedback('');
        renderMyKeywordsModal();
        document.getElementById('my-keywords-input')?.focus();
    }
}

export function handleMyKeywordsAdd() {
    const input = document.getElementById('my-keywords-input');
    if (!input || !input.value.trim()) return;

    const { added, activated, duplicates } = addMyKeywords(input.value);

    const parts = [];
    if (added.length > 0) {
        parts.push(`Added ${added.length} ${added.length === 1 ? 'keyword' : 'keywords'}`);
    }
    if (activated.length > 0) {
        parts.push(`${activated.length} already in MuteSky's lists — checked ${activated.length === 1 ? 'it' : 'them'} instead`);
    }
    if (duplicates.length > 0) {
        parts.push(`${duplicates.length} already in your list`);
    }
    setFeedback(parts.length > 0 ? parts.join(' · ') : 'Nothing to add');

    if (added.length > 0 || activated.length > 0) {
        input.value = '';
        renderMyKeywordsModal();
        renderInterface();
        notifyKeywordChanges();
    }
    input.focus();
}

export function handleMyKeywordsRemove(keyword) {
    if (!removeMyKeyword(keyword)) return;

    // Wording only: the removal is safe either way, this just avoids
    // promising an unmute for a keyword that never reached Bluesky
    const isMuted = state.originalMutedKeywords.has(keyword.toLowerCase());
    setFeedback(isMuted
        ? `Removed "${keyword}" — it will be unmuted when you press Mute`
        : `Removed "${keyword}"`);
    renderMyKeywordsModal();
    renderInterface();
    notifyKeywordChanges();
}

function setFeedback(message) {
    const feedback = document.getElementById('my-keywords-feedback');
    if (feedback) {
        feedback.textContent = message;
        feedback.classList.toggle('visible', Boolean(message));
    }
}

export function renderMyKeywordsModal() {
    renderKeywordList();
    renderUsageMeter();
}

function renderKeywordList() {
    const list = document.getElementById('my-keywords-list');
    if (!list) return;

    if (state.myKeywords.size === 0) {
        list.innerHTML = `
            <p class="my-keywords-empty">
                No keywords yet. Anything you add is muted for you only — it never
                changes MuteSky's shared lists.
            </p>
        `;
        return;
    }

    const keywords = Array.from(state.myKeywords)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    list.innerHTML = keywords.map(keyword => `
        <span class="my-keyword-chip">
            ${escapeHtml(keyword)}
            <button class="my-keyword-remove"
                title="Remove and unmute"
                aria-label="Remove ${escapeHtml(keyword)}"
                onclick="window.myKeywordsHandlers.handleMyKeywordsRemove('${escapeJsAttr(keyword)}')">&times;</button>
        </span>
    `).join('');
}

// Approximate the muted-words payload the next submit would send, against the
// PDS's ~150KB preferences cap. It's an estimate covering the selected
// keywords only — preserved unmanaged mutes and other preference entries
// share the same cap, which is why mute.js still measures the real document
// pre-flight. The meter just keeps big list imports from becoming a
// surprise "too large" error.
function renderUsageMeter() {
    const usage = document.getElementById('my-keywords-usage');
    if (!usage) return;

    const settings = loadMuteSettings();
    const expiresAt = getExpirationDate(settings.duration);
    const items = getSubmittableKeywords().map(value => ({
        value,
        targets: settings.scope === 'tags-only' ? ['tag'] : ['content', 'tag'],
        ...(settings.excludeFollows && { actorTarget: 'notFollowed' }),
        ...(expiresAt && { expires: expiresAt.toISOString() })
    }));

    const bytes = measureJsonBytes(items);
    const percent = Math.min(100, Math.round((bytes / MAX_PREFERENCES_BYTES) * 100));
    const usedKb = (bytes / 1024).toFixed(1);
    const limitKb = Math.floor(MAX_PREFERENCES_BYTES / 1024);

    usage.classList.toggle('warning', percent >= 80);
    usage.title = 'Estimate for your selected keywords only — the rest of your '
        + 'Bluesky settings shares the same limit';
    usage.innerHTML = `
        <div class="usage-bar" role="progressbar" aria-valuenow="${percent}"
            aria-valuemin="0" aria-valuemax="100"
            aria-label="Estimated Bluesky mute storage used">
            <div class="usage-fill" style="width: ${percent}%"></div>
        </div>
        <span class="usage-text">${items.length.toLocaleString()} keywords selected
            &middot; est. ~${usedKb} KB of Bluesky's ${limitKb} KB settings limit (${percent}%)</span>
    `;
}
