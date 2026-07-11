import { describe, it, expect, beforeEach } from 'vitest';

import { state, getMuteUnmuteCounts } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import { mergeTrendingIntoState } from '../../js/api/trending.js';
import {
    MANAGED_ORIGIN_CATALOG,
    MANAGED_ORIGIN_MY_KEYWORD,
    MANAGED_ORIGIN_TRENDING,
    buildManagedKeywordLedger,
    getExpiredTrendingKeywordKeys,
    reconcileExpiredTrendingKeywords,
    updateManagedKeywordLedgerAfterSubmit
} from '../../js/managedKeywords.js';
import {
    addMyKeywords,
    getManagedKeywordsForSubmit,
    getSubmittableKeywords
} from '../../js/myKeywords.js';

const TRENDING = {
    'New Developments': {
        description: 'Current trends',
        keywords: {
            'Today Topic': { weight: 3, description: 'Fresh today' }
        }
    }
};

function installSuccessfulTrendingSnapshot() {
    state.currentTrendingKeywords.clear();
    mergeTrendingIntoState(state, TRENDING);
    state.trendingSnapshotLoaded = true;
}

beforeEach(() => {
    resetStateWithFixtures();
});

describe('managed keyword ledger', () => {
    it('records selected catalog and trending keywords with distinct origins', () => {
        installSuccessfulTrendingSnapshot();

        const ledger = buildManagedKeywordLedger([
            'gun control',
            'Today Topic',
            'an external unmanaged mute'
        ]);

        expect(ledger.get('gun control').origin).toBe(MANAGED_ORIGIN_CATALOG);
        expect(ledger.get('today topic').origin).toBe(MANAGED_ORIGIN_TRENDING);
        expect(ledger.has('an external unmanaged mute')).toBe(false);
    });

    it('never bootstraps ownership from an observed same-name mute', () => {
        installSuccessfulTrendingSnapshot();
        state.originalMutedKeywords.add('today topic');

        expect(state.managedKeywordLedger.size).toBe(0);

        delete state.keywordGroups['New Developments'];
        state.currentTrendingKeywords.clear();
        state.trendingSnapshotLoaded = true;
        expect(getExpiredTrendingKeywordKeys()).toEqual(new Set());
    });

    it('turns a disappeared prior trend into a managed, unselected removal', () => {
        installSuccessfulTrendingSnapshot();
        state.originalMutedKeywords.add('today topic');
        state.activeKeywords.add('Today Topic');
        updateManagedKeywordLedgerAfterSubmit(['Today Topic']);

        // A later successful feed no longer contains the phrase.
        delete state.keywordGroups['New Developments'];
        state.currentTrendingKeywords.clear();
        state.trendingSnapshotLoaded = true;

        expect(getExpiredTrendingKeywordKeys()).toEqual(new Set(['today topic']));
        reconcileExpiredTrendingKeywords();

        expect(state.activeKeywords.has('Today Topic')).toBe(false);
        expect(getSubmittableKeywords()).not.toContain('Today Topic');
        expect(getManagedKeywordsForSubmit(['gun control'])).toContain('today topic');
        expect(getMuteUnmuteCounts().toUnmute).toBe(1);
    });

    it('keeps a live trend when the user pins it in My Keywords', () => {
        installSuccessfulTrendingSnapshot();

        const result = addMyKeywords('today topic');

        expect(result.added).toEqual(['Today Topic']);
        expect(state.myKeywords.has('Today Topic')).toBe(true);
        expect(buildManagedKeywordLedger(['Today Topic']).get('today topic').origin)
            .toBe(MANAGED_ORIGIN_MY_KEYWORD);

        delete state.keywordGroups['New Developments'];
        state.currentTrendingKeywords.clear();
        state.trendingSnapshotLoaded = true;

        expect(getExpiredTrendingKeywordKeys()).toEqual(new Set());
        reconcileExpiredTrendingKeywords();
        expect(state.activeKeywords.has('Today Topic')).toBe(true);
    });

    it('does not expire anything when the trending fetch failed', () => {
        state.managedKeywordLedger.set('old trend', {
            keyword: 'Old Trend',
            origin: MANAGED_ORIGIN_TRENDING
        });
        state.activeKeywords.add('Old Trend');
        state.trendingSnapshotLoaded = false;

        expect(getExpiredTrendingKeywordKeys().size).toBe(0);
        reconcileExpiredTrendingKeywords();
        expect(state.activeKeywords.has('Old Trend')).toBe(true);
    });

    it('preserves missing trend ownership across a failed fetch and unrelated submit', () => {
        state.managedKeywordLedger.set('old trend', {
            keyword: 'Old Trend',
            origin: MANAGED_ORIGIN_TRENDING
        });
        state.trendingSnapshotLoaded = false;

        updateManagedKeywordLedgerAfterSubmit(['gun control']);

        expect(state.managedKeywordLedger.get('old trend')).toEqual({
            keyword: 'Old Trend',
            origin: MANAGED_ORIGIN_TRENDING
        });
    });
    it('replaces the ledger after a successful submit', () => {
        installSuccessfulTrendingSnapshot();
        state.managedKeywordLedger.set('obsolete', {
            keyword: 'Obsolete',
            origin: MANAGED_ORIGIN_TRENDING
        });

        updateManagedKeywordLedgerAfterSubmit(['gun control', 'Today Topic']);
        expect(state.managedKeywordLedger.has('obsolete')).toBe(false);
        expect(state.managedKeywordLedger.get('today topic').origin)
            .toBe(MANAGED_ORIGIN_TRENDING);

        updateManagedKeywordLedgerAfterSubmit(['gun control']);
        expect(state.managedKeywordLedger.has('today topic')).toBe(false);
    });
});
