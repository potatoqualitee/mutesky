// Re-export everything from the new modular structure
export { cache } from './api/cache.js';
export { getLastModifiedDate, listCategoryFiles } from './api/github.js';
export { fetchKeywordGroups, fetchContextGroups, fetchDisplayConfig, refreshAllData } from './api/index.js';
export { fetchTrendingKeywords } from './api/trending.js';
export { ensureHolidaysCategory, mergeHolidaysIntoState, HOLIDAYS_CONTEXT_ID } from './api/holidays.js';
