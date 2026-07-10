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
    'New Developments': {
        description: 'test',
        keywords: {
            'debt ceiling': { weight: 3, description: 'x' },
            'border bill': { weight: 1, description: 'y' }
        }
    }
};

// Mirror what calm-the-chaos ships: a New Developments category with its own
// curated keywords, plus a context group card that shows it
function installUpstreamNewDevelopments() {
    state.keywordGroups['New Developments'] = {
        'New Developments': {
            description: 'Recently emerging political figures and developing stories',
            keywords: {
                'drone sightings': { weight: 1, description: 'curated' },
                'debt ceiling': { weight: 1, description: 'stale weight' }
            }
        }
    };
    state.contextGroups['new-developments'] = {
        title: 'New Developments',
        description: 'Recent events and emerging stories',
        categories: ['New Developments']
    };
}

beforeEach(() => {
    resetStateWithFixtures();
});

describe('mergeTrendingIntoState', () => {
    it('folds keywords into the existing New Developments category', () => {
        installUpstreamNewDevelopments();
        expect(mergeTrendingIntoState(state, TRENDING)).toBe(true);

        const category = state.keywordGroups['New Developments']['New Developments'];
        // Curated keywords survive, trending ones join them
        expect(category.keywords['drone sightings']).toBeDefined();
        expect(category.keywords['border bill']).toBeDefined();
        // Trending wins on collisions (fresher weight/description)
        expect(category.keywords['debt ceiling'].weight).toBe(3);
        // Curated description is kept
        expect(category.description).toContain('Recently emerging');
    });

    it('does not add a duplicate card when a context group already shows the category', () => {
        installUpstreamNewDevelopments();
        mergeTrendingIntoState(state, TRENDING);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeUndefined();
    });

    it('installs a standalone category and card when upstream lacks them', () => {
        expect(mergeTrendingIntoState(state, TRENDING)).toBe(true);
        expect(state.keywordGroups['New Developments']).toBeDefined();
        expect(state.contextGroups[TRENDING_CONTEXT_ID].categories)
            .toEqual(['New Developments']);
        expect(state.contextGroups[TRENDING_CONTEXT_ID].title).toBe('New Developments');
    });

    it('registers a brand-new category in a persisted selectedCategories set', () => {
        state.selectedCategories = new Set(['Gun Policy']);
        mergeTrendingIntoState(state, TRENDING);
        expect(state.selectedCategories.has('New Developments')).toBe(true);
    });

    it('leaves selectedCategories alone when the category already exists', () => {
        installUpstreamNewDevelopments();
        // User deliberately deselected New Developments in advanced mode
        state.selectedCategories = new Set(['Gun Policy']);
        mergeTrendingIntoState(state, TRENDING);
        expect(state.selectedCategories.has('New Developments')).toBe(false);
    });

    it('skips empty or malformed payloads', () => {
        expect(mergeTrendingIntoState(state, null)).toBe(false);
        expect(mergeTrendingIntoState(state, {})).toBe(false);
        expect(mergeTrendingIntoState(state, { X: { keywords: {} } })).toBe(false);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeUndefined();
    });

    it('defers the fallback card until context groups exist', () => {
        state.contextGroups = {};
        expect(mergeTrendingIntoState(state, TRENDING)).toBe(true);
        expect(state.keywordGroups['New Developments']).toBeDefined();

        // context groups arrive later (fetch race) -- re-merge attaches the card
        state.contextGroups = { violence: { title: 'V', categories: ['Gun Policy'] } };
        mergeTrendingIntoState(state, TRENDING);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeDefined();
    });
});
