import { KEYWORDS_BASE_URL, CONTEXT_GROUPS_URL, DISPLAY_CONFIG_URL } from '../config.js';
import { state, forceRefresh } from '../state.js';
import { listCategoryFiles, getLastModifiedDate } from './github.js';

export async function fetchKeywordGroups(forceFresh = false) {
    try {
        // Get list of category files
        const categoryFiles = await listCategoryFiles();
        if (!Array.isArray(categoryFiles) || categoryFiles.length === 0) {
            throw new Error('Keyword catalog file list is empty');
        }
        console.debug('Found category files:', categoryFiles);

        // Fetch and process each category file
        const keywordGroups = {};
        const results = await Promise.allSettled(categoryFiles.map(async (fileName) => {
            try {
                const url = `${KEYWORDS_BASE_URL}/${fileName}`;
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const categoryData = await response.json();
                const categoryName = Object.keys(categoryData)[0];
                if (!categoryName || typeof categoryData[categoryName]?.keywords !== 'object') {
                    throw new Error('Invalid category schema');
                }

                // Store the entire category data structure
                keywordGroups[categoryName] = categoryData;

                console.debug(`Loaded ${categoryName} with ${Object.keys(categoryData[categoryName].keywords).length} keywords`);
                return categoryName;
            } catch (error) {
                console.error(`Failed to load category ${fileName}:`, error);
                throw error;
            }
        }));
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0 || Object.keys(keywordGroups).length !== categoryFiles.length) {
            throw new Error(`Keyword catalog incomplete (${failures.length} failed files)`);
        }


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
