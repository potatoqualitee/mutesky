import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

import { state, getMuteUnmuteCounts } from '../../js/state.js';
import { resetStateWithFixtures, keywordsOf, flushUpdates } from '../helpers/fixtures.js';
import { handleContextToggle } from '../../js/handlers/context/contextToggleHandler.js';
import { handleExceptionToggle } from '../../js/handlers/context/exceptionToggleHandler.js';
import { updateSimpleModeState } from '../../js/handlers/context/simpleModeManager.js';
import { handleKeywordToggle, handleCategoryToggle } from '../../js/handlers/keywords/core-handlers.js';
import { handleEnableAll, handleDisableAll } from '../../js/handlers/keywords/bulk-handlers.js';
import { getContextSelectionState } from '../../js/handlers/context/selectionModel.js';
import { cache } from '../../js/handlers/context/contextCache.js';

beforeEach(() => {
    resetStateWithFixtures();
    cache.clear();
});

describe('context select/deselect', () => {
    it('selecting a context activates all its keywords at the current level', async () => {
        await handleContextToggle('violence');
        await flushUpdates();

        expect(state.selectedContexts.has('violence')).toBe(true);
        keywordsOf('Gun Policy').forEach(k => {
            expect(state.activeKeywords.has(k)).toBe(true);
        });
    });

    it('deselecting a fully-selected context removes its keywords', async () => {
        await handleContextToggle('violence');
        await handleContextToggle('violence');
        await flushUpdates();

        expect(state.selectedContexts.has('violence')).toBe(false);
        expect(state.activeKeywords.size).toBe(0);
    });

    it('toggles a context containing a level-empty category on and off', async () => {
        // Global Affairs regression: World Leaders is empty below Complete,
        // which used to pin the card at partial -- unselectable and, because
        // deselection requires 'all', undeselectable too
        state.filterLevel = 0;

        await handleContextToggle('world');
        await flushUpdates();
        expect(state.selectedContexts.has('world')).toBe(true);
        expect(getContextSelectionState('world')).toBe('all');
        expect(state.activeKeywords.has('culture war')).toBe(true);

        await handleContextToggle('world');
        await flushUpdates();
        expect(state.selectedContexts.has('world')).toBe(false);
        expect(getContextSelectionState('world')).toBe('none');
        expect(state.activeKeywords.has('culture war')).toBe(false);
    });

    it('preserves keywords claimed by a sibling context sharing the category', async () => {
        await handleContextToggle('violence'); // Gun Policy
        await handleContextToggle('politics'); // Political Rhetoric + Gun Policy
        await handleContextToggle('violence'); // deselect
        await flushUpdates();

        // politics still claims Gun Policy, so its keywords must survive
        keywordsOf('Gun Policy').forEach(k => {
            expect(state.activeKeywords.has(k)).toBe(true);
        });
        expect(state.selectedContexts.has('politics')).toBe(true);
        expect(getContextSelectionState('politics')).toBe('all');
    });
});

describe('the partial-context loop that used to confuse everything', () => {
    it('unchecking one keyword flips the context to partial, not deselected chaos', async () => {
        await handleContextToggle('violence');
        await flushUpdates();

        handleKeywordToggle('open carry', false);
        await flushUpdates();

        expect(state.activeKeywords.has('open carry')).toBe(false);
        expect(state.manuallyUnchecked.has('open carry')).toBe(true);
        expect(getContextSelectionState('violence')).toBe('partial');
        expect(state.selectedContexts.has('violence')).toBe(false);

        // Other keywords survive the partial state (the old code rebuilt and
        // could drop or re-add them depending on timing)
        expect(state.activeKeywords.has('gun control')).toBe(true);
    });

    it('clicking a partial context selects it fully and clears the opt-out', async () => {
        await handleContextToggle('violence');
        await flushUpdates();
        handleKeywordToggle('open carry', false);
        await flushUpdates();

        await handleContextToggle('violence');
        await flushUpdates();

        expect(getContextSelectionState('violence')).toBe('all');
        expect(state.selectedContexts.has('violence')).toBe(true);
        expect(state.activeKeywords.has('open carry')).toBe(true);
        expect(state.manuallyUnchecked.size).toBe(0);
    });

    it('mode switching never destroys partial advanced-mode selections', async () => {
        state.mode = 'advanced';
        handleKeywordToggle('gun control', true);
        handleKeywordToggle('culture war', true);
        await flushUpdates();

        // What switchMode does when entering simple mode
        state.mode = 'simple';
        await updateSimpleModeState();
        await flushUpdates();

        expect(state.activeKeywords.has('gun control')).toBe(true);
        expect(state.activeKeywords.has('culture war')).toBe(true);
        expect(getContextSelectionState('violence')).toBe('partial');
    });
});

describe('exceptions', () => {
    it('adding an exception deactivates only that category', async () => {
        await handleContextToggle('politics');
        await flushUpdates();

        await handleExceptionToggle('Political Rhetoric');
        await flushUpdates();

        expect(state.selectedExceptions.has('Political Rhetoric')).toBe(true);
        expect(state.activeKeywords.has('culture war')).toBe(false);
        expect(state.activeKeywords.has('talking points')).toBe(false);
        // Shared keyword survives because Gun Policy still claims it
        expect(state.activeKeywords.has('assault weapon')).toBe(true);
        // Context stays selected (exception-aware derived state)
        expect(state.selectedContexts.has('politics')).toBe(true);
    });

    it('removing an exception re-activates the category for the claiming context', async () => {
        await handleContextToggle('politics');
        await handleExceptionToggle('Political Rhetoric');
        await handleExceptionToggle('Political Rhetoric');
        await flushUpdates();

        expect(state.selectedExceptions.size).toBe(0);
        expect(state.activeKeywords.has('culture war')).toBe(true);
        expect(getContextSelectionState('politics')).toBe('all');
    });

    it('an all-excepted context keeps its exception tags reachable', async () => {
        await handleContextToggle('health');
        await handleExceptionToggle('Healthcare and Public Health');
        await flushUpdates();

        expect(state.selectedContexts.has('health')).toBe(true);
        expect(getContextSelectionState('health')).toBe('all');
        expect(state.activeKeywords.has('single payer')).toBe(false);
    });
});

describe('category toggles in advanced mode', () => {
    it('toggling a category on/off round-trips cleanly', async () => {
        handleCategoryToggle('Gun Policy', 'none');
        await flushUpdates();
        keywordsOf('Gun Policy').forEach(k => {
            expect(state.activeKeywords.has(k)).toBe(true);
        });

        handleCategoryToggle('Gun Policy', 'all');
        await flushUpdates();
        expect(state.activeKeywords.size).toBe(0);
        keywordsOf('Gun Policy').forEach(k => {
            expect(state.manuallyUnchecked.has(k)).toBe(true);
        });
    });
});

describe('bulk actions', () => {
    it('enable all selects every context, clears exceptions and opt-outs', async () => {
        state.manuallyUnchecked.add('open carry');
        state.selectedExceptions.add('Gun Policy');

        handleEnableAll();
        await flushUpdates();

        expect(state.manuallyUnchecked.size).toBe(0);
        expect(state.selectedExceptions.size).toBe(0);
        for (const contextId of Object.keys(state.contextGroups)) {
            expect(state.selectedContexts.has(contextId)).toBe(true);
        }
        keywordsOf('Gun Policy').forEach(k => {
            expect(state.activeKeywords.has(k)).toBe(true);
        });
    });

    it('disable all clears everything', async () => {
        handleEnableAll();
        await flushUpdates();
        handleDisableAll();
        await flushUpdates();

        expect(state.activeKeywords.size).toBe(0);
        expect(state.selectedContexts.size).toBe(0);
        expect(state.selectedExceptions.size).toBe(0);
    });
});

describe('filter level flow', () => {
    it('slider changes only re-level selected contexts', async () => {
        await handleContextToggle('health'); // level 3: all three keywords
        await flushUpdates();
        state.mode = 'advanced';
        handleKeywordToggle('culture war', true); // advanced pick outside contexts
        await flushUpdates();
        state.mode = 'simple';

        state.filterLevel = 0;
        const { applyFilterLevel } = await import('../../js/handlers/context/selectionModel.js');
        applyFilterLevel();

        expect(state.activeKeywords.has('single payer')).toBe(true);
        expect(state.activeKeywords.has('public option')).toBe(false);
        expect(state.activeKeywords.has('culture war')).toBe(true);
    });
});

describe('mute/unmute counts stay consistent', () => {
    it('counts reflect derived state after toggling', async () => {
        state.originalMutedKeywords.add('gun control');

        await handleContextToggle('violence');
        await flushUpdates();

        const { toMute, toUnmute } = getMuteUnmuteCounts();
        // gun control already muted; the other three Gun Policy keywords are new
        expect(toMute).toBe(3);
        expect(toUnmute).toBe(0);

        await handleContextToggle('violence');
        await flushUpdates();
        const after = getMuteUnmuteCounts();
        expect(after.toMute).toBe(0);
        expect(after.toUnmute).toBe(1); // gun control would be unmuted
    });
});
