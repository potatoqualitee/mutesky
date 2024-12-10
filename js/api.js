import { KEYWORDS_BASE_URL, CONTEXT_GROUPS_URL, DISPLAY_CONFIG_URL, getWeightThreshold } from './config.js';
import { state, forceRefresh } from './state.js';

// Backup category files list
const BACKUP_CATEGORY_FILES = [
    'climate-and-environment.json',
    'economic-policy.json',
    'education.json',
    'gun-policy.json',
    'healthcare-and-public-health.json',
    'immigration.json',
    'international-coverage.json',
    'lgbtq.json',
    'media-personalities.json',
    'military-and-defense.json',
    'new-developments.json',
    'political-organizations.json',
    'political-rhetoric.json',
    'political-violence-and-security-threats.json',
    'race-relations.json',
    'relational-violence.json',
    'religion.json',
    'reproductive-health.json',
    'social-policy.json',
    'us-government-institutions.json',
    'us-political-figures-full-name.json',
    'us-political-figures-single-name.json',
    'vaccine-policy.json',
    'world-leaders.json'
];

const BACKUP_LAST_MODIFIED = 'Dec 1, 2023 9:00 PM';

// Cache implementation
const cache = {
    data: new Map(),
    getItem: function(key) {
        const item = this.data.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }
        return item.value;
    },
    setItem: function(key, value, ttl = 3600000) { // 1 hour default TTL
        const expiry = Date.now() + ttl;
        this.data.set(key, { value, expiry });
    }
};

async function getLastModifiedDate() {
    const repoOwner = 'potatoqualitee';
    const repoName = 'calm-the-chaos';
    const filePath = 'keywords/categories';
    const cacheKey = `lastModified_${repoOwner}_${repoName}_${filePath}`;

    try {
        // Check cache first
        const cachedDate = cache.getItem(cacheKey);
        if (cachedDate) return cachedDate;

        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?path=${filePath}&per_page=1`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'MuteSky-App'
            }
        });
        const data = await response.json();

        if (data && data[0] && data[0].commit && data[0].commit.committer.date) {
            const date = new Date(data[0].commit.committer.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            cache.setItem(cacheKey, formattedDate);
            return formattedDate;
        }
    } catch (error) {
        console.error('Failed to fetch last modified date:', error);
    }
    return BACKUP_LAST_MODIFIED;
}

async function listCategoryFiles() {
    const repoOwner = 'potatoqualitee';
    const repoName = 'calm-the-chaos';
    const path = 'keywords/categories';
    const cacheKey = `categoryFiles_${repoOwner}_${repoName}_${path}`;

    try {
        // Check cache first
        const cachedFiles = cache.getItem(cacheKey);
        if (cachedFiles) return cachedFiles;

        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'MuteSky-App'
            }
        });

        if (response.status === 403) {
            console.debug('GitHub API rate limit reached, using backup files');
            return BACKUP_CATEGORY_FILES;
        }

        const data = await response.json();
        const files = data.filter(file => file.name.endsWith('.json')).map(file => file.name);
        cache.setItem(cacheKey, files);
        return files;
    } catch (error) {
        console.error('Failed to list category files:', error);
        return BACKUP_CATEGORY_FILES;
    }
}

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

export async function refreshAllData() {
    try {
        // Store current state before refresh
        const activeKeywords = new Set(state.activeKeywords);
        const selectedContexts = new Set(state.selectedContexts);
        const selectedExceptions = new Set(state.selectedExceptions);
        const selectedCategories = new Set(state.selectedCategories);
        const currentMode = state.mode;
        const menuOpen = state.menuOpen;
        const filterLevel = state.filterLevel;
        // Preserve auth state
        const did = state.did;
        const authenticated = state.authenticated;
        // Preserve mute state
        const originalMutedKeywords = new Set(state.originalMutedKeywords);
        const sessionMutedKeywords = new Set(state.sessionMutedKeywords);

        // Fetch fresh data
        await Promise.all([
            fetchKeywordGroups(true),
            fetchContextGroups(true),
            fetchDisplayConfig(true)
        ]);

        // Restore previous state
        state.activeKeywords = activeKeywords;
        state.selectedContexts = selectedContexts;
        state.selectedExceptions = selectedExceptions;
        state.selectedCategories = selectedCategories;
        state.mode = currentMode;
        state.menuOpen = menuOpen;
        state.filterLevel = filterLevel;
        // Restore auth state
        state.did = did;
        state.authenticated = authenticated;
        // Restore mute state
        state.originalMutedKeywords = originalMutedKeywords;
        state.sessionMutedKeywords = sessionMutedKeywords;

        console.debug('Data refreshed successfully');
    } catch (error) {
        console.error('Failed to refresh data:', error);
        throw error;
    }
}
