import { elements } from '../dom.js';
import { state } from '../state.js';
import { getDisplayName, getCategoryState, getCheckboxClass, filterKeywordGroups, getAllKeywordsForCategory } from '../categoryManager.js';
import { isKeywordActive } from '../handlers/keywords/keyword-utils.js';
import { escapeHtml } from '../utils/escape.js';
import { MY_KEYWORDS_CATEGORY } from '../myKeywords.js';

// No inline onclick/onchange in this markup: the grid and sidebar re-render
// wholesale, so per-checkbox inline handlers would be re-parsed and
// re-compiled on every render (~1,600 of them for the full grid). events.js
// attaches delegated listeners to the two static containers instead.

function sectionIdFor(category) {
    // Special case: give US Political Figures the ID that matches the politicians link
    return category === 'US Political Figures - Full Name' ? 'politicians' : category.replace(/\s+/g, '-').toLowerCase();
}

function buildCategorySection(category, keywords) {
    const activeCount = keywords.filter(k => isKeywordActive(k)).length;
    const displayName = category;
    const categoryState = getCategoryState(category);
    const sectionId = sectionIdFor(category);

    return `
        <div class="category-section" id="category-${escapeHtml(sectionId)}">
            <div class="category-header">
                <div class="category-title">
                    <div class="keyword-checkbox">
                        <input
                            type="checkbox"
                            class="category-checkbox"
                            ${categoryState === 'all' ? 'checked' : ''}
                            data-category="${escapeHtml(category)}"
                            data-state="${categoryState}"
                        >
                    </div>
                    <h3>${escapeHtml(displayName)}</h3>
                    <span class="count">(${activeCount}/${keywords.length})</span>
                    ${category === MY_KEYWORDS_CATEGORY ? `
                        <button class="my-keywords-manage">Manage</button>
                    ` : ''}
                </div>
            </div>
            <div class="keywords-container">
                ${keywords.map(keyword => `
                    <label class="keyword-checkbox">
                        <input
                            type="checkbox"
                            data-keyword="${escapeHtml(keyword)}"
                            ${isKeywordActive(keyword) ? 'checked' : ''}
                        >
                        ${escapeHtml(keyword)}
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// The indeterminate flag is a property, not an attribute, so it has to be
// set after the markup lands in the DOM
function syncIndeterminateStates(root) {
    root.querySelectorAll('.category-checkbox').forEach(checkbox => {
        if (checkbox.dataset.state === 'partial') {
            checkbox.indeterminate = true;
            checkbox.checked = false;
        }
    });
}

export function renderAdvancedMode() {
    if (!elements.categoriesGrid) return;

    const filteredGroups = filterKeywordGroups(true); // Pass true for right panel
    elements.categoriesGrid.innerHTML = Object.entries(filteredGroups)
        .map(([category, keywords]) => keywords.length === 0 ? '' : buildCategorySection(category, keywords))
        .join('');

    syncIndeterminateStates(elements.categoriesGrid);
}

// Scoped alternative to renderAdvancedMode: rebuild only the sections a
// toggle touched, leaving the other ~two dozen (and their thousand-plus
// checkboxes) alone. Falls back to the full render whenever the DOM and the
// filtered view disagree about a section, so it can never leave the grid
// staler than the old full-render path.
export function renderCategorySections(categories) {
    if (!elements.categoriesGrid) return;
    // Nothing rendered yet (e.g. still in simple mode): nothing to patch
    if (!elements.categoriesGrid.firstElementChild) return;

    const filteredGroups = filterKeywordGroups(true);

    for (const category of categories) {
        const id = `category-${sectionIdFor(category)}`;
        const section = elements.categoriesGrid.querySelector(`#${CSS.escape(id)}`);
        const keywords = filteredGroups[category];

        // Hidden on both sides (e.g. a duplicate keyword's other category is
        // filtered out by the current search): nothing stale to patch
        if (!section && !keywords) continue;

        if (!section || !keywords || keywords.length === 0) {
            renderAdvancedMode();
            return;
        }

        // trim() so only the element itself replaces the node: untrimmed, the
        // template's surrounding newlines would pile up as text nodes and the
        // patched grid would drift from what a full render produces
        section.outerHTML = buildCategorySection(category, keywords).trim();
        // outerHTML detached the old node; re-query for the property pass
        const fresh = elements.categoriesGrid.querySelector(`#${CSS.escape(id)}`);
        if (fresh) syncIndeterminateStates(fresh);
    }
}

export function renderCategoryList() {
    if (!elements.categoryList) return;

    // Get all categories including combined ones but excluding source categories
    const allCategories = new Set([
        ...Object.keys(state.keywordGroups).filter(category => {
            // Filter out categories that are part of combined categories
            return !Object.values(state.displayConfig.combinedCategories || {})
                .some(sources => sources.includes(category));
        }),
        ...Object.keys(state.displayConfig.combinedCategories || {})
    ]);

    const categories = Array.from(allCategories)
        .map(category => {
            const keywords = getAllKeywordsForCategory(category);
            const totalKeywords = keywords.length;
            const activeKeywords = keywords.filter(k => isKeywordActive(k)).length;
            const displayName = getDisplayName(category);
            const categoryState = getCategoryState(category);

            return {
                category,
                displayName,
                activeKeywords,
                totalKeywords,
                state: categoryState
            };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const html = categories.map(({ category, displayName, activeKeywords, totalKeywords, state }) => `
        <div class="category-item" data-category="${escapeHtml(category)}">
            <div class="keyword-checkbox">
                <input
                    type="checkbox"
                    class="category-checkbox"
                    ${state === 'all' ? 'checked' : ''}
                    data-category="${escapeHtml(category)}"
                    data-state="${state}"
                >
            </div>
            <a href="#category-${escapeHtml(category.replace(/\s+/g, '-').toLowerCase())}"
               class="category-name">
                ${escapeHtml(displayName)}
            </a>
            <span class="category-count">${activeKeywords}/${totalKeywords}</span>
        </div>
    `).join('');

    elements.categoryList.innerHTML = html;

    syncIndeterminateStates(elements.categoryList);
}
