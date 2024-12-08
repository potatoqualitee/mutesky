import { state } from '../state.js';
import { getAllKeywordsForCategory } from './categoryUtils.js';
import { isKeywordActive } from '../handlers/keywordHandlers.js';

export function filterKeywordGroups(isRightPanel = false) {
    const filtered = {};
    const searchTerm = state.searchTerm.toLowerCase();
    const categoriesToShow = state.selectedCategories.size > 0
        ? state.selectedCategories
        : new Set(Object.keys(state.keywordGroups));

    if (isRightPanel) {
        filterRightPanel(filtered, categoriesToShow, searchTerm);
    } else {
        filterLeftPanel(filtered, categoriesToShow, searchTerm);
    }

    return filtered;
}

function filterRightPanel(filtered, categoriesToShow, searchTerm) {
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        if (!categoriesToShow.has(category)) return;

        const categoryInfo = categoryData[category];
        if (!categoryInfo?.keywords) return;

        const keywords = Object.keys(categoryInfo.keywords);
        const filteredKeywords = filterKeywords(keywords, category, searchTerm);

        if (filteredKeywords.length > 0) {
            filtered[category] = filteredKeywords;
        }
    });
}

function filterLeftPanel(filtered, categoriesToShow, searchTerm) {
    // Handle regular categories
    Object.entries(state.keywordGroups).forEach(([category, categoryData]) => {
        const isCombined = Object.values(state.displayConfig.combinedCategories || {})
            .some(sources => sources.includes(category));
        if (isCombined) return;

        if (!categoriesToShow.has(category)) return;

        const categoryInfo = categoryData[category];
        if (!categoryInfo?.keywords) return;

        const keywords = Object.keys(categoryInfo.keywords);
        const filteredKeywords = filterKeywords(keywords, category, searchTerm);

        if (filteredKeywords.length > 0) {
            filtered[category] = filteredKeywords;
        }
    });

    // Handle combined categories
    Object.entries(state.displayConfig.combinedCategories || {}).forEach(([combinedCategory, sourceCategories]) => {
        const allKeywords = sourceCategories.flatMap(category => {
            const categoryData = state.keywordGroups[category];
            if (!categoryData?.[category]?.keywords) return [];
            return Object.keys(categoryData[category].keywords);
        });

        const filteredKeywords = filterKeywords(allKeywords, combinedCategory, searchTerm);

        if (filteredKeywords.length > 0) {
            filtered[combinedCategory] = filteredKeywords;
        }
    });
}

function filterKeywords(keywords, category, searchTerm) {
    return keywords.filter(keyword => {
        const matchesSearch = !searchTerm ||
            keyword.toLowerCase().includes(searchTerm) ||
            category.toLowerCase().includes(searchTerm);

        const matchesFilter = state.filterMode === 'all' ||
            (state.filterMode === 'active' && isKeywordActive(keyword)) ||
            (state.filterMode === 'disabled' && !isKeywordActive(keyword));

        return matchesSearch && matchesFilter;
    });
}
