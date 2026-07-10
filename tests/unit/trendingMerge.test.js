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

    it('merges keyword collisions case-insensitively', () => {
        installUpstreamNewDevelopments();
        mergeTrendingIntoState(state, {
            'New Developments': {
                description: 'test',
                keywords: { 'Drone Sightings': { weight: 3, description: 'fresh' } }
            }
        });
        const keywords = state.keywordGroups['New Developments']['New Developments'].keywords;
        expect(keywords['Drone Sightings'].weight).toBe(3);
        expect(keywords['drone sightings']).toBeUndefined();
    });

    it('drops trending keywords already muted by another category', () => {
        installUpstreamNewDevelopments();
        mergeTrendingIntoState(state, {
            'New Developments': {
                description: 'test',
                keywords: {
                    'Gun Control': { weight: 3, description: 'dup of Gun Policy keyword' },
                    'border bill': { weight: 1, description: 'y' }
                }
            }
        });
        const keywords = state.keywordGroups['New Developments']['New Developments'].keywords;
        expect(keywords['Gun Control']).toBeUndefined();
        expect(keywords['border bill']).toBeDefined();
    });

    it('migrates legacy Trending Controversies selections', () => {
        installUpstreamNewDevelopments();
        state.selectedCategories = new Set(['Gun Policy', 'Trending Controversies']);
        state.selectedContexts = new Set(['violence', TRENDING_CONTEXT_ID]);
        mergeTrendingIntoState(state, TRENDING);
        expect(state.selectedCategories.has('Trending Controversies')).toBe(false);
        expect(state.selectedCategories.has('New Developments')).toBe(true);
        // The upstream card covers the category, so the old card id is a ghost
        expect(state.selectedContexts.has(TRENDING_CONTEXT_ID)).toBe(false);
        expect(state.selectedContexts.has('violence')).toBe(true);
    });

    it('keeps a legacy context selection when the fallback card is used', () => {
        // No upstream New Developments card -> fallback card reuses the id
        state.selectedContexts = new Set([TRENDING_CONTEXT_ID]);
        mergeTrendingIntoState(state, TRENDING);
        expect(state.contextGroups[TRENDING_CONTEXT_ID]).toBeDefined();
        expect(state.selectedContexts.has(TRENDING_CONTEXT_ID)).toBe(true);
    });

    it('advances the keywords-updated stamp when trending is newer', () => {
        installUpstreamNewDevelopments();
        state.lastModified = 'Jan 29, 2025, 11:33 PM';
        mergeTrendingIntoState(state, {
            'New Developments': {
                description: 'test',
                updatedAt: '2026-07-10T07:38:25.985Z',
                keywords: { 'border bill': { weight: 1, description: 'y' } }
            }
        });
        expect(new Date(state.lastModified).getFullYear()).toBe(2026);
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
