import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

import { state } from '../../js/state.js';
import { resetStateWithFixtures, keywordsOf } from '../helpers/fixtures.js';
import {
    isManuallyUnchecked,
    clearManuallyUnchecked,
    addKeywordWithCase,
    getCategorySelectionState,
    getContextSelectionState,
    syncDerivedContexts,
    activateCategory,
    deactivateCategory,
    keywordsClaimedBySelection,
    applyFilterLevel,
    applyFollowedContextUpdates,
    seedActiveFromMutedKeywords
} from '../../js/handlers/context/selectionModel.js';

beforeEach(() => {
    resetStateWithFixtures();
});

describe('manuallyUnchecked helpers', () => {
    it('matches case-insensitively', () => {
        state.manuallyUnchecked.add('Gun Control');
        expect(isManuallyUnchecked('gun control')).toBe(true);
        expect(isManuallyUnchecked('GUN CONTROL')).toBe(true);
        expect(isManuallyUnchecked('open carry')).toBe(false);
    });

    it('clears case variants', () => {
        state.manuallyUnchecked.add('Gun Control');
        clearManuallyUnchecked('gun control');
        expect(state.manuallyUnchecked.size).toBe(0);
    });
});

describe('addKeywordWithCase', () => {
    it('replaces existing case variations instead of duplicating', () => {
        state.activeKeywords.add('GUN CONTROL');
        addKeywordWithCase('gun control');
        expect(state.activeKeywords.size).toBe(1);
        expect(state.activeKeywords.has('gun control')).toBe(true);
    });
});

describe('getCategorySelectionState', () => {
    it('returns none/partial/all', () => {
        expect(getCategorySelectionState('Gun Policy')).toBe('none');

        state.activeKeywords.add('gun control');
        expect(getCategorySelectionState('Gun Policy')).toBe('partial');

        keywordsOf('Gun Policy').forEach(k => state.activeKeywords.add(k));
        expect(getCategorySelectionState('Gun Policy')).toBe('all');
    });

    it('only counts keywords at the current filter level', () => {
        state.filterLevel = 0; // threshold 3: only weight-3 keywords count
        state.activeKeywords.add('gun control');
        state.activeKeywords.add('assault weapon');
        expect(getCategorySelectionState('Gun Policy')).toBe('all');
    });
});

describe('getContextSelectionState', () => {
    it('aggregates across categories', () => {
        expect(getContextSelectionState('politics')).toBe('none');

        // Activate all of Gun Policy but none of Political Rhetoric
        keywordsOf('Gun Policy').forEach(k => state.activeKeywords.add(k));
        expect(getContextSelectionState('politics')).toBe('partial');

        keywordsOf('Political Rhetoric').forEach(k => state.activeKeywords.add(k));
        expect(getContextSelectionState('politics')).toBe('all');
    });

    it('skips excepted categories', () => {
        state.selectedExceptions.add('Political Rhetoric');
        keywordsOf('Gun Policy').forEach(k => state.activeKeywords.add(k));
        expect(getContextSelectionState('politics')).toBe('all');
    });

    it('keeps an explicitly selected all-excepted context selected', () => {
        state.selectedContexts.add('health');
        state.selectedExceptions.add('Healthcare and Public Health');
        expect(getContextSelectionState('health')).toBe('all');
        syncDerivedContexts();
        expect(state.selectedContexts.has('health')).toBe(true);
    });

    it('treats an all-excepted unselected context as none', () => {
        state.selectedExceptions.add('Healthcare and Public Health');
        expect(getContextSelectionState('health')).toBe('none');
    });

    it('ignores categories that are empty at the current filter level', () => {
        // World Leaders is all weight 0 -- empty below Complete. It must not
        // pin Global Affairs at partial when every selectable keyword is on.
        state.filterLevel = 0;
        state.activeKeywords.add('culture war'); // all of Political Rhetoric at level 0
        expect(getContextSelectionState('world')).toBe('all');
        syncDerivedContexts();
        expect(state.selectedContexts.has('world')).toBe(true);
    });

    it('counts a level-empty category again once the level includes it', () => {
        state.filterLevel = 3; // weight-0 keywords now in scope
        keywordsOf('Political Rhetoric').forEach(k => state.activeKeywords.add(k));
        expect(getContextSelectionState('world')).toBe('partial');

        keywordsOf('World Leaders').forEach(k => state.activeKeywords.add(k));
        expect(getContextSelectionState('world')).toBe('all');
    });

    it('follows explicit selection when every category is empty at this level', () => {
        state.filterLevel = 0;
        state.selectedExceptions.add('Political Rhetoric'); // only World Leaders left
        expect(getContextSelectionState('world')).toBe('none');

        state.selectedContexts.add('world');
        expect(getContextSelectionState('world')).toBe('all');
    });
});

describe('syncDerivedContexts', () => {
    it('selects exactly the fully-active contexts', () => {
        keywordsOf('Healthcare and Public Health').forEach(k => state.activeKeywords.add(k));
        keywordsOf('Gun Policy').forEach(k => state.activeKeywords.add(k));
        syncDerivedContexts();
        expect(state.selectedContexts.has('health')).toBe(true);
        expect(state.selectedContexts.has('violence')).toBe(true);
        expect(state.selectedContexts.has('politics')).toBe(false); // rhetoric inactive
    });
});

describe('activateCategory', () => {
    it('respects manual opt-outs by default', () => {
        state.manuallyUnchecked.add('open carry');
        activateCategory('Gun Policy');
        expect(state.activeKeywords.has('open carry')).toBe(false);
        expect(state.activeKeywords.has('gun control')).toBe(true);
    });

    it('clears opt-outs on explicit intent', () => {
        state.manuallyUnchecked.add('open carry');
        activateCategory('Gun Policy', { clearUnchecked: true });
        expect(state.activeKeywords.has('open carry')).toBe(true);
        expect(state.manuallyUnchecked.size).toBe(0);
    });

    it('only activates keywords at the current filter level', () => {
        state.filterLevel = 0; // weight >= 3 only
        activateCategory('Gun Policy');
        expect(state.activeKeywords.has('gun control')).toBe(true);
        expect(state.activeKeywords.has('assault weapon')).toBe(true);
        expect(state.activeKeywords.has('open carry')).toBe(false);
    });
});

describe('deactivateCategory', () => {
    it('removes keywords from every filter level (no orphans)', () => {
        state.filterLevel = 3;
        activateCategory('Gun Policy');
        state.filterLevel = 0; // narrow the level afterwards
        deactivateCategory('Gun Policy');
        expect([...state.activeKeywords].filter(k => keywordsOf('Gun Policy').includes(k)))
            .toHaveLength(0);
    });

    it('spares protected keywords claimed by other categories', () => {
        state.selectedContexts.add('politics');
        activateCategory('Political Rhetoric');
        activateCategory('Gun Policy');

        // "assault weapon" is in both Gun Policy and Political Rhetoric
        deactivateCategory('Gun Policy', { protect: keywordsClaimedBySelection() });
        expect(state.activeKeywords.has('assault weapon')).toBe(true);
        expect(state.activeKeywords.has('gun control')).toBe(true); // also claimed by politics->Gun Policy
    });
});

describe('applyFilterLevel', () => {
    it('re-levels selected contexts and preserves outside picks', () => {
        // Select health at Complete level
        state.selectedContexts.add('health');
        activateCategory('Healthcare and Public Health');
        // Advanced-mode pick outside any selected context
        state.activeKeywords.add('culture war');

        state.filterLevel = 0; // Minimal: only weight-3 keywords
        applyFilterLevel();

        expect(state.activeKeywords.has('single payer')).toBe(true);   // weight 3
        expect(state.activeKeywords.has('medicare for all')).toBe(false); // weight 2 removed
        expect(state.activeKeywords.has('public option')).toBe(false);    // weight 1 removed
        expect(state.activeKeywords.has('culture war')).toBe(true);       // untouched
    });

    it('keeps keywords another selected category still includes at this level', () => {
        // politics context claims both Political Rhetoric and Gun Policy
        state.selectedContexts.add('politics');
        state.filterLevel = 3;
        activateCategory('Political Rhetoric');
        activateCategory('Gun Policy');

        // At level 1 (threshold 2): "assault weapon" is weight 2 in Political
        // Rhetoric (kept) and weight 3 in Gun Policy (kept) -- must survive
        state.filterLevel = 1;
        applyFilterLevel();
        expect(state.activeKeywords.has('assault weapon')).toBe(true);
        expect(state.activeKeywords.has('talking points')).toBe(false); // weight 1
    });

    it('respects manual opt-outs when re-adding', () => {
        state.selectedContexts.add('health');
        state.filterLevel = 0;
        activateCategory('Healthcare and Public Health');
        state.manuallyUnchecked.add('public option');

        state.filterLevel = 3;
        applyFilterLevel();
        expect(state.activeKeywords.has('public option')).toBe(false);
        expect(state.activeKeywords.has('medicare for all')).toBe(true);
    });
});

describe('applyFollowedContextUpdates', () => {
    it('stages new in-scope keywords for explicitly followed contexts', () => {
        state.followedContexts.add('health');
        state.filterLevel = 0;
        activateCategory('Healthcare and Public Health');
        state.keywordGroups['Healthcare and Public Health']['Healthcare and Public Health'].keywords['future health fight'] = { weight: 3 };
        state.keywordGroups['Healthcare and Public Health']['Healthcare and Public Health'].keywords['low priority health'] = { weight: 1 };

        applyFollowedContextUpdates();

        expect(state.activeKeywords.has('future health fight')).toBe(true);
        expect(state.activeKeywords.has('low priority health')).toBe(false);
    });

    it('does not claim an external mute that collides with a newly published keyword', () => {
        state.followedContexts.add('health');
        state.originalMutedKeywords.add('future health fight');
        state.keywordGroups['Healthcare and Public Health']['Healthcare and Public Health']
            .keywords['future health fight'] = { weight: 3 };

        applyFollowedContextUpdates();

        expect(state.activeKeywords.has('future health fight')).toBe(false);
        expect(state.managedKeywordLedger.has('future health fight')).toBe(false);
    });

    it('respects category exceptions and sticky keyword opt-outs', () => {
        state.followedContexts.add('politics');
        state.selectedExceptions.add('Gun Policy');
        state.manuallyUnchecked.add('future rhetoric');
        state.keywordGroups['Political Rhetoric']['Political Rhetoric'].keywords['future rhetoric'] = { weight: 3 };

        applyFollowedContextUpdates();

        expect(state.activeKeywords.has('gun control')).toBe(false);
        expect(state.activeKeywords.has('future rhetoric')).toBe(false);
        expect(state.activeKeywords.has('culture war')).toBe(true);
    });

    it('does not turn a partial advanced selection into a subscription', () => {
        state.activeKeywords.add('gun control');
        syncDerivedContexts();
        state.keywordGroups['Gun Policy']['Gun Policy'].keywords['future gun term'] = { weight: 3 };

        applyFollowedContextUpdates();

        expect(state.followedContexts.size).toBe(0);
        expect(state.activeKeywords.has('future gun term')).toBe(false);
    });
});

describe('seedActiveFromMutedKeywords', () => {
    it('seeds only recorded MuteSky ownership and respects opt-outs', () => {
        state.originalMutedKeywords.add('gun control');
        state.originalMutedKeywords.add('single payer');
        state.originalMutedKeywords.add('external phrase');
        state.managedKeywordLedger.set('gun control', { keyword: 'Gun Control', origin: 'catalog' });
        state.managedKeywordLedger.set('single payer', { keyword: 'single payer', origin: 'catalog' });
        state.manuallyUnchecked.add('Single Payer');

        const caseMap = new Map([
            ['gun control', 'Gun Control'],
            ['single payer', 'single payer'],
            ['external phrase', 'External Phrase']
        ]);
        seedActiveFromMutedKeywords(caseMap);

        expect(state.activeKeywords.has('Gun Control')).toBe(true);
        expect(state.activeKeywords.has('single payer')).toBe(false);
        expect(state.activeKeywords.has('external phrase')).toBe(false);
    });

    it('does not duplicate already-active keywords', () => {
        state.activeKeywords.add('Gun Control');
        state.originalMutedKeywords.add('gun control');
        seedActiveFromMutedKeywords();
        expect(state.activeKeywords.size).toBe(1);
    });
});
