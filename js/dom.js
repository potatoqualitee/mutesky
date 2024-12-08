export const elements = {
    landingPage: document.getElementById('landing-page'),
    appInterface: document.getElementById('app-interface'),
    authButton: document.getElementById('bsky-login-btn'),
    handleInput: document.getElementById('bsky-handle-input'),
    logoutButton: document.getElementById('bsky-logout-btn'),
    modeToggles: document.querySelectorAll('.mode-switch'),
    simpleMode: document.getElementById('simple-mode'),
    advancedMode: document.getElementById('advanced-mode'),
    contextOptions: document.getElementById('context-options'),
    exceptionsPanel: document.querySelector('.exceptions-panel'),
    exceptionTags: document.getElementById('exception-tags'),
    searchInput: document.getElementById('keyword-search'),
    sidebarSearch: document.getElementById('sidebar-search'),
    categoriesGrid: document.getElementById('categories-grid'),
    categoryList: document.getElementById('category-list'),
    sidebarLastUpdate: document.getElementById('sidebar-last-update'),
    activeCount: document.getElementById('active-count'),
    lastUpdate: document.getElementById('last-update'),
    muteButton: document.querySelector('.btn-mute-keywords'),
    navMuteButton: document.querySelector('.nav-mute-button'),
    profileButton: document.querySelector('.profile-button'),
    userMenuDropdown: document.querySelector('.user-menu-dropdown'),
    enableAllBtn: document.getElementById('enable-all'),
    disableAllBtn: document.getElementById('disable-all'),
    refreshButton: document.getElementById('refresh-data'),

    // Settings modal elements
    settingsButton: document.getElementById('muting-settings'),
    settingsModal: document.getElementById('settings-modal'),

    // Appearance modal elements
    appearanceButton: document.getElementById('appearance-settings'),
    appearanceModal: document.getElementById('appearance-modal'),
    colorModeToggles: document.querySelectorAll('.mode-switch[data-theme]'),
    darkThemeToggles: document.querySelectorAll('.theme-switch[data-dark-theme]'),
    fontToggles: document.querySelectorAll('.font-switch[data-font]'),
    fontSizeToggles: document.querySelectorAll('.font-switch[data-size]'),

    // Bluesky specific elements
    bskyHandle: document.getElementById('bsky-handle')
};
