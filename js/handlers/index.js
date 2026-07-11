export { handleAuth, handleLogout } from './authHandlers.js';
export { handleContextToggle, handleExceptionToggle, updateSimpleModeState } from './context/contextHandlers.js';
export { handleMuteSubmit, initializeKeywordState } from './muteHandlers.js';
export { switchMode, handleRefreshData, showApp } from './uiHandlers.js';
export { handleFooterThemeToggle } from './themeHandlers.js';
export {
    handleMyKeywordsModalToggle,
    handleMyKeywordsAdd,
    handleMyKeywordsRemove
} from './myKeywordsHandlers.js';
export {
    handleSettingsModalToggle,
    applyAppearanceSettings,
    loadAppearanceSettings,
    saveAppearanceSettings,
    loadMuteSettings,
    saveMuteSettings,
    getExpirationDate
} from './settingsHandlers.js';
