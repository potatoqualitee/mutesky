import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

import { state } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import { mergeTrendingIntoState, TRENDING_CONTEXT_ID } from '../../js/api/trending.js';

const TRENDING = {
    'Trending Controversies': {
        description: 'test',
        keywords: {
            'debt ceiling': { weight: 3, description: 'x' },
            'border bill': { weight: 1, description: 'y' }
        }
    }
};

beforeEach(() => {
    resetStateWithFixtures();
});

describe('mergeTrendingIntoState', () => {
    it('installs the category and a simple-mode context card', () => {
        expect(mergeTrendingIntoState(state, TRENDING)).toBe(true);
        expect(state.keywordGroups['Trending Controversies']).toBeDefined();
        expect(state.contextGroups[TRENDING_CONTEXT_ID].categories)
            .toEqual(['Trending Controversies']);
    });

    it('skips empty or malformed payloads', () => {
        expect(mergeTrendingIntoState(state, null)).toBe(false);
        expect(mergeTrendingIntoState(state, {})).toBe(false);
        expect(mergeTrendingIntoState(state, { X: { keywords: {} } })).toBe(false);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeUndefined();
    });

    it('defers the context card until context groups exist', () => {
        state.contextGroups = {};
        expect(mergeTrendingIntoState(state, TRENDING)).toBe(true);
        expect(state.keywordGroups['Trending Controversies']).toBeDefined();

        // context groups arrive later (fetch race) -- re-merge attaches the card
        state.contextGroups = { violence: { title: 'V', categories: ['Gun Policy'] } };
        mergeTrendingIntoState(state, TRENDING);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeDefined();
    });
});
