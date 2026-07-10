import { describe, it, expect, beforeEach } from 'vitest';

import { state, getMuteUnmuteCounts, loadState } from '../../js/state.js';
import { resetStateWithFixtures, flushUpdates } from '../helpers/fixtures.js';
import {
    MY_KEYWORDS_CATEGORY,
    parseKeywordInput,
    addMyKeywords,
    removeMyKeyword,
    syncMyKeywordsCategory,
    getSubmittableKeywords,
    getManagedKeywordsForSubmit,
    clearRemovedMyKeywords
} from '../../js/myKeywords.js';

beforeEach(() => {
    resetStateWithFixtures();
});

describe('parseKeywordInput', () => {
    it('splits on newlines and commas and trims whitespace', () => {
        expect(parseKeywordInput('foo, bar baz\n  qux  ')).toEqual(['foo', 'bar baz', 'qux']);
    });

    it('collapses inner whitespace and strips leading hashes', () => {
        expect(parseKeywordInput('#spoilers\nsome   phrase')).toEqual(['spoilers', 'some phrase']);
    });

    it('drops empties and case-insensitive duplicates, keeping first case', () => {
        expect(parseKeywordInput('Foo,,foo\n\nFOO')).toEqual(['Foo']);
    });

    it('rejects keywords over the Bluesky length cap', () => {
        expect(parseKeywordInput('x'.repeat(1001))).toEqual([]);
    });
});

describe('addMyKeywords', () => {
    it('adds new keywords, checks them, and projects the synthetic category', () => {
        const result = addMyKeywords('spoilers, Eras Tour');
        expect(result.added).toEqual(['spoilers', 'Eras Tour']);
        expect(state.myKeywords.has('spoilers')).toBe(true);

        const category = state.keywordGroups[MY_KEYWORDS_CATEGORY][MY_KEYWORDS_CATEGORY];
        expect(category.keywords['Eras Tour'].weight).toBe(3);
        expect(state.activeKeywords.has('spoilers')).toBe(true);
        expect(state.activeKeywords.has('Eras Tour')).toBe(true);
    });

    it('activates curated keywords instead of duplicating them', () => {
        state.manuallyUnchecked.add('gun control');
        const result = addMyKeywords('Gun Control');
        expect(result.activated).toEqual(['gun control']);
        expect(result.added).toEqual([]);
        expect(state.myKeywords.size).toBe(0);
        expect(state.activeKeywords.has('gun control')).toBe(true);
        expect(state.manuallyUnchecked.has('gun control')).toBe(false);
    });

    it('reports duplicates already in the list', () => {
        addMyKeywords('spoilers');
        const result = addMyKeywords('SPOILERS');
        expect(result.duplicates).toEqual(['SPOILERS']);
        expect(state.myKeywords.size).toBe(1);
    });

    it('re-adding a removed keyword clears its tombstone', () => {
        addMyKeywords('spoilers');
        state.originalMutedKeywords.add('spoilers');
        removeMyKeyword('spoilers');
        expect(state.removedMyKeywords.has('spoilers')).toBe(true);

        addMyKeywords('Spoilers');
        expect(state.removedMyKeywords.has('spoilers')).toBe(false);
        expect(state.activeKeywords.has('Spoilers')).toBe(true);
    });
});

describe('removeMyKeyword', () => {
    it('removes case-insensitively, unchecks, and tombstones a muted keyword', () => {
        addMyKeywords('Eras Tour');
        state.originalMutedKeywords.add('eras tour');
        expect(removeMyKeyword('eras tour')).toBe(true);

        expect(state.myKeywords.size).toBe(0);
        expect(state.activeKeywords.has('Eras Tour')).toBe(false);
        expect(state.removedMyKeywords.has('eras tour')).toBe(true);
        expect(state.manuallyUnchecked.has('Eras Tour')).toBe(true);
        // Empty list drops the synthetic category entirely
        expect(state.keywordGroups[MY_KEYWORDS_CATEGORY]).toBeUndefined();
    });

    it('leaves no tombstone for a keyword that never reached Bluesky', () => {
        // A lingering tombstone could later delete an identical mute the user
        // creates in Bluesky itself
        addMyKeywords('spoilers');
        expect(removeMyKeyword('spoilers')).toBe(true);

        expect(state.removedMyKeywords.size).toBe(0);
        expect(state.manuallyUnchecked.has('spoilers')).toBe(false);
        expect(state.activeKeywords.has('spoilers')).toBe(false);
    });

    it('returns false for keywords not in the list', () => {
        expect(removeMyKeyword('never added')).toBe(false);
    });
});

describe('submit plumbing', () => {
    it('getSubmittableKeywords filters tombstoned keywords out of the selection', () => {
        addMyKeywords('spoilers');
        state.originalMutedKeywords.add('spoilers');
        removeMyKeyword('spoilers');
        // Simulate mute seeding or Enable All re-activating the string
        state.activeKeywords.add('Spoilers');

        expect(getSubmittableKeywords()).not.toContain('Spoilers');
    });

    it('getManagedKeywordsForSubmit appends tombstones so Bluesky drops them', () => {
        state.removedMyKeywords.add('spoilers');
        const managed = getManagedKeywordsForSubmit(['gun control']);
        expect(managed).toContain('gun control');
        expect(managed).toContain('spoilers');
    });

    it('counts a tombstoned muted keyword as an unmute', () => {
        state.originalMutedKeywords.add('spoilers');
        state.removedMyKeywords.add('spoilers');
        const { toUnmute } = getMuteUnmuteCounts();
        expect(toUnmute).toBe(1);
    });

    it('clearRemovedMyKeywords forgets tombstones after a successful submit', () => {
        state.removedMyKeywords.add('spoilers');
        clearRemovedMyKeywords();
        expect(state.removedMyKeywords.size).toBe(0);
    });
});

describe('persistence and sync', () => {
    it('round-trips myKeywords and tombstones through localStorage', async () => {
        addMyKeywords('spoilers, Eras Tour');
        state.originalMutedKeywords.add('spoilers');
        removeMyKeyword('spoilers');
        await flushUpdates();

        state.myKeywords = new Set();
        state.removedMyKeywords = new Set();
        loadState();

        expect(state.myKeywords).toEqual(new Set(['Eras Tour']));
        expect(state.removedMyKeywords).toEqual(new Set(['spoilers']));
    });

    it('never leaks keywords or tombstones into a DID with no saved state', async () => {
        addMyKeywords('spoilers');
        state.originalMutedKeywords.add('spoilers');
        removeMyKeyword('spoilers');
        addMyKeywords('Eras Tour');
        await flushUpdates();

        // A different account logs in and has nothing saved
        state.did = 'did:plc:other-user';
        loadState();

        expect(state.myKeywords.size).toBe(0);
        expect(state.removedMyKeywords.size).toBe(0);
    });

    it('syncMyKeywordsCategory rebuilds the category after keywordGroups are replaced', () => {
        addMyKeywords('spoilers');
        // A refresh replaces the keywordGroups object wholesale
        state.keywordGroups = {};
        syncMyKeywordsCategory();
        expect(state.keywordGroups[MY_KEYWORDS_CATEGORY][MY_KEYWORDS_CATEGORY].keywords['spoilers'])
            .toBeDefined();
    });

    it('registers the category in a persisted selectedCategories set', () => {
        state.selectedCategories = new Set(['Gun Policy']);
        addMyKeywords('spoilers');
        expect(state.selectedCategories.has(MY_KEYWORDS_CATEGORY)).toBe(true);

        removeMyKeyword('spoilers');
        expect(state.selectedCategories.has(MY_KEYWORDS_CATEGORY)).toBe(false);
    });
});
