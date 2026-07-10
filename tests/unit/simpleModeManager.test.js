import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        auth: { session: null },
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

import { state } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import { updateSimpleModeState } from '../../js/handlers/context/simpleModeManager.js';

function captureKeywordsUpdated(run) {
    let detail = null;
    const listener = (event) => { detail = event.detail; };
    document.addEventListener('keywordsUpdated', listener);
    try {
        run();
    } finally {
        document.removeEventListener('keywordsUpdated', listener);
    }
    return detail;
}

beforeEach(() => {
    resetStateWithFixtures();
});

describe('updateSimpleModeState', () => {
    it('dispatches keywordsUpdated with the current count', () => {
        // <simple-mode>'s >215-keywords warning listens for this event, and
        // startup mute seeding has no other dispatcher on its path
        state.activeKeywords.add('gun control');
        state.activeKeywords.add('culture war');

        const detail = captureKeywordsUpdated(() => updateSimpleModeState());

        expect(detail).toEqual({ count: 2 });
    });

    it('does nothing when unauthenticated', () => {
        state.authenticated = false;
        state.selectedContexts.add('violence');

        const detail = captureKeywordsUpdated(() => updateSimpleModeState());

        expect(detail).toBe(null);
        expect(state.selectedContexts.has('violence')).toBe(true);
    });

    it('derives context selection from active keywords', () => {
        ['gun control', 'second amendment', 'assault weapon', 'open carry']
            .forEach(k => state.activeKeywords.add(k));

        updateSimpleModeState();

        expect(state.selectedContexts.has('violence')).toBe(true);
    });
});
