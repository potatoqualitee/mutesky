import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        auth: { session: null },
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

import { state } from '../../js/state.js';
import { resetStateWithFixtures, flushUpdates } from '../helpers/fixtures.js';

// dom.js caches getElementById lookups at import time, so the containers must
// exist before the renderer module graph loads — hence the dynamic imports
let renderAdvancedMode, renderCategorySections, renderCategoryList;
let handleKeywordToggle, handleCategoryToggle;

beforeAll(async () => {
    document.body.innerHTML = `
        <main id="categories-grid"></main>
        <div id="category-list"></div>
        <span id="active-count"></span>
    `;
    ({ renderAdvancedMode, renderCategorySections, renderCategoryList } =
        await import('../../js/renderers/categoryRenderer.js'));
    ({ handleKeywordToggle, handleCategoryToggle } =
        await import('../../js/handlers/keywords/core-handlers.js'));

    // Attaches the delegated grid/sidebar listeners to the containers above
    const { setupEventListeners } = await import('../../js/events.js');
    setupEventListeners();
    // Generous timeout: events.js pulls in the full handler graph, which is
    // slow to import on WSL's /mnt/c filesystem
}, 120000);

beforeEach(() => {
    resetStateWithFixtures({ mode: 'advanced' });
    document.getElementById('categories-grid').innerHTML = '';
    document.getElementById('category-list').innerHTML = '';
});

function grid() {
    return document.getElementById('categories-grid');
}

// innerHTML captures attributes; indeterminate/checked are properties and
// need their own snapshot
function gridSnapshot() {
    return {
        html: grid().innerHTML,
        checkboxes: Array.from(grid().querySelectorAll('.category-checkbox')).map(cb =>
            `${cb.dataset.category}|state:${cb.dataset.state}|ind:${cb.indeterminate}|checked:${cb.checked}`)
    };
}

describe('renderCategorySections', () => {
    it('produces a grid identical to a full re-render', () => {
        state.activeKeywords.add('gun control');
        renderAdvancedMode();

        // 'assault weapon' lives in BOTH Gun Policy and Political Rhetoric
        state.activeKeywords.add('assault weapon');
        renderCategorySections(['Gun Policy', 'Political Rhetoric']);
        const scoped = gridSnapshot();

        renderAdvancedMode();
        expect(scoped).toEqual(gridSnapshot());
    });

    it('updates tri-state through the full cycle: none -> partial -> all', () => {
        renderAdvancedMode();

        state.activeKeywords.add('gun control');
        renderCategorySections(['Gun Policy']);
        let checkbox = grid().querySelector('input[data-category="Gun Policy"]');
        expect(checkbox.dataset.state).toBe('partial');
        expect(checkbox.indeterminate).toBe(true);
        expect(checkbox.checked).toBe(false);

        ['second amendment', 'assault weapon', 'open carry']
            .forEach(k => state.activeKeywords.add(k));
        renderCategorySections(['Gun Policy']);
        checkbox = grid().querySelector('input[data-category="Gun Policy"]');
        expect(checkbox.dataset.state).toBe('all');
        expect(checkbox.indeterminate).toBe(false);
        expect(checkbox.checked).toBe(true);
    });

    it('leaves untouched sections alone', () => {
        renderAdvancedMode();
        const untouchedBefore = grid().querySelector('#category-healthcare-and-public-health');

        state.activeKeywords.add('gun control');
        renderCategorySections(['Gun Policy']);

        // Same node object: the section was not rebuilt
        expect(grid().querySelector('#category-healthcare-and-public-health')).toBe(untouchedBefore);
    });

    it('falls back to a full render when the DOM and filtered view disagree', () => {
        // Render under a search that hides Political Rhetoric, then clear it:
        // the filtered view now has a section the DOM lacks
        state.searchTerm = 'gun';
        renderAdvancedMode();
        expect(grid().querySelector('#category-political-rhetoric')).toBe(null);

        state.searchTerm = '';
        state.activeKeywords.add('culture war');
        renderCategorySections(['Political Rhetoric']);
        const fallback = gridSnapshot();

        expect(grid().querySelector('#category-political-rhetoric')).not.toBe(null);
        renderAdvancedMode();
        expect(fallback).toEqual(gridSnapshot());
    });

    it('does nothing when the grid has never been rendered', () => {
        state.activeKeywords.add('gun control');
        renderCategorySections(['Gun Policy']);
        expect(grid().innerHTML).toBe('');
    });

    it('skips a section hidden by the current search instead of full-rendering', () => {
        // 'gun' matches the Gun Policy category name only: Political Rhetoric
        // has no section, but it still contains the duplicate 'assault weapon'
        state.searchTerm = 'gun';
        renderAdvancedMode();
        expect(grid().querySelector('#category-political-rhetoric')).toBe(null);

        state.activeKeywords.add('assault weapon');
        renderCategorySections(['Gun Policy', 'Political Rhetoric']);
        const scoped = gridSnapshot();

        renderAdvancedMode();
        expect(scoped).toEqual(gridSnapshot());
    });
});

describe('toggle handlers with scoped rendering', () => {
    it('keyword toggle syncs every section containing the keyword', async () => {
        renderAdvancedMode();
        renderCategoryList();

        handleKeywordToggle('assault weapon', true);
        await flushUpdates();
        const scoped = gridSnapshot();

        renderAdvancedMode();
        expect(scoped).toEqual(gridSnapshot());

        // Both sections' headers show the new count
        expect(scoped.html).toContain('(1/4)'); // Gun Policy
        expect(scoped.html).toContain('(1/3)'); // Political Rhetoric
    });

    it('coalesced toggles update all touched sections, not just the last', async () => {
        renderAdvancedMode();
        renderCategoryList();

        // Same debounce window: the second call replaces the first's pending
        // callback, so this exercises the pendingSections accumulation
        handleKeywordToggle('gun control', true);
        handleKeywordToggle('single payer', true);
        await flushUpdates();
        const scoped = gridSnapshot();

        renderAdvancedMode();
        expect(scoped).toEqual(gridSnapshot());
        expect(state.activeKeywords.has('gun control')).toBe(true);
        expect(state.activeKeywords.has('single payer')).toBe(true);
    });

    it('category toggle enables all keywords and matches a full render', async () => {
        renderAdvancedMode();
        renderCategoryList();

        handleCategoryToggle('Gun Policy', 'none');
        await flushUpdates();
        const scoped = gridSnapshot();

        renderAdvancedMode();
        expect(scoped).toEqual(gridSnapshot());

        const checkbox = grid().querySelector('input[data-category="Gun Policy"]');
        expect(checkbox.dataset.state).toBe('all');
        // Cross-category keyword: Political Rhetoric now shows 1/3 active.
        // This must come from the scoped render itself -- the snapshot was
        // taken before the fresh full render above
        expect(scoped.html).toContain('(1/3)');
    });

    it('never schedules a hidden full render behind the scoped flush', async () => {
        renderAdvancedMode();
        renderCategoryList();
        const untouched = grid().querySelector('#category-healthcare-and-public-health');

        handleKeywordToggle('gun control', true);
        handleCategoryToggle('Political Rhetoric', 'none');
        await flushUpdates();
        // Second settle window: a delayed debounced renderInterface (the old
        // updateSimpleModeState behavior) would land here and rebuild the grid
        await flushUpdates();

        expect(grid().querySelector('#category-healthcare-and-public-health')).toBe(untouched);
    });

    it('dispatches keywordsUpdated exactly once per flush', async () => {
        renderAdvancedMode();
        renderCategoryList();

        let dispatches = 0;
        const listener = () => { dispatches++; };
        document.addEventListener('keywordsUpdated', listener);

        handleKeywordToggle('gun control', true);
        await flushUpdates();
        document.removeEventListener('keywordsUpdated', listener);

        expect(dispatches).toBe(1);
    });

    it('sidebar counts stay in sync after a keyword toggle', async () => {
        renderAdvancedMode();
        renderCategoryList();

        handleKeywordToggle('gun control', true);
        await flushUpdates();

        const sidebarRow = document.querySelector('.category-item[data-category="Gun Policy"] .category-count');
        expect(sidebarRow.textContent).toBe('1/4');
    });
});

describe('delegated grid and sidebar events', () => {
    it('checking a keyword checkbox activates the keyword', async () => {
        renderAdvancedMode();
        renderCategoryList();

        grid().querySelector('input[data-keyword="gun control"]').click();
        await flushUpdates();

        expect(state.activeKeywords.has('gun control')).toBe(true);
        // The scoped re-render replaced the checkbox; the new one is checked
        expect(grid().querySelector('input[data-keyword="gun control"]').checked).toBe(true);
    });

    it('unchecking a keyword checkbox deactivates it and records the opt-out', async () => {
        state.activeKeywords.add('gun control');
        renderAdvancedMode();
        renderCategoryList();

        grid().querySelector('input[data-keyword="gun control"]').click();
        await flushUpdates();

        expect(state.activeKeywords.has('gun control')).toBe(false);
        expect(state.manuallyUnchecked.has('gun control')).toBe(true);
    });

    it('grid category checkbox cycles none -> all -> none', async () => {
        renderAdvancedMode();
        renderCategoryList();

        grid().querySelector('input[data-category="Gun Policy"]').click();
        await flushUpdates();
        expect(grid().querySelector('input[data-category="Gun Policy"]').dataset.state).toBe('all');
        expect(state.activeKeywords.size).toBe(4);

        grid().querySelector('input[data-category="Gun Policy"]').click();
        await flushUpdates();
        expect(grid().querySelector('input[data-category="Gun Policy"]').dataset.state).toBe('none');
        expect(state.activeKeywords.size).toBe(0);
    });

    it('a partial category checkbox selects the whole category', async () => {
        // The browser flips an indeterminate checkbox to checked before the
        // delegated handler runs; the handler must still read the pre-click
        // 'partial' state and therefore enable, not disable
        state.activeKeywords.add('gun control');
        renderAdvancedMode();
        renderCategoryList();

        const checkbox = grid().querySelector('input[data-category="Gun Policy"]');
        expect(checkbox.dataset.state).toBe('partial');
        checkbox.click();
        await flushUpdates();

        expect(state.activeKeywords.size).toBe(4);
        expect(grid().querySelector('input[data-category="Gun Policy"]').dataset.state).toBe('all');
    });

    it('sidebar category checkbox toggles through delegation too', async () => {
        renderAdvancedMode();
        renderCategoryList();

        document.querySelector('#category-list input[data-category="Gun Policy"]').click();
        await flushUpdates();

        expect(state.activeKeywords.size).toBe(4);
        expect(document.querySelector('#category-list input[data-category="Gun Policy"]').dataset.state).toBe('all');
    });

    it('clicking the keyword label text toggles via the synthesized input click', async () => {
        renderAdvancedMode();
        renderCategoryList();

        const label = grid().querySelector('input[data-keyword="open carry"]').closest('label');
        label.click();
        await flushUpdates();

        expect(state.activeKeywords.has('open carry')).toBe(true);
    });
});
