#!/usr/bin/env node
// Fetch political headlines across the spectrum, score the day's
// controversies, and refresh keywords/trending.json + trending-state.json.
// Run by .github/workflows/trending.yml every 6 hours. No dependencies --
// plain Node 22 with built-in fetch.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    FEEDS,
    TUNING,
    parseFeedXml,
    filterFreshHeadlines,
    extractCandidates,
    scoreCandidates,
    updateTrendingState,
    buildTrendingCategory,
    excludePermanent
} from './lib.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE_PATH = path.join(repoRoot, 'keywords', 'trending-state.json');
const OUTPUT_PATH = path.join(repoRoot, 'keywords', 'trending.json');
const FETCH_TIMEOUT_MS = 15000;
// Prolific feeds (Daily Beast ships 100 items) must not out-shout everyone
// else: mentions feed the score, so cap each outlet at its newest items
const MAX_ITEMS_PER_FEED = 40;

async function fetchFeed({ source, lean, url }) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'MuteSky-Trending/1.0 (+https://mutesky.app)' }
    });
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    const xml = await response.text();
    const now = Date.now();
    // Feeds aren't guaranteed newest-first: order by date (undated items
    // count as now, matching the freshness filter) before keeping the cap
    const items = filterFreshHeadlines(parseFeedXml(xml), now)
        .sort((a, b) => (b.pubDate ? Date.parse(b.pubDate) : now) - (a.pubDate ? Date.parse(a.pubDate) : now))
        .slice(0, MAX_ITEMS_PER_FEED);
    return items.map(item => ({ title: item.title, source, lean }));
}

// Optional enrichment: Brave News search when a key is configured. The
// pipeline works from RSS alone; this just widens coverage.
async function fetchBraveNews(apiKey) {
    const url = 'https://api.search.brave.com/res/v1/news/search?q=politics+controversy&freshness=pd&count=50';
    const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`brave: HTTP ${response.status}`);
    const data = await response.json();
    return (data.results || []).map(result => ({
        title: result.title || '',
        source: `brave:${result.meta_url?.hostname || 'unknown'}`,
        lean: 'center'
    })).filter(h => h.title);
}

async function loadJson(filePath, fallback) {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

// The permanent calm-the-chaos lists already mute the big recurring names
// (Trump, Iran, Charlie Kirk...); trending must not re-list them. Best-effort:
// on failure we publish without exclusions and the app dedupes client-side.
const CALM_THE_CHAOS = 'https://raw.githubusercontent.com/potatoqualitee/calm-the-chaos/main/keywords';

async function fetchPermanentKeywords() {
    const keywords = new Set();
    try {
        const listing = await fetch(
            'https://api.github.com/repos/potatoqualitee/calm-the-chaos/contents/keywords/categories',
            { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'User-Agent': 'MuteSky-Trending/1.0' } }
        );
        if (!listing.ok) throw new Error(`listing: HTTP ${listing.status}`);
        const files = (await listing.json())
            .map(file => file.name)
            .filter(name => name.endsWith('.json'));

        const results = await Promise.allSettled(files.map(async name => {
            const response = await fetch(`${CALM_THE_CHAOS}/categories/${name}`, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const category = data[Object.keys(data)[0]];
            Object.keys(category?.keywords || {}).forEach(kw => keywords.add(kw.toLowerCase()));
        }));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) console.warn(`permanent keyword lists: ${failed}/${files.length} files failed`);
    } catch (error) {
        console.warn(`permanent keyword fetch failed (publishing without exclusions): ${error.message}`);
    }
    console.log(`permanent keywords for exclusion: ${keywords.size}`);
    return keywords;
}

async function main() {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const headlines = [];
    let failed = 0;
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            headlines.push(...result.value);
        } else {
            failed++;
            console.warn(`feed failed: ${FEEDS[i].source} -- ${result.reason?.message || result.reason}`);
        }
    });

    if (process.env.BRAVE_API_KEY) {
        try {
            headlines.push(...await fetchBraveNews(process.env.BRAVE_API_KEY));
            console.log('brave news enrichment: on');
        } catch (error) {
            console.warn(`brave enrichment failed: ${error.message}`);
        }
    }

    console.log(`headlines: ${headlines.length} from ${FEEDS.length - failed}/${FEEDS.length} feeds`);

    // A network-wide outage must not wipe the published list: bail without
    // writing rather than decay everything against an empty day
    if (headlines.length < 20) {
        console.error('too few headlines fetched; refusing to update state');
        process.exit(1);
    }

    // Raw headlines for the codex curation pass in trending.yml
    if (process.env.HEADLINES_OUT) {
        await writeFile(process.env.HEADLINES_OUT, JSON.stringify(headlines, null, 2) + '\n');
    }

    const nowIso = new Date().toISOString();
    const loadedState = await loadJson(STATE_PATH, { phrases: {} });
    const excludeKeywords = await fetchPermanentKeywords();

    const candidates = extractCandidates(headlines);
    // buildTrendingCategory filters excluded phrases again as the net for
    // runs where the permanent fetch failed and something entered state
    const { prevState, scored } = excludePermanent(
        loadedState, scoreCandidates(candidates), excludeKeywords
    );
    const state = updateTrendingState(prevState, scored, nowIso);
    const category = buildTrendingCategory(state, { excludeKeywords });

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
    await writeFile(OUTPUT_PATH, JSON.stringify(category, null, 2) + '\n');

    const phraseCount = Object.keys(state.phrases).length;
    const top = Object.values(state.phrases)
        .sort((a, b) => b.heat - a.heat)
        .slice(0, 10)
        .map(p => `${p.display} (heat ${p.heat.toFixed(1)}, until ${p.expiresAt.slice(0, 10)})`);
    console.log(`tracking ${phraseCount} phrases; hottest:\n  ${top.join('\n  ') || '(none)'}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
