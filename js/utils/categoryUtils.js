import { state } from '../state.js';
import { getWeightThreshold } from './weightManager.js';
// keyword-utils rather than the keywordHandlers barrel: the barrel pulls in
// the toggle handlers, which import the renderers, which import this file
import { isKeywordActive } from '../handlers/keywords/keyword-utils.js';

export function getDisplayName(category) {
    return state.displayConfig.displayNames[category] || category;
}

export function getCategoryState(category) {
    const keywords = getAllKeywordsForCategory(category);
    const activeCount = keywords.filter(k => isKeywordActive(k)).length;

    if (activeCount === 0) return 'none';
    if (activeCount === keywords.length) return 'all';
    return 'partial';
}

export function getCheckboxClass(state) {
    switch (state) {
        case 'all': return 'checked';
        case 'partial': return 'partial';
        default: return '';
    }
}

export function extractKeywordsFromCategory(category, categoryData) {
    if (!categoryData?.[category]?.keywords) return [];

    const categoryInfo = categoryData[category];
    return Object.entries(categoryInfo.keywords).map(([keyword, data]) => ({
        keyword,
        weight: data.weight || 0,
        category
    }));
}

export function extractKeywordsFromCombinedSources(combinedSources, keywordGroups) {
    return combinedSources.flatMap(source => {
        const categoryData = keywordGroups[source];
        if (!categoryData?.[source]) return [];
        return extractKeywordsFromCategory(source, categoryData);
    });
}

// Grid categories (regular keywordGroups entries, including the projected
// My Keywords category) whose keyword list contains the given keyword.
// Case-insensitive because active-keyword tracking is case-insensitive.
export function categoriesContainingKeyword(keyword) {
    const lower = keyword.toLowerCase();
    const matches = [];
    for (const [category, categoryData] of Object.entries(state.keywordGroups)) {
        const keywords = categoryData?.[category]?.keywords;
        if (!keywords) continue;
        if (Object.keys(keywords).some(k => k.toLowerCase() === lower)) {
            matches.push(category);
        }
    }
    return matches;
}

export function getAllKeywordsForCategory(category, sortByWeight = false) {
    let keywords = [];

    // Check if this is a combined category
    const combinedSources = state.displayConfig.combinedCategories?.[category];
    if (combinedSources) {
        keywords = extractKeywordsFromCombinedSources(combinedSources, state.keywordGroups);
    } else {
        // Regular category
        const categoryData = state.keywordGroups[category];
        keywords = extractKeywordsFromCategory(category, categoryData);
    }

    // Sort and filter by weight if requested
    if (sortByWeight) {
        keywords.sort((a, b) => b.weight - a.weight);

        if (state.filterLevel !== undefined) {
            const before = keywords.length;
            keywords = filterByWeight(keywords, category);
            logFilterResults(category, keywords, before);
        }
    }

    // Return just the keyword strings
    return keywords.map(k => k.keyword);
}

function filterByWeight(keywords, category) {
    return keywords.filter(k => {
        const threshold = getWeightThreshold(state.filterLevel);
        const passes = k.weight >= threshold;
        if (passes) {
            console.debug(`Including ${k.keyword} (weight: ${k.weight}) from ${k.category}`);
        }
        return passes;
    });
}

function logFilterResults(category, keywords, beforeCount) {
    console.debug(`Category ${category}:
        - Filter level: ${state.filterLevel}
        - Threshold: ${getWeightThreshold(state.filterLevel)}
        - Filtered from ${beforeCount} to ${keywords.length} keywords
        - Remaining keywords: ${keywords.map(k => `${k.keyword} (${k.weight})`).join(', ')}`);
}
