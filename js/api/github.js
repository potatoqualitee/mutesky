import { cache } from './cache.js';

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

export async function getLastModifiedDate() {
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

export async function listCategoryFiles() {
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
