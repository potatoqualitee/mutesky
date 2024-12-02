import { state, saveState, setTargetKeywordCount } from '../state.js';
import { getAllKeywordsForCategory } from '../categoryManager.js';
import { renderInterface } from '../renderer.js';

export function handleContextToggle(contextId) {
    const isSelected = state.selectedContexts.has(contextId);
    const context = state.contextGroups[contextId];
    const categories = context.categories;

    console.log(`Toggling context ${contextId}, currently selected: ${isSelected}`);

    if (isSelected) {
        // Removing context
        state.selectedContexts.delete(contextId);
        categories.forEach(category => {
            state.selectedExceptions.delete(category);
            const keywords = getAllKeywordsForCategory(category);
            console.log(`Removing ${keywords.length} keywords from ${category}`);
            keywords.forEach(keyword => state.activeKeywords.delete(keyword));
        });
    } else {
        // Adding context
        state.selectedContexts.add(contextId);
        categories.forEach(category => {
            if (!state.selectedExceptions.has(category)) {
                // Get keywords sorted by weight and limited by target count
                const keywords = getAllKeywordsForCategory(category, true);
                console.log(`Adding ${keywords.length} keywords from ${category} (target: ${state.targetKeywordCount})`);
                keywords.forEach(keyword => state.activeKeywords.add(keyword));
            }
        });
    }

    console.log(`Total active keywords after toggle: ${state.activeKeywords.size}`);
    saveState();
    renderInterface();
}

export function handleExceptionToggle(category) {
    console.log(`Toggling exception for ${category}`);
    console.log(`Current target keyword count: ${state.targetKeywordCount}`);

    if (state.selectedExceptions.has(category)) {
        // Removing exception (adding keywords back)
        state.selectedExceptions.delete(category);
        // Get keywords sorted by weight and limited by target count
        const keywords = getAllKeywordsForCategory(category, true);
        console.log(`Adding ${keywords.length} keywords from ${category}`);
        keywords.forEach(keyword => state.activeKeywords.add(keyword));
    } else {
        // Adding exception (removing keywords)
        state.selectedExceptions.add(category);
        const keywords = getAllKeywordsForCategory(category);
        console.log(`Removing ${keywords.length} keywords from ${category}`);
        keywords.forEach(keyword => state.activeKeywords.delete(keyword));
    }

    console.log(`Total active keywords after exception toggle: ${state.activeKeywords.size}`);
    saveState();
    renderInterface();
}

export function updateSimpleModeState() {
    // Set initial target count to minimal (100) when in simple mode
    if (state.targetKeywordCount === 2000) {
        setTargetKeywordCount(100);
    }

    // Clear current selections
    state.selectedContexts.clear();
    state.selectedExceptions.clear();

    // If there are no active keywords at all, return early
    if (state.activeKeywords.size === 0) {
        saveState();
        renderInterface();
        return;
    }

    // Get all active keywords
    const activeKeywords = new Set(state.activeKeywords);
    console.log(`Updating simple mode state with ${activeKeywords.size} active keywords`);

    // For each context group
    Object.entries(state.contextGroups).forEach(([contextId, context]) => {
        if (!context.categories) return;

        let hasActiveKeywords = false;

        // Check each category in the context
        context.categories.forEach(category => {
            const categoryKeywords = getAllKeywordsForCategory(category, true);
            const activeInCategory = categoryKeywords.filter(k => activeKeywords.has(k));

            if (activeInCategory.length > 0) {
                hasActiveKeywords = true;
                console.log(`Found ${activeInCategory.length} active keywords in ${category}`);

                // If some but not all keywords in category are active, mark for exception
                if (activeInCategory.length < categoryKeywords.length) {
                    state.selectedExceptions.add(category);
                    console.log(`Marking ${category} as exception (partial selection)`);
                }
            }
        });

        // Only select context if it has active keywords
        if (hasActiveKeywords) {
            state.selectedContexts.add(contextId);
            console.log(`Selected context ${contextId} due to active keywords`);
        }
    });

    saveState();
    renderInterface();
}
