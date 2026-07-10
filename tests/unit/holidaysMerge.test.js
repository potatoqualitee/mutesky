import { describe, it, expect, beforeEach } from 'vitest';

import { state } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import { mergeHolidaysIntoState, ensureHolidaysCategory, HOLIDAYS_CONTEXT_ID } from '../../js/api/holidays.js';

const HOLIDAYS = {
    'US Holidays': {
        description: 'test holidays',
        keywords: {
            'Christmas': { weight: 3, description: 'x' },
            'eggnog': { weight: 2, description: 'y' }
        }
    }
};

beforeEach(() => {
    resetStateWithFixtures();
});

describe('mergeHolidaysIntoState', () => {
    it('installs the category and a simple-mode card', () => {
        expect(mergeHolidaysIntoState(state, HOLIDAYS)).toBe(true);
        expect(state.keywordGroups['US Holidays']['US Holidays'].keywords['Christmas'].weight).toBe(3);
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toEqual({
            title: 'US Holidays',
            description: 'test holidays',
            categories: ['US Holidays']
        });
    });

    it('never writes state mutations back into the source data', () => {
        mergeHolidaysIntoState(state, HOLIDAYS);
        state.keywordGroups['US Holidays']['US Holidays'].keywords['scrooge'] = { weight: 1 };
        expect(HOLIDAYS['US Holidays'].keywords['scrooge']).toBeUndefined();
    });

    it('backs off when upstream already ships the category', () => {
        state.keywordGroups['US Holidays'] = {
            'US Holidays': {
                description: 'curated upstream',
                keywords: { 'Christmas': { weight: 1, description: 'curated' } }
            }
        };
        mergeHolidaysIntoState(state, HOLIDAYS);
        // Upstream keywords win untouched
        expect(state.keywordGroups['US Holidays']['US Holidays'].keywords['Christmas'].weight).toBe(1);
        expect(state.keywordGroups['US Holidays']['US Holidays'].keywords['eggnog']).toBeUndefined();
        // But the card still appears since no upstream context shows it
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toBeDefined();
    });

    it('drops the fallback card when an upstream context covers the category', () => {
        state.contextGroups['seasons'] = {
            title: 'Seasonal',
            description: 'upstream card',
            categories: ['US Holidays']
        };
        state.selectedContexts = new Set([HOLIDAYS_CONTEXT_ID]);
        mergeHolidaysIntoState(state, HOLIDAYS);
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toBeUndefined();
        expect(state.selectedContexts.has(HOLIDAYS_CONTEXT_ID)).toBe(false);
    });

    it('registers the new category in a persisted selectedCategories set', () => {
        state.selectedCategories = new Set(['Gun Policy']);
        mergeHolidaysIntoState(state, HOLIDAYS);
        expect(state.selectedCategories.has('US Holidays')).toBe(true);
    });

    it('skips empty or malformed payloads', () => {
        expect(mergeHolidaysIntoState(state, null)).toBe(false);
        expect(mergeHolidaysIntoState(state, {})).toBe(false);
        expect(mergeHolidaysIntoState(state, { X: { keywords: {} } })).toBe(false);
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toBeUndefined();
    });

    it('defers the card until context groups exist, then re-attaches', () => {
        state.contextGroups = {};
        expect(mergeHolidaysIntoState(state, HOLIDAYS)).toBe(true);
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toBeUndefined();

        state.contextGroups = { violence: { title: 'V', categories: ['Gun Policy'] } };
        mergeHolidaysIntoState(state, HOLIDAYS);
        expect(state.contextGroups[HOLIDAYS_CONTEXT_ID]).toBeDefined();
    });

    it('ships a bundled list where every keyword has a valid weight', () => {
        ensureHolidaysCategory();
        const category = state.keywordGroups['US Holidays']['US Holidays'];
        const keywords = Object.entries(category.keywords);
        expect(keywords.length).toBeGreaterThan(50);
        for (const [keyword, data] of keywords) {
            expect(keyword.trim()).toBe(keyword);
            expect([0, 1, 2, 3]).toContain(data.weight);
        }
        // The seasonal-creep flagships stay visible at the Minimal level
        expect(category.keywords['Christmas'].weight).toBe(3);
        expect(category.keywords['Thanksgiving'].weight).toBe(3);
        // The riskiest broad terms only appear at Complete
        expect(category.keywords['turkey'].weight).toBe(0);
        expect(category.keywords['holiday'].weight).toBe(0);
    });
});
