import { elements } from '../dom.js';
import { state } from '../state.js';
import { getDisplayName, getCategoryState, getCheckboxClass, filterKeywordGroups, getAllKeywordsForCategory } from '../categoryManager.js';
import { isKeywordActive } from '../handlers/keywordHandlers.js';

export function renderAdvancedMode() {
    if (!elements.categoriesGrid) return;

    const filteredGroups = filterKeywordGroups(true); // Pass true for right panel
    elements.categoriesGrid.innerHTML = Object.entries(filteredGroups)
        .map(([category, keywords]) => {
            if (keywords.length === 0) return '';

            const activeCount = keywords.filter(k => isKeywordActive(k)).length;
            const displayName = category;
            const categoryState = getCategoryState(category);

            // Special case: give US Political Figures the ID that matches the politicians link
            const sectionId = category === 'US Political Figures - Full Name' ? 'politicians' : category.replace(/\s+/g, '-').toLowerCase();

            return `
                <div class="category-section" id="category-${sectionId}">
                    <div class="category-header">
                        <div class="category-title">
                            <div class="keyword-checkbox">
                                <input
                                    type="checkbox"
                                    class="category-checkbox"
                                    ${categoryState === 'all' ? 'checked' : ''}
                                    data-category="${category}"
                                    data-state="${categoryState}"
                                    onclick="handleCategoryToggle('${category}', '${categoryState}')"
                                >
                            </div>
                            <h3>${displayName}</h3>
                            <span class="count">(${activeCount}/${keywords.length})</span>
                        </div>
                    </div>
                    <div class="keywords-container">
                        ${keywords.map(keyword => `
                            <label class="keyword-checkbox">
                                <input
                                    type="checkbox"
                                    ${isKeywordActive(keyword) ? 'checked' : ''}
                                    onchange="handleKeywordToggle('${keyword}', this.checked)"
                                >
                                ${keyword}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        })
        .join('');

    // Set indeterminate state after rendering
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        const category = checkbox.dataset.category;
        const state = checkbox.dataset.state;
        if (state === 'partial') {
            checkbox.indeterminate = true;
            checkbox.checked = false;
        }
    });
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
        <div class="category-item" data-category="${category}">
            <div class="keyword-checkbox">
                <input
                    type="checkbox"
                    class="category-checkbox"
                    ${state === 'all' ? 'checked' : ''}
                    data-category="${category}"
                    data-state="${state}"
                    onclick="handleCategoryToggle('${category}', '${state}')"
                >
            </div>
            <a href="#category-${category.replace(/\s+/g, '-').toLowerCase()}"
               class="category-name"
               onclick="const el = document.getElementById('category-${category.replace(/\s+/g, '-').toLowerCase()}'); if (el) el.scrollIntoView({behavior: 'smooth'})">
                ${displayName}
            </a>
            <span class="category-count">${activeKeywords}/${totalKeywords}</span>
        </div>
    `).join('');

    elements.categoryList.innerHTML = html;

    // Set indeterminate state after rendering
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        const state = checkbox.dataset.state;
        if (state === 'partial') {
            checkbox.indeterminate = true;
            checkbox.checked = false;
        }
    });
}
