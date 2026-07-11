import { state, saveState } from './state.js';

const MY_KEYWORDS_CATEGORY = 'My Keywords';
export const MANAGED_ORIGIN_CATALOG = 'catalog';
export const MANAGED_ORIGIN_TRENDING = 'trending';
export const MANAGED_ORIGIN_MY_KEYWORD = 'my-keyword';
export const MANAGED_ORIGIN_RETIRED_DEFAULT = 'retired-default';

const ORIGIN_PRIORITY = {
    [MANAGED_ORIGIN_TRENDING]: 0,
    [MANAGED_ORIGIN_CATALOG]: 1,
    [MANAGED_ORIGIN_RETIRED_DEFAULT]: 2,
    [MANAGED_ORIGIN_MY_KEYWORD]: 3
};

function ensureLedger(appState) {
    if (!(appState.managedKeywordLedger instanceof Map)) {
        appState.managedKeywordLedger = new Map();
    }
    if (!(appState.currentTrendingKeywords instanceof Set)) {
        appState.currentTrendingKeywords = new Set();
    }
}

function setContains(set, keyword) {
    const lower = keyword.toLowerCase();
    for (const entry of set || []) {
        if (entry.toLowerCase() === lower) return true;
    }
    return false;
}

export function hasRecordedManagedOwnership(keyword, appState = state) {
    ensureLedger(appState);
    const lower = keyword.toLowerCase();
    return appState.managedKeywordLedger.has(lower)
        || setContains(appState.myKeywords, lower);
}

// A current catalog collision with an unknown Bluesky mute remains user-owned
// until local state records MuteSky ownership or the user explicitly acts on it.
export function shouldManageCurrentKeyword(keyword, appState = state) {
    ensureLedger(appState);
    const lower = keyword.toLowerCase();
    if (!appState.originalMutedKeywords?.has(lower)) return true;
    return appState.managedKeywordLedger.has(lower)
        || setContains(appState.activeKeywords, lower)
        || setContains(appState.manuallyUnchecked, lower)
        || setContains(appState.myKeywords, lower)
        || appState.removedMyKeywords?.has(lower);
}

function provenanceOrigin(appState, keyword) {
    const origin = appState.myKeywordProvenance?.get(keyword.toLowerCase())?.origin;
    return origin === MANAGED_ORIGIN_RETIRED_DEFAULT
        ? MANAGED_ORIGIN_RETIRED_DEFAULT
        : MANAGED_ORIGIN_MY_KEYWORD;
}

export function getCurrentManagedKeywordSources(appState = state) {
    ensureLedger(appState);
    const sources = new Map();

    for (const [category, categoryData] of Object.entries(appState.keywordGroups || {})) {
        for (const keyword of Object.keys(categoryData?.[category]?.keywords || {})) {
            const lower = keyword.toLowerCase();
            const origin = category === MY_KEYWORDS_CATEGORY
                ? provenanceOrigin(appState, keyword)
                : MANAGED_ORIGIN_CATALOG;
            const existing = sources.get(lower);
            if (!existing || ORIGIN_PRIORITY[origin] > ORIGIN_PRIORITY[existing.origin]) {
                sources.set(lower, { keyword, origin });
            }
        }
    }

    // mergeTrendingIntoState records only phrases it actually introduced;
    // collisions with permanent categories are deliberately not in this set.
    for (const lower of appState.currentTrendingKeywords) {
        const existing = sources.get(lower);
        if (existing?.origin === MANAGED_ORIGIN_CATALOG) {
            sources.set(lower, { ...existing, origin: MANAGED_ORIGIN_TRENDING });
        }
    }

    return sources;
}

export function buildManagedKeywordLedger(selectedKeywords, appState = state) {
    const sources = getCurrentManagedKeywordSources(appState);
    const ledger = new Map();
    for (const keyword of selectedKeywords || []) {
        const lower = keyword.toLowerCase();
        const source = sources.get(lower);
        if (source) ledger.set(lower, { keyword: source.keyword, origin: source.origin });
    }
    return ledger;
}

// Called only after Bluesky accepts the preference update. Replacing rather
// than merging forgets keywords that the same successful submit just unmuted.
export function updateManagedKeywordLedgerAfterSubmit(selectedKeywords, appState = state) {
    const previous = appState.managedKeywordLedger instanceof Map
        ? new Map(appState.managedKeywordLedger)
        : new Map();
    const currentSources = getCurrentManagedKeywordSources(appState);
    const next = buildManagedKeywordLedger(selectedKeywords, appState);

    // A failed/malformed trending fetch gives us no evidence that an old trend
    // expired. If the submit could not manage that missing source, retain its
    // ownership so a later successful snapshot can clean it up safely. When a
    // stale rendered source was explicitly unselected, or the user promoted it
    // to My Keywords, the successful submit still wins.
    if (!appState.trendingSnapshotLoaded) {
        for (const [lower, entry] of previous) {
            if (entry?.origin !== MANAGED_ORIGIN_TRENDING) continue;
            const nextEntry = next.get(lower);
            if (nextEntry
                && nextEntry.origin !== MANAGED_ORIGIN_MY_KEYWORD
                && nextEntry.origin !== MANAGED_ORIGIN_RETIRED_DEFAULT) {
                next.set(lower, entry);
            } else if (!nextEntry && !currentSources.has(lower)) {
                next.set(lower, entry);
            }
        }
    }

    appState.managedKeywordLedger = next;
    if (appState === state) saveState();
    return appState.managedKeywordLedger;
}

export function getExpiredTrendingKeywordKeys(appState = state) {
    ensureLedger(appState);
    const expired = new Set();
    if (!appState.trendingSnapshotLoaded) return expired;

    const current = getCurrentManagedKeywordSources(appState);
    for (const [lower, entry] of appState.managedKeywordLedger) {
        if (entry?.origin === MANAGED_ORIGIN_TRENDING && !current.has(lower)) {
            expired.add(lower);
        }
    }
    return expired;
}

// Expired trends stay in the managed list for exactly one more successful
// submit, but are forcibly absent from the selection. This makes the submit
// remove them instead of MuteService preserving them as user-custom words.
export function reconcileExpiredTrendingKeywords(appState = state) {
    const expired = getExpiredTrendingKeywordKeys(appState);
    for (const keyword of expired) {
        for (const active of appState.activeKeywords || []) {
            if (active.toLowerCase() === keyword) {
                appState.activeKeywords.delete(active);
                break;
            }
        }
    }
    return expired;
}
