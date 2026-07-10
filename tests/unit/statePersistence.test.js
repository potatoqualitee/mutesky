import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        auth: { session: null },
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

vi.mock('../../js/renderer.js', () => ({
    renderInterface: vi.fn()
}));

import { state, serializeState, getStorageKey } from '../../js/state.js';
import { renderInterface } from '../../js/renderer.js';
import { setupEventListeners } from '../../js/events.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';

beforeEach(() => {
    resetStateWithFixtures();
});

describe('serializeState', () => {
    it('is insensitive to Set insertion order', () => {
        state.activeKeywords.add('gun control');
        state.activeKeywords.add('assault weapon');
        const first = serializeState();

        state.activeKeywords = new Set(['assault weapon', 'gun control']);
        expect(serializeState()).toBe(first);
    });

    it('changes when a keyword is toggled', () => {
        const before = serializeState();
        state.activeKeywords.add('gun control');
        expect(serializeState()).not.toBe(before);
    });

    it('changes when scalar fields change', () => {
        const before = serializeState();
        state.filterLevel = 2;
        expect(serializeState()).not.toBe(before);
    });
});

describe('visibilitychange refocus', () => {
    let events = 0;

    beforeEach(() => {
        // setupEventListeners registers document-level listeners that persist
        // across tests in this file; only register once
        if (events === 0) {
            setupEventListeners();
            events++;
        }
        vi.mocked(renderInterface).mockClear();
    });

    function refocus() {
        document.dispatchEvent(new Event('visibilitychange'));
    }

    it('does not re-render when saved state matches current state', () => {
        localStorage.setItem(getStorageKey(), serializeState());
        refocus();
        expect(renderInterface).not.toHaveBeenCalled();
    });

    it('re-renders exactly once when another tab changed the state', () => {
        const data = JSON.parse(serializeState());
        data.activeKeywords.push('gun control');
        localStorage.setItem(getStorageKey(), JSON.stringify(data));

        refocus();

        expect(state.activeKeywords.has('gun control')).toBe(true);
        expect(renderInterface).toHaveBeenCalledTimes(1);
    });

    it('re-renders when another tab changed the mode', () => {
        const data = JSON.parse(serializeState());
        data.mode = 'advanced';
        localStorage.setItem(getStorageKey(), JSON.stringify(data));

        refocus();

        expect(state.mode).toBe('advanced');
        expect(renderInterface).toHaveBeenCalledTimes(1);
    });

    it('still syncs storage that predates the serializer without a spurious render', () => {
        // Older saves wrote unsorted arrays; identical content in a different
        // order must not count as a change
        const data = JSON.parse(serializeState());
        state.activeKeywords = new Set(['gun control', 'assault weapon']);
        data.activeKeywords = ['gun control', 'assault weapon'].reverse();
        localStorage.setItem(getStorageKey(), JSON.stringify(data));

        refocus();

        expect(state.activeKeywords.size).toBe(2);
        expect(renderInterface).not.toHaveBeenCalled();
    });
});
