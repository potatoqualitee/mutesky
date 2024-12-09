import { KEYWORDS_BASE_URL, CONTEXT_GROUPS_URL, DISPLAY_CONFIG_URL } from '../config.js';
import { state, forceRefresh } from '../state.js';
import { listCategoryFiles, getLastModifiedDate } from './github.js';

export async function fetchKeywordGroups(forceFresh = false) {
    try {
        // Get list of category files
        const categoryFiles = await listCategoryFiles();
        console.debug('Found category files:', categoryFiles);

        // Fetch and process each category file
        const keywordGroups = {};
        const results = await Promise.allSettled(categoryFiles.map(async (fileName) => {
            try {
                const url = `${KEYWORDS_BASE_URL}/${fileName}`;
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) return;

                const categoryData = await response.json();
                const categoryName = Object.keys(categoryData)[0];

                // Store the entire category data structure
                keywordGroups[categoryName] = categoryData;

                console.debug(`Loaded ${categoryName} with ${Object.keys(categoryData[categoryName].keywords).length} keywords`);
            } catch (error) {
                console.error(`Failed to load category ${fileName}:`, error);
            }
        }));

        // Sort categories alphabetically and create a new ordered object
        const orderedKeywordGroups = {};
        Object.keys(keywordGroups)
            .sort((a, b) => a.localeCompare(b))
            .forEach(key => {
                orderedKeywordGroups[key] = keywordGroups[key];
            });

        // Update state with ordered groups
        state.lastModified = await getLastModifiedDate();
        state.keywordGroups = orderedKeywordGroups;

        // Initialize selected categories if empty
        if (state.selectedCategories.size === 0) {
            Object.keys(orderedKeywordGroups).forEach(category => {
                state.selectedCategories.add(category);
            });
        }

        console.debug('Keyword groups loaded:', Object.keys(orderedKeywordGroups).length, 'categories');
    } catch (error) {
        console.error('Error fetching keyword groups:', error);
        throw error;
    }
}

export async function fetchContextGroups(forceFresh = false) {
    try {
        const url = forceFresh ? forceRefresh().contextGroupsUrl : CONTEXT_GROUPS_URL;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch context groups');
        state.contextGroups = await response.json();
    } catch (error) {
        console.error('Error fetching context groups:', error);
        throw error;
    }
}

export async function fetchDisplayConfig(forceFresh = false) {
    try {
        const url = forceFresh ? forceRefresh().displayConfigUrl : DISPLAY_CONFIG_URL;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch display config');
        state.displayConfig = await response.json();
    } catch (error) {
        console.error('Error fetching display config:', error);
        throw error;
    }
}
