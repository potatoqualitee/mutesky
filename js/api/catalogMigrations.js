import { CATALOG_MIGRATIONS_URL } from '../config.js';
import { state, saveState } from '../state.js';
import {
    MY_KEYWORDS_CATEGORY,
    MY_KEYWORD_ORIGIN_RETIRED_DEFAULT,
    MY_KEYWORD_ORIGIN_USER,
    getMyKeywordProvenance,
    syncMyKeywordsCategory
} from '../myKeywords.js';

let manifestPromise = null;

function findCased(set, keyword) {
    const lower = keyword.toLowerCase();
    for (const entry of set || []) {
        if (entry.toLowerCase() === lower) return entry;
    }
    return null;
}

function currentManagedKeywords(appState) {
    const keywords = new Map();
    for (const [category, categoryData] of Object.entries(appState.keywordGroups || {})) {
        if (category === MY_KEYWORDS_CATEGORY) continue;
        for (const keyword of Object.keys(categoryData?.[category]?.keywords || {})) {
            keywords.set(keyword.toLowerCase(), keyword);
        }
    }
    return keywords;
}

function migrationId(batch, change, keyword) {
    if (typeof change.id === 'string' && change.id.trim()) return change.id.trim();
    const version = typeof batch.version === 'string' && batch.version.trim()
        ? batch.version.trim()
        : 'catalog';
    const type = String(change.type).toLowerCase();
    const replacement = type === 'rename' ? String(change.to || '').trim().toLowerCase() : '';
    const suffix = replacement ? `${keyword.toLowerCase()}->${replacement}` : keyword.toLowerCase();
    return `${version}:${type}:${suffix}`;
}

// Convert the shared append-only schema into explicit retire/rename operations
// that preserve an existing preference. No catalog diff, missing file, or
// trending expiry can create one.
export function getPreservedRetirements(manifest) {
    if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) {
        return [];
    }

    const retirements = [];
    for (const batch of manifest.migrations) {
        if (!batch || !Array.isArray(batch.changes)) continue;
        for (const change of batch.changes) {
            if (!change) continue;
            const type = String(change.type).toLowerCase();
            let keyword = '';
            let replacement = null;
            if (type === 'retire') {
                if (change.preserveExistingMute === false) continue;
                keyword = typeof change.keyword === 'string' ? change.keyword.trim() : '';
            } else if (type === 'rename') {
                if (change.preservePreference === false) continue;
                keyword = typeof change.from === 'string' ? change.from.trim() : '';
                replacement = typeof change.to === 'string' ? change.to.trim() : '';
                if (!replacement) continue;
            } else {
                continue;
            }
            if (!keyword) continue;

            retirements.push({
                id: migrationId(batch, change, keyword),
                keyword,
                operation: type,
                replacement,
                catalogVersion: manifest.catalogVersion || null,
                version: batch.version || null,
                releasedAt: batch.releasedAt || null,
                category: change.category || null,
                lifecycle: change.lifecycle || null,
                reason: change.reason || null
            });
        }
    }
    return retirements;
}

export function reconcileCatalogMigrations(appState, manifest) {
    if (!(appState.myKeywordProvenance instanceof Map)) appState.myKeywordProvenance = new Map();
    if (!(appState.appliedCatalogMigrations instanceof Set)) appState.appliedCatalogMigrations = new Set();

    const current = currentManagedKeywords(appState);
    const result = { added: [], staged: [], applied: [], stateChanged: false };

    for (const retirement of getPreservedRetirements(manifest)) {
        if (appState.appliedCatalogMigrations.has(retirement.id)) continue;

        const lower = retirement.keyword.toLowerCase();
        // The manifest and category files normally publish atomically. If a
        // cache briefly serves the old catalog, wait instead of consuming the migration.
        if (current.has(lower)) continue;

        // A migration is evaluated once per DID, after real Bluesky mute state
        // has loaded. Marking even a no-op prevents a future unrelated mute of
        // the same phrase from being claimed retroactively.
        appState.appliedCatalogMigrations.add(retirement.id);
        result.applied.push(retirement.id);
        result.stateChanged = true;

        if (findCased(appState.manuallyUnchecked, retirement.keyword)) continue;

        const activeCase = findCased(appState.activeKeywords, retirement.keyword);
        const actuallyMuted = appState.originalMutedKeywords?.has(lower);
        if (!activeCase && !actuallyMuted) continue;

        const existing = findCased(appState.myKeywords, retirement.keyword);
        if (existing) {
            // Legacy entries without metadata, and anything a user typed, are
            // user-owned. A remote manifest can never rename or downgrade it.
            if (!appState.myKeywordProvenance.has(lower)) {
                appState.myKeywordProvenance.set(lower, { origin: MY_KEYWORD_ORIGIN_USER });
            }
            if (getMyKeywordProvenance(existing, appState).origin === MY_KEYWORD_ORIGIN_USER) {
                if (!activeCase && actuallyMuted) appState.activeKeywords.add(existing);
                continue;
            }
        }

        if (retirement.operation === 'rename' && retirement.replacement) {
            const replacementLower = retirement.replacement.toLowerCase();
            const replacementCase = current.get(replacementLower);
            if (replacementCase
                && !findCased(appState.manuallyUnchecked, replacementCase)
                && !findCased(appState.activeKeywords, replacementCase)) {
                appState.activeKeywords.add(replacementCase);
                result.staged.push(replacementCase);
            }
        }
        if (existing) {
            if (!activeCase && actuallyMuted) appState.activeKeywords.add(existing);
            continue;
        }

        const displayKeyword = activeCase || retirement.keyword;
        appState.myKeywords.add(displayKeyword);
        appState.myKeywordProvenance.set(lower, {
            origin: MY_KEYWORD_ORIGIN_RETIRED_DEFAULT,
            migrationId: retirement.id,
            catalogVersion: retirement.catalogVersion,
            operation: retirement.operation,
            replacement: retirement.replacement,
            retiredIn: retirement.version,
            releasedAt: retirement.releasedAt,
            category: retirement.category,
            lifecycle: retirement.lifecycle,
            reason: retirement.reason
        });
        appState.removedMyKeywords?.delete(lower);
        if (!activeCase) appState.activeKeywords.add(displayKeyword);
        result.added.push(displayKeyword);
    }

    return result;
}

export async function fetchCatalogMigrations(forceFresh = false) {
    if (forceFresh) manifestPromise = null;
    if (!manifestPromise) {
        manifestPromise = (async () => {
            try {
                const response = await fetch(CATALOG_MIGRATIONS_URL, { cache: 'no-store' });
                if (!response.ok) {
                    console.debug('[Catalog migrations] Manifest unavailable:', response.status);
                    return null;
                }
                return await response.json();
            } catch (error) {
                // Migration support is additive; an unavailable manifest must
                // never stop the core app or trigger inferred removals.
                console.debug('[Catalog migrations] Fetch failed:', error);
                return null;
            }
        })();
    }
    return manifestPromise;
}

export async function applyCatalogMigrations({ forceFresh = false, manifest = undefined } = {}) {
    const loaded = manifest === undefined
        ? await fetchCatalogMigrations(forceFresh)
        : manifest;
    if (!loaded) return { added: [], staged: [], applied: [], stateChanged: false };

    const result = reconcileCatalogMigrations(state, loaded);
    if (result.added.length > 0) syncMyKeywordsCategory();
    if (result.stateChanged) saveState();
    return result;
}

export function clearCatalogMigrationCache() {
    manifestPromise = null;
}
