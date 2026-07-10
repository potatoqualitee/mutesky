// Re-export everything from the new modular structure
export {
    keywordCache,
    debouncedUpdate,
    notifyKeywordChanges,
    standardUpdate,
    isKeywordActive,
    removeKeyword,
    processBatchKeywords,
    handleKeywordToggle,
    handleCategoryToggle,
    handleEnableAll,
    handleDisableAll
} from './keywords/index.js';
