// Pure logic for the trending-controversy engine. No I/O here -- update.js
// orchestrates fetching and file writes so everything in this module is
// deterministic and unit-testable.

// Balanced roster across the political spectrum. The controversy signal
// REQUIRES a phrase to be hot on both left- and right-leaning outlets, so
// keep the roster balanced when editing.
export const FEEDS = [
    { source: 'npr', lean: 'left', url: 'https://feeds.npr.org/1014/rss.xml' },
    { source: 'guardian', lean: 'left', url: 'https://www.theguardian.com/us-news/rss' },
    { source: 'motherjones', lean: 'left', url: 'https://www.motherjones.com/politics/feed/' },
    { source: 'huffpost', lean: 'left', url: 'https://chaski.huffpost.com/us/auto/vertical/politics' },
    { source: 'msnbc', lean: 'left', url: 'https://www.msnbc.com/feeds/latest' },
    { source: 'vox', lean: 'left', url: 'https://www.vox.com/rss/politics/index.xml' },
    { source: 'bbc', lean: 'center', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
    { source: 'thehill', lean: 'center', url: 'https://thehill.com/homenews/feed/' },
    { source: 'abc', lean: 'center', url: 'https://abcnews.go.com/abcnews/politicsheadlines' },
    { source: 'cbs', lean: 'center', url: 'https://www.cbsnews.com/latest/rss/politics' },
    { source: 'foxnews', lean: 'right', url: 'https://moxie.foxnews.com/google-publisher/politics.xml' },
    { source: 'washingtontimes', lean: 'right', url: 'https://www.washingtontimes.com/rss/headlines/news/politics/' },
    { source: 'newsmax', lean: 'right', url: 'https://www.newsmax.com/rss/Politics/1/' },
    { source: 'breitbart', lean: 'right', url: 'https://feeds.feedburner.com/breitbart' },
    { source: 'dailywire', lean: 'right', url: 'https://www.dailywire.com/feeds/rss.xml' }
];

// Tuning knobs for scoring and retention
export const TUNING = {
    minOutlets: 3,            // distinct outlets before a phrase is considered
    addThreshold: 6,          // score needed to enter the muted list
    refreshThreshold: 3,      // score that keeps an existing phrase alive
    heatDecay: 0.75,          // per-interval multiplier (~14h half-life at 4 runs/day)
    runIntervalHours: 6,      // nominal cadence; decay/gain scale to actual elapsed time
    minRetentionDays: 3,      // one-day flaps expire quickly
    maxRetentionDays: 30,     // even huge stories eventually age out
    maxPhrases: 60,           // hard cap on the published list
    headlineMaxAgeHours: 48,  // ignore stale feed items
    properNounMinSightings: 2, // capitalized mid-headline sightings a unigram needs
    properNounMinSources: 2    // ...from at least this many distinct outlets
};

// Words that never form (or start/end) a controversy phrase
const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so', 'yet', 'as', 'at', 'by',
    'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to',
    'up', 'with', 'without', 'about', 'after', 'again', 'against', 'amid',
    'among', 'are', 'is', 'was', 'were', 'be', 'been', 'being', 'has', 'have',
    'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'may', 'might',
    'must', 'shall', 'should', 'this', 'that', 'these', 'those', 'his', 'her',
    'hers', 'its', 'their', 'theirs', 'our', 'ours', 'your', 'yours', 'my',
    'mine', 'he', 'she', 'it', 'they', 'them', 'we', 'us', 'you', 'i', 'me',
    'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
    'not', 'no', 'nor', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
    'now', 'then', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'if', 'because', 'while', 'during',
    'before', 'between', 'through', 'under', 'until', 'says', 'say', 'said',
    'new', 'first', 'last', 'latest', 'top', 'big', 'gets', 'get', 'got',
    'make', 'makes', 'made', 'take', 'takes', 'took', 'goes', 'going', 'go',
    'amid', 'despite', 'via', 'per', 'still', 'also', 'even', 'ever', 'never'
]);

// News-speak and evergreen institutions that spike constantly without being
// a specific controversy. Phrases exactly matching these are dropped.
const GENERIC_PHRASES = new Set([
    'breaking news', 'live updates', 'watch live', 'opinion', 'analysis',
    'fact check', 'exclusive', 'video', 'photos', 'podcast', 'newsletter',
    'morning brief', 'evening brief', 'week ahead', 'what to know',
    'things to know', 'takeaways', 'live blog', 'live coverage',
    'white house', 'capitol hill', 'washington', 'united states', 'america',
    'americans', 'congress', 'senate', 'house', 'supreme court', 'president',
    'republicans', 'democrats', 'republican', 'democrat', 'gop', 'politics',
    'election day', 'poll', 'polls', 'lawmakers', 'federal', 'state', 'states',
    'new york', 'los angeles', 'san francisco', 'this week', 'next week',
    // Single common nouns spike constantly and over-mute badly on their own;
    // the specific multi-word phrase ("government shutdown") still qualifies.
    // 'white'/'supreme'/'capitol' leak out of the blocklisted institution
    // phrases above via proper-noun evidence ("White House" -> "White")
    'white', 'supreme', 'capitol',
    'world', 'campaign', 'race', 'races', 'city', 'country', 'government',
    'official', 'officials', 'leader', 'leaders', 'voters', 'voter', 'court',
    'courts', 'judge', 'law', 'laws', 'money', 'people', 'today', 'tonight',
    'morning', 'week', 'year', 'years', 'day', 'days', 'time', 'times',
    'news', 'story', 'stories', 'debate', 'hearing', 'bill', 'vote', 'votes',
    'ruling', 'trial', 'report', 'deal', 'plan', 'plans', 'budget', 'party',
    'election', 'elections', 'primary', 'nominee', 'candidate', 'candidates'
]);

// --- feed parsing ---

function decodeEntities(text) {
    return text
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&#8216;|&#8217;|&rsquo;|&lsquo;/g, "'")
        .replace(/&#8220;|&#8221;|&rdquo;|&ldquo;/g, '"')
        .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '-')
        .replace(/&amp;/g, '&')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Minimal RSS 2.0 / Atom parser: we only need item titles and dates
export function parseFeedXml(xml) {
    const items = [];
    const itemBlocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || [];
    for (const block of itemBlocks) {
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        if (!titleMatch) continue;
        const title = decodeEntities(titleMatch[1]);
        if (!title) continue;

        const dateMatch = block.match(
            /<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/
        );
        let pubDate = null;
        if (dateMatch) {
            const parsed = new Date(decodeEntities(dateMatch[2]));
            if (!Number.isNaN(parsed.getTime())) pubDate = parsed.toISOString();
        }
        items.push({ title, pubDate });
    }
    return items;
}

export function filterFreshHeadlines(items, nowMs, maxAgeHours = TUNING.headlineMaxAgeHours) {
    const cutoff = nowMs - maxAgeHours * 3600 * 1000;
    return items.filter(item => {
        if (!item.pubDate) return true; // feeds without dates: assume fresh
        return new Date(item.pubDate).getTime() >= cutoff;
    });
}

// --- phrase extraction ---

function tokenize(text) {
    return text
        .split(/[^A-Za-z0-9'&.-]+/)
        // "Trump's tariffs" is about Trump, not a distinct phrase "trump's"
        .map(w => w.replace(/['’]s$/i, ''))
        .map(w => w.replace(/^[-'.&]+|[-'.&]+$/g, ''))
        .filter(w => w.length > 0);
}

// Split a headline into clauses: what follows a colon, dash or similar
// punctuation starts a new "sentence" for capitalization purposes
// ("Breaking: Strikes hit base" -- that S proves nothing). Trailing outlet
// attributions ("... - CNN Politics") become their own clause and are then
// eliminated by the cross-outlet breadth requirement, since each outlet only
// stamps its own name.
function splitClauses(title) {
    return title
        // curly apostrophes become ASCII (deleting them would glue "Trump’s"
        // into "Trumps" before the possessive strip in tokenize can run)
        .replace(/[‘’]/g, "'")
        .replace(/[“”"`]/g, '')
        .split(/[:;!?|]+|\s[-–—]\s/)
        .map(clause => clause.trim())
        .filter(clause => clause.length > 0);
}

function isUsableWord(word) {
    if (word.length < 2) return false;
    if (/^\d+$/.test(word)) return false;
    return !STOPWORDS.has(word.toLowerCase());
}

// Candidate phrases: 1-3 word n-grams whose boundary words carry meaning.
// Cross-outlet frequency (not capitalization) decides what matters, which
// keeps this robust against Title Case headlines. Returns a Map of
// phrase -> { atStart } where atStart means every occurrence in this title
// began the headline (sentence-initial capitalization proves nothing).
export function extractPhrasesFromTitle(title) {
    const phrases = new Map();

    for (const clause of splitClauses(title)) {
        const words = tokenize(clause);
        for (let n = 1; n <= 3; n++) {
            for (let i = 0; i + n <= words.length; i++) {
                const slice = words.slice(i, i + n);
                if (!isUsableWord(slice[0]) || !isUsableWord(slice[n - 1])) continue;
                // interior stopwords are fine ("secretary of state")
                const phrase = slice.join(' ');
                if (phrase.length < 4) continue;
                const canon = phrase.toLowerCase();
                if (GENERIC_PHRASES.has(canon)) continue;
                const atStart = i === 0;
                const existing = phrases.get(phrase);
                // a non-initial occurrence anywhere in the title wins
                phrases.set(phrase, { atStart: existing ? existing.atStart && atStart : atStart });
            }
        }
    }
    return phrases;
}

// headlines: [{ title, source, lean }]
export function extractCandidates(headlines) {
    const candidates = new Map(); // canon -> aggregate
    for (const { title, source, lean } of headlines) {
        for (const [phrase, { atStart }] of extractPhrasesFromTitle(title)) {
            const canon = phrase.toLowerCase();
            let entry = candidates.get(canon);
            if (!entry) {
                entry = {
                    canon,
                    displayCounts: new Map(),
                    outlets: new Set(),
                    leans: { left: new Set(), center: new Set(), right: new Set() },
                    mentions: 0,
                    midSentenceTotal: 0,
                    midSentenceCapitalized: 0,
                    midSentenceCapitalizedSources: new Set()
                };
                candidates.set(canon, entry);
            }
            entry.displayCounts.set(phrase, (entry.displayCounts.get(phrase) || 0) + 1);
            entry.outlets.add(source);
            if (entry.leans[lean]) entry.leans[lean].add(source);
            entry.mentions += 1;
            // Only mid-headline occurrences are evidence of proper-noun-ness:
            // any word gets capitalized when it starts the headline
            if (!atStart) {
                entry.midSentenceTotal += 1;
                if (/^[A-Z]/.test(phrase)) {
                    entry.midSentenceCapitalized += 1;
                    entry.midSentenceCapitalizedSources.add(source);
                }
            }
        }
    }
    return candidates;
}

function mostCommonDisplay(displayCounts) {
    let best = null;
    let bestCount = -1;
    for (const [display, count] of displayCounts) {
        if (count > bestCount) { best = display; bestCount = count; }
    }
    return best;
}

// --- scoring ---

// A phrase is "the controversy of the day" when many outlets carry it AND
// both wings of the press are shouting about it. One-sided stories score
// a fraction of bipartisan ones.
// A lone word only qualifies when it usually appears capitalized in the
// MIDDLE of headlines -- a proxy for proper nouns (Trump, Iran, Epstein).
// Sentence/clause-initial occurrences are ignored (anything is capitalized
// there), the evidence must span distinct outlets (one Title Case feed can't
// vouch alone), and sentence-case outlets vote down common nouns.
function looksLikeProperNoun(entry, tuning) {
    if (entry.midSentenceCapitalized < tuning.properNounMinSightings) return false;
    if (entry.midSentenceCapitalizedSources.size < tuning.properNounMinSources) return false;
    return entry.midSentenceCapitalized / entry.midSentenceTotal >= 0.7;
}

export function scoreCandidates(candidates, tuning = TUNING) {
    const scored = [];
    for (const entry of candidates.values()) {
        const outlets = entry.outlets.size;
        if (outlets < tuning.minOutlets) continue;
        if (!entry.canon.includes(' ') && !looksLikeProperNoun(entry, tuning)) continue;

        const left = entry.leans.left.size;
        const right = entry.leans.right.size;
        const bipartisan = left >= 1 && right >= 1;
        const spectrumFactor = bipartisan ? 1 + Math.min(left, right) * 0.25 : 0.35;

        const base = outlets + 0.5 * (entry.mentions - outlets);
        const score = base * spectrumFactor;

        scored.push({
            canon: entry.canon,
            display: mostCommonDisplay(entry.displayCounts),
            score,
            outlets,
            leftOutlets: left,
            rightOutlets: right,
            mentions: entry.mentions,
            bipartisan
        });
    }

    // Prefer the most specific phrasing: drop a shorter phrase when a longer
    // phrase containing it scores at least as well (keep "hunter biden laptop"
    // over "biden laptop" and "laptop"). Ties break toward the longer phrase.
    scored.sort((a, b) => b.score - a.score || b.canon.length - a.canon.length);
    const kept = [];
    for (const candidate of scored) {
        const absorbed = kept.some(better =>
            better.canon !== candidate.canon &&
            better.canon.includes(candidate.canon) &&
            better.score >= candidate.score * 0.8
        );
        if (!absorbed) kept.push(candidate);
    }
    return kept;
}

// --- retention state machine ---

// How long a phrase deserves to stay muted once it goes quiet: baseline three
// days, stretched by how hot it burned (log-scale) and how many distinct days
// it kept making headlines. A one-day flap gets ~3 days; a sustained national
// story creeps toward the 30-day cap.
export function retentionDays(peakHeat, daysActive, tuning = TUNING) {
    const heatBonus = 2 * Math.log2(1 + peakHeat / tuning.addThreshold);
    const persistenceBonus = daysActive / 2;
    const days = tuning.minRetentionDays + heatBonus + persistenceBonus;
    return Math.min(tuning.maxRetentionDays, Math.max(tuning.minRetentionDays, days));
}

// prevState: { phrases: { [canon]: {display, firstSeen, lastSeen, heat,
//   peakHeat, daysActive, expiresAt} } }
export function updateTrendingState(prevState, scored, nowIso, tuning = TUNING) {
    const now = new Date(nowIso);
    const nowMs = now.getTime();
    const today = nowIso.slice(0, 10);
    const scoredByCanon = new Map(scored.map(s => [s.canon, s]));
    const phrases = {};

    // Scale decay and gain to the time actually elapsed since the last run,
    // so back-to-back reruns are near-idempotent (feeds barely changed in
    // minutes -- re-adding their full score would double-count coverage) and
    // long gaps decay proportionally more
    const intervalMs = tuning.runIntervalHours * 3600 * 1000;
    const prevUpdatedMs = prevState.updatedAt
        ? new Date(prevState.updatedAt).getTime()
        : nowMs - intervalMs;
    const elapsedIntervals = Math.max(0, (nowMs - prevUpdatedMs) / intervalMs);
    const decay = Math.pow(tuning.heatDecay, Math.min(elapsedIntervals, 50));
    // Geometric-series gain keeps heat invariant to rerun frequency: n runs
    // covering one nominal interval accumulate the same heat as a single run
    // (gain(1) = 1, gain(x)+gain(y)*decay(x) = gain(x+y)). The no-decay limit
    // of the series is linear time.
    const gain = tuning.heatDecay === 1
        ? Math.min(elapsedIntervals, 50)
        : (1 - decay) / (1 - tuning.heatDecay);

    // Decay and refresh existing phrases. Entries already past their expiry
    // are NOT refreshable -- a returning story must re-qualify through the
    // newcomer path below (bipartisan + admission threshold).
    for (const [canon, prev] of Object.entries(prevState.phrases || {})) {
        if (new Date(prev.expiresAt).getTime() <= nowMs) continue;
        const hit = scoredByCanon.get(canon);
        const score = hit ? hit.score : 0;
        const heat = prev.heat * decay + score * gain;
        const peakHeat = Math.max(prev.peakHeat, heat);
        const daysActive = prev.daysActive +
            (score >= tuning.refreshThreshold && prev.lastSeen?.slice(0, 10) !== today ? 1 : 0);

        let expiresAt = prev.expiresAt;
        if (score >= tuning.refreshThreshold) {
            const ttlMs = retentionDays(peakHeat, daysActive, tuning) * 86400 * 1000;
            const refreshed = nowMs + ttlMs;
            if (!expiresAt || refreshed > new Date(expiresAt).getTime()) {
                expiresAt = new Date(refreshed).toISOString();
            }
        }

        // Expired and cold: let it go
        if (new Date(expiresAt).getTime() <= nowMs) continue;

        phrases[canon] = {
            display: hit ? hit.display : prev.display,
            firstSeen: prev.firstSeen,
            lastSeen: score >= tuning.refreshThreshold ? nowIso : prev.lastSeen,
            heat,
            peakHeat,
            daysActive,
            expiresAt,
            bipartisan: hit ? hit.bipartisan : prev.bipartisan,
            outlets: hit ? hit.outlets : prev.outlets
        };
    }

    // Admit newcomers: strong enough AND carried by both wings
    for (const hit of scored) {
        if (phrases[hit.canon]) continue;
        if (hit.score < tuning.addThreshold || !hit.bipartisan) continue;
        const ttlMs = retentionDays(hit.score, 1, tuning) * 86400 * 1000;
        phrases[hit.canon] = {
            display: hit.display,
            firstSeen: nowIso,
            lastSeen: nowIso,
            heat: hit.score,
            peakHeat: hit.score,
            daysActive: 1,
            expiresAt: new Date(nowMs + ttlMs).toISOString(),
            bipartisan: true,
            outlets: hit.outlets
        };
    }

    // Hard cap: keep the hottest phrases
    const entries = Object.entries(phrases)
        .sort(([, a], [, b]) => b.heat - a.heat)
        .slice(0, tuning.maxPhrases);

    return { updatedAt: nowIso, phrases: Object.fromEntries(entries) };
}

// --- output ---

// Word-level phrase overlap, treating singular/plural as the same token, so
// "Maine Senate"~"Maine", "Trumps"~"Trump", "Charlie Kirk"~"Kirk" all match
// but "art" never matches inside "martial law"
function tokenMatches(a, b) {
    return a === b || a === `${b}s` || b === `${a}s`;
}

function phraseContains(bigger, smaller) {
    const big = bigger.split(' ');
    const small = smaller.split(' ');
    if (small.length > big.length) return false;
    for (let i = 0; i + small.length <= big.length; i++) {
        if (small.every((word, j) => tokenMatches(word, big[i + j]))) return true;
    }
    return false;
}

export function phraseOverlaps(a, b) {
    return phraseContains(a, b) || phraseContains(b, a);
}

// Strip phrases overlapping the permanent keyword lists from both the carried
// state and the fresh scores BEFORE updateTrendingState runs its maxPhrases
// cap -- a permanently-muted "Trump" must not occupy a slot an eligible
// phrase could use. Pure so update.js stays orchestration-only.
export function excludePermanent(prevState, scored, excludeKeywords) {
    const excludeList = Array.from(excludeKeywords, keyword => keyword.toLowerCase());
    if (excludeList.length === 0) return { prevState, scored };
    const excluded = canon => excludeList.some(keyword => phraseOverlaps(canon, keyword));
    return {
        prevState: {
            ...prevState,
            phrases: Object.fromEntries(
                Object.entries(prevState.phrases || {}).filter(([canon]) => !excluded(canon))
            )
        },
        scored: scored.filter(hit => !excluded(hit.canon))
    };
}

// Map heat percentile onto mutesky weights: weight 3 phrases surface even at
// the app's "Minimal" filter level, so reserve it for the top of the list.
// The category name matches calm-the-chaos's "New Developments" so the app
// merges these phrases into that existing card (js/api/trending.js).
// excludeKeywords carries the permanent calm-the-chaos keywords: anything
// already muted there (or overlapping it, like "Kirk" vs "Charlie Kirk")
// stays off the trending list, and overlapping trending phrases keep only
// the hottest variant ("Maine" wins over "Maine Senate").
export function buildTrendingCategory(state, { categoryName = 'New Developments', excludeKeywords = [] } = {}) {
    const excluded = Array.from(excludeKeywords, keyword => keyword.toLowerCase());
    const entries = Object.entries(state.phrases || {}).sort(([, a], [, b]) => b.heat - a.heat);
    const kept = [];
    for (const [canon, entry] of entries) {
        if (GENERIC_PHRASES.has(canon)) continue;
        if (excluded.some(keyword => phraseOverlaps(canon, keyword))) continue;
        if (kept.some(([keptCanon]) => phraseOverlaps(canon, keptCanon))) continue;
        kept.push([canon, entry]);
    }

    const keywords = {};
    kept.forEach(([, entry], index) => {
        const percentile = kept.length === 1 ? 0 : index / kept.length;
        const weight = percentile < 0.2 ? 3 : percentile < 0.5 ? 2 : 1;
        keywords[entry.display] = {
            weight,
            description: `In ${entry.outlets} outlets across the spectrum (since ${entry.firstSeen.slice(0, 10)})`
        };
    });

    return {
        [categoryName]: {
            description: "Today's controversies from across the news spectrum, updated automatically",
            updatedAt: state.updatedAt,
            keywords
        }
    };
}
