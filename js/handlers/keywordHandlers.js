import { state, saveState } from '../state.js';
import { getAllKeywordsForCategory, filterKeywordGroups } from '../categoryManager.js';
import { renderInterface } from '../renderer.js';
import { updateSimpleModeState } from './contextHandlers.js';

export function handleKeywordToggle(keyword, enabled) {
    if (enabled) {
        state.activeKeywords.add(keyword);
    } else {
        state.activeKeywords.delete(keyword);
    }

    updateSimpleModeState();
    renderInterface();
    saveState();
}

export function handleCategoryToggle(category, currentState) {
    const keywords = getAllKeywordsForCategory(category);
    const shouldEnable = currentState !== 'all';

    keywords.forEach(keyword => {
        if (shouldEnable) {
            state.activeKeywords.add(keyword);
        } else {
            state.activeKeywords.delete(keyword);
        }
    });

    // Update both panels
    const sidebarCheckbox = document.querySelector(`.category-item[data-category="${category}"] input[type="checkbox"]`);
    const mainCheckbox = document.querySelector(`#category-${category.replace(/\s+/g, '-').toLowerCase()} input[type="checkbox"]`);

    if (sidebarCheckbox && mainCheckbox) {
        if (shouldEnable) {
            sidebarCheckbox.checked = true;
            sidebarCheckbox.indeterminate = false;
            mainCheckbox.checked = true;
            mainCheckbox.indeterminate = false;
        } else {
            sidebarCheckbox.checked = false;
            sidebarCheckbox.indeterminate = false;
            mainCheckbox.checked = false;
            mainCheckbox.indeterminate = false;
        }
    }

    // Update all keyword checkboxes in the category
    const keywordCheckboxes = document.querySelectorAll(`#category-${category.replace(/\s+/g, '-').toLowerCase()} .keywords-container input[type="checkbox"]`);
    keywordCheckboxes.forEach(checkbox => {
        checkbox.checked = shouldEnable;
    });

    updateSimpleModeState();
    renderInterface();
    saveState();
}

export function handleEnableAll() {
    if (state.searchTerm) {
        // When searching, only enable filtered keywords
        const filteredGroups = filterKeywordGroups();
        Object.values(filteredGroups).flat().forEach(keyword => {
            state.activeKeywords.add(keyword);
        });
    } else {
        // When not searching, enable all keywords from all categories
        const allCategories = [
            ...Object.keys(state.keywordGroups),
            ...Object.keys(state.displayConfig.combinedCategories || {})
        ];
        allCategories.forEach(category => {
            const keywords = getAllKeywordsForCategory(category);
            keywords.forEach(keyword => state.activeKeywords.add(keyword));
        });
    }

    updateSimpleModeState();
    renderInterface();
    saveState();
}

export function handleDisableAll() {
    if (state.searchTerm) {
        // When searching, only disable filtered keywords
        const filteredGroups = filterKeywordGroups();
        Object.values(filteredGroups).flat().forEach(keyword => {
            state.activeKeywords.delete(keyword);
        });
    } else {
        // When not searching, disable all keywords
        state.activeKeywords.clear();
    }

    updateSimpleModeState();
    renderInterface();
    saveState();
}
