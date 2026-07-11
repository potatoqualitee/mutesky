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

import { state, loadState, serializeState, getStorageKey } from '../../js/state.js';
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


describe('per-DID ownership persistence', () => {
    it('round-trips followed intent, provenance, migrations, and managed ownership', () => {
        state.followedContexts.add('violence');
        state.myKeywords.add('Old Topic');
        state.myKeywordProvenance.set('old topic', { origin: 'retired-default' });
        state.appliedCatalogMigrations.add('2026.07.1:retire:old topic');
        state.managedKeywordLedger.set('gun control', { keyword: 'gun control', origin: 'catalog' });

        localStorage.setItem(getStorageKey(), serializeState());
        loadState();

        expect(state.followedContexts).toEqual(new Set(['violence']));
        expect(state.myKeywordProvenance.get('old topic')).toEqual({ origin: 'retired-default' });
        expect(state.appliedCatalogMigrations.has('2026.07.1:retire:old topic')).toBe(true);
        expect(state.managedKeywordLedger.get('gun control'))
            .toEqual({ keyword: 'gun control', origin: 'catalog' });
    });

    it('migrates legacy selected contexts only when followed intent is absent', () => {
        const data = JSON.parse(serializeState());
        data.selectedContexts = ['violence'];
        delete data.followedContexts;
        localStorage.setItem(getStorageKey(), JSON.stringify(data));

        loadState();

        expect(state.followedContexts).toEqual(new Set(['violence']));
    });

    it('preserves an explicitly empty followed list', () => {
        const data = JSON.parse(serializeState());
        data.selectedContexts = ['violence'];
        data.followedContexts = [];
        localStorage.setItem(getStorageKey(), JSON.stringify(data));

        loadState();

        expect(state.selectedContexts).toEqual(new Set(['violence']));
        expect(state.followedContexts).toEqual(new Set());
    });

    it('does not leak sticky opt-outs into a DID with no saved state', () => {
        state.manuallyUnchecked.add('gun control');
        localStorage.setItem(getStorageKey(), serializeState());

        state.did = 'did:plc:second-user';
        loadState();

        expect(state.manuallyUnchecked).toEqual(new Set());
        expect(state.followedContexts).toEqual(new Set());
        expect(state.managedKeywordLedger).toEqual(new Map());
    });

    it('keeps the successful global trending snapshot across tab-state reloads', () => {
        state.currentTrendingKeywords.add('today topic');
        state.trendingSnapshotLoaded = true;
        localStorage.setItem(getStorageKey(), serializeState());

        loadState();

        expect(state.currentTrendingKeywords).toEqual(new Set(['today topic']));
        expect(state.trendingSnapshotLoaded).toBe(true);
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
