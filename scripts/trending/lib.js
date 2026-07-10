// Pure logic for the trending-controversy engine. No I/O here -- update.js
// orchestrates fetching and file writes so everything in this module is
// deterministic and unit-testable.

// Balanced roster across the political spectrum. The controversy signal
// REQUIRES a phrase to be hot on both left- and right-leaning outlets, so
// keep the roster balanced when editing. Every URL here was probed live
// before inclusion; msnbc (empty feed), washingtontimes (403) and newsmax
// (timeouts) were dropped 2026-07 after going dark.
export const FEEDS = [
    { source: 'npr', lean: 'left', url: 'https://feeds.npr.org/1014/rss.xml' },
    { source: 'guardian', lean: 'left', url: 'https://www.theguardian.com/us-news/rss' },
    { source: 'motherjones', lean: 'left', url: 'https://www.motherjones.com/politics/feed/' },
    { source: 'huffpost', lean: 'left', url: 'https://chaski.huffpost.com/us/auto/vertical/politics' },
    { source: 'vox', lean: 'left', url: 'https://www.vox.com/rss/politics/index.xml' },
    { source: 'slate', lean: 'left', url: 'https://slate.com/feeds/news-and-politics.rss' },
    { source: 'newrepublic', lean: 'left', url: 'https://newrepublic.com/rss.xml' },
    { source: 'dailybeast', lean: 'left', url: 'https://www.thedailybeast.com/arc/outboundfeeds/rss/articles/' },
    { source: 'theintercept', lean: 'left', url: 'https://theintercept.com/feed/?rss' },
    { source: 'bbc', lean: 'center', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
    { source: 'thehill', lean: 'center', url: 'https://thehill.com/homenews/feed/' },
    { source: 'abc', lean: 'center', url: 'https://abcnews.go.com/abcnews/politicsheadlines' },
    { source: 'cbs', lean: 'center', url: 'https://www.cbsnews.com/latest/rss/politics' },
    { source: 'politico', lean: 'center', url: 'https://rss.politico.com/politics-news.xml' },
    { source: 'axios', lean: 'center', url: 'https://api.axios.com/feed/' },
    { source: 'nbc', lean: 'center', url: 'https://feeds.nbcnews.com/nbcnews/public/politics' },
    { source: 'upi', lean: 'center', url: 'https://rss.upi.com/news/us_news.rss' },
    { source: 'memeorandum', lean: 'center', url: 'https://www.memeorandum.com/feed.xml' },
    { source: 'foxnews', lean: 'right', url: 'https://moxie.foxnews.com/google-publisher/politics.xml' },
    { source: 'breitbart', lean: 'right', url: 'https://feeds.feedburner.com/breitbart' },
    { source: 'dailywire', lean: 'right', url: 'https://www.dailywire.com/feeds/rss.xml' },
    { source: 'nypost', lean: 'right', url: 'https://nypost.com/politics/feed/' },
    { source: 'nationalreview', lean: 'right', url: 'https://www.nationalreview.com/feed/' },
    { source: 'thefederalist', lean: 'right', url: 'https://thefederalist.com/feed/' },
    { source: 'dailycaller', lean: 'right', url: 'https://dailycaller.com/feed/' },
    { source: 'freebeacon', lean: 'right', url: 'https://freebeacon.com/feed/' },
    { source: 'theblaze', lean: 'right', url: 'https://www.theblaze.com/feeds/feed.rss' }
];

// Tuning knobs for scoring and retention
export const TUNING = {
    minOutlets: 3,            // distinct outlets before a phrase is considered
    addThreshold: 5,          // score needed to enter the muted list
    broadOutlets: 6,          // outlet breadth that admits a non-bipartisan story
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
    'amid', 'despite', 'via', 'per', 'still', 'also', 'even', 'ever', 'never',
    // Headline-speak verbs: Title Case outlets capitalize them mid-headline,
    // which briefly published "Reveals" as a muted keyword. A verb never
    // names a controversy, so none may bound a phrase.
    'reveals', 'reveal', 'revealed', 'announces', 'announced', 'warns',
    'warned', 'claims', 'claimed', 'admits', 'admitted', 'denies', 'denied',
    'confirms', 'confirmed', 'responds', 'reacts', 'slams', 'slammed',
    'blasts', 'blasted', 'rips', 'mocks', 'touts', 'urges', 'urged', 'vows',
    'vowed', 'pledges', 'demands', 'demanded', 'accuses', 'accused',
    'defends', 'defended', 'faces', 'facing', 'seeks', 'seeking', 'sought',
    'eyes', 'weighs', 'pushes', 'pushed', 'calls', 'calling', 'called',
    'tells', 'telling', 'told', 'asks', 'asked', 'sparks', 'sparked',
    'threatens', 'threatened', 'breaks', 'broke', 'wins', 'won', 'loses',
    'lost', 'dies', 'died', 'sues', 'sued', 'hits', 'backs', 'backed'
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
    // phrases above via proper-noun evidence ("White House" -> "White"),
    // and 'york'/'jersey'/'england'... leak the same way out of two-word
    // place names whose first word is a stopword ("New York" -> "York")
    'white', 'supreme', 'capitol', 'york', 'jersey', 'hampshire', 'orleans',
    'england', 'carolina', 'dakota', 'vegas', 'angeles',
    'american', 'democratic', 'black', 'force',
    'south', 'north', 'east', 'west',
    'world', 'campaign', 'race', 'races', 'city', 'country', 'government',
    'official', 'officials', 'leader', 'leaders', 'voters', 'voter', 'court',
    'courts', 'judge', 'law', 'laws', 'money', 'people', 'today', 'tonight',
    'morning', 'week', 'year', 'years', 'day', 'days', 'time', 'times',
    'news', 'story', 'stories', 'debate', 'hearing', 'bill', 'vote', 'votes',
    'ruling', 'trial', 'report', 'deal', 'plan', 'plans', 'budget', 'party',
    'election', 'elections', 'primary', 'nominee', 'candidate', 'candidates',
    // Month names read as proper nouns mid-headline ("Fourth of July"
    // briefly published "July"); holiday phrases live in the bundled
    // us-holidays list, which isn't part of the permanent-keyword fetch
    'january', 'february', 'march', 'april', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
    'fourth of july',
    // Bare state and big-city names over-mute badly (vacation photos, sports,
    // weather); the specific phrase ("maine senate") still qualifies. The
    // curation pass used to catch these one at a time -- block them all.
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
    'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'north carolina',
    'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
    'utah', 'vermont', 'virginia', 'west virginia', 'wisconsin', 'wyoming',
    'chicago', 'houston', 'phoenix', 'philadelphia', 'dallas', 'austin',
    'boston', 'seattle', 'denver', 'miami', 'atlanta', 'detroit',
    'portland', 'minneapolis', 'baltimore', 'las vegas', 'new orleans',
    // Sports and entertainment evergreens spike broadly without being
    // controversies ("World Cup" made the list during the 2026 tournament)
    'world cup', 'super bowl', 'olympics', 'olympic games', 'world series',
    'nba', 'nfl', 'mlb', 'nhl', 'ncaa', 'playoffs', 'grammys', 'oscars',
    'box office'
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

// Split a headline into clauses: what follows a colon, dash, parenthesis or
// similar punctuation starts a new "sentence" for capitalization purposes
// ("Breaking: Strikes hit base" -- that S proves nothing). Trailing outlet
// attributions ("... - CNN Politics", memeorandum's "(Author/Outlet)")
// become their own clause and are then eliminated by the cross-outlet
// breadth requirement, since each outlet only stamps its own name.
function splitClauses(title) {
    return title
        // curly apostrophes become ASCII (deleting them would glue "Trump’s"
        // into "Trumps" before the possessive strip in tokenize can run)
        .replace(/[‘’]/g, "'")
        .replace(/[“”"`]/g, '')
        .split(/[:;!?|()[\]]+|\s[-–—]\s/)
        .map(clause => clause.trim())
        .filter(clause => clause.length > 0);
}

function isUsableWord(word) {
    if (word.length < 2) return false;
    if (/^\d+$/.test(word)) return false;
    return !STOPWORDS.has(word.toLowerCase());
}

// Title Case outlets capitalize every headline word, so a mid-headline
// capital there proves nothing about proper-noun-ness -- two Title Case
// feeds once vouched "Reveals" into the published list. Capitalization
// only counts as evidence when the mid-clause words around it follow a
// sentence-case pattern: 75%+ of non-stopword words past the clause start
// capitalized reads as house style, not names.
function titleCaseSignal(title) {
    let candidates = 0;
    let capitalized = 0;
    for (const clause of splitClauses(title)) {
        const words = tokenize(clause);
        for (let i = 1; i < words.length; i++) {
            if (!/^[A-Za-z]/.test(words[i])) continue;
            if (STOPWORDS.has(words[i].toLowerCase())) continue;
            candidates += 1;
            if (/^[A-Z]/.test(words[i])) capitalized += 1;
        }
    }
    return { candidates, capitalized };
}

export function titleIsTitleCase(title) {
    const { candidates, capitalized } = titleCaseSignal(title);
    return candidates >= 2 && capitalized / candidates >= 0.75;
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

    // A short headline ("Court Backs Gerrymander") has too few words to
    // judge its case style alone, so style is also decided per source over
    // its whole batch: an outlet whose headlines are overwhelmingly
    // capitalized writes Title Case as house style. The source verdict is
    // only a fallback for inconclusive headlines -- aggregators
    // (memeorandum) mix styles in one feed, and a conclusively
    // sentence-case item there still carries real evidence.
    const styleBySource = new Map();
    for (const { title, source } of headlines) {
        const agg = styleBySource.get(source) || { candidates: 0, capitalized: 0 };
        const signal = titleCaseSignal(title);
        agg.candidates += signal.candidates;
        agg.capitalized += signal.capitalized;
        styleBySource.set(source, agg);
    }
    const titleCaseSources = new Set(
        [...styleBySource].filter(([, agg]) =>
            agg.candidates >= 2 && agg.capitalized / agg.candidates >= 0.75
        ).map(([source]) => source)
    );

    for (const { title, source, lean } of headlines) {
        const signal = titleCaseSignal(title);
        const titleCase = signal.candidates >= 2
            ? signal.capitalized / signal.candidates >= 0.75
            : titleCaseSources.has(source);
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
            // Only mid-headline occurrences in sentence-case headlines are
            // evidence of proper-noun-ness: any word gets capitalized when it
            // starts the headline, and Title Case outlets capitalize all of them
            if (!atStart && !titleCase) {
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
// both wings of the press are shouting about it. A wing plus broad center
// coverage scores decently (mainstream story the other wing words
// differently); pure one-wing stories score a fraction of bipartisan ones.
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
        const center = entry.leans.center.size;
        const bipartisan = left >= 1 && right >= 1;
        // A wing plus solid center pickup is a mainstream story even when the
        // other wing frames it under different words ("Maine Senate" on the
        // left is "Platner" on the right); pure one-wing outrage stays crushed
        const mainstream = center >= 2 && (left >= 1 || right >= 1);
        const spectrumFactor = bipartisan ? 1 + Math.min(left, right) * 0.25
            : mainstream ? 0.75
            : 0.35;

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
            bipartisan,
            mainstream
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

    // Admit newcomers: strong enough AND either carried by both wings or so
    // broadly covered (wing + center mainstream) that one wing's silence
    // doesn't disqualify it
    for (const hit of scored) {
        if (phrases[hit.canon]) continue;
        if (hit.score < tuning.addThreshold) continue;
        if (!hit.bipartisan && !(hit.mainstream && hit.outlets >= tuning.broadOutlets)) continue;
        const ttlMs = retentionDays(hit.score, 1, tuning) * 86400 * 1000;
        phrases[hit.canon] = {
            display: hit.display,
            firstSeen: nowIso,
            lastSeen: nowIso,
            heat: hit.score,
            peakHeat: hit.score,
            daysActive: 1,
            expiresAt: new Date(nowMs + ttlMs).toISOString(),
            bipartisan: hit.bipartisan,
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

// Schema gate for the codex curation pass (scripts/trending/validate.js).
// Curated files must keep the exact shape the functions above emit -- no
// extra fields, descriptions derived exactly from state, bounded numbers,
// ordered timestamps -- so the model can't smuggle freeform content into
// the published list. When headlines + baselinePhrases are given, any
// phrase codex added (a state key absent from the heuristic baseline) must
// appear on a word boundary in headlines from minOutlets distinct sources.
// Returns an array of problems; empty means valid.
const CATEGORY_NAME = 'New Developments';
const CATEGORY_DESCRIPTION = "Today's controversies from across the news spectrum, updated automatically";
const MAX_PHRASE_LENGTH = 60;
const MAX_HEAT = 10000;
const MAX_OUTLETS = 100;
const MAX_DAYS_ACTIVE = 3650;
const CATEGORY_KEYS = ['description', 'keywords', 'updatedAt'];
const STATE_KEYS = ['phrases', 'updatedAt'];
const PHRASE_KEYS = ['bipartisan', 'daysActive', 'display', 'expiresAt',
    'firstSeen', 'heat', 'lastSeen', 'outlets', 'peakHeat'];

export function validateTrending(
    { category, state, headlines = null, baselinePhrases = null, baselineUpdatedAt = null, baselineCategory = null },
    tuning = TUNING
) {
    const problems = [];
    const check = (condition, message) => { if (!condition) problems.push(message); };
    const isDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
    const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const sameKeys = (obj, expected) =>
        JSON.stringify(Object.keys(obj || {}).sort()) === JSON.stringify(expected);

    const names = Object.keys(category || {});
    check(names.length === 1 && names[0] === CATEGORY_NAME,
        `expected single "${CATEGORY_NAME}" category, got [${names.join(', ')}]`);
    const entry = (category || {})[CATEGORY_NAME] || {};
    check(sameKeys(entry, CATEGORY_KEYS), 'category has missing or unexpected fields');
    check(entry.description === CATEGORY_DESCRIPTION, 'category description was altered');
    check(isDate(entry.updatedAt), 'category updatedAt is not a date');

    check(sameKeys(state, STATE_KEYS), 'state has missing or unexpected fields');
    check(isDate(state?.updatedAt), 'state updatedAt is not a date');
    check(entry.updatedAt === state?.updatedAt, 'trending.json and state updatedAt differ');
    check(baselineUpdatedAt === null || state?.updatedAt === baselineUpdatedAt,
        'state updatedAt differs from the heuristic baseline');
    check(isPlainObject(entry.keywords), 'keywords must be a plain object');
    check(isPlainObject(state?.phrases), 'state phrases must be a plain object');
    const updatedMs = Date.parse(state?.updatedAt);

    const keywords = isPlainObject(entry.keywords) ? entry.keywords : {};
    check(Object.keys(keywords).length <= tuning.maxPhrases,
        `more than ${tuning.maxPhrases} keywords published`);
    check(Object.keys((isPlainObject(state?.phrases) && state.phrases) || {}).length <= tuning.maxPhrases,
        `more than ${tuning.maxPhrases} phrases tracked`);
    for (const [phrase, meta] of Object.entries(keywords)) {
        check(phrase === phrase.trim() && phrase.trim().length >= 2,
            `"${phrase.slice(0, 80)}": phrase is empty or has stray whitespace`);
        check(phrase.length <= MAX_PHRASE_LENGTH, `"${phrase.slice(0, 80)}": phrase too long`);
        check(sameKeys(meta, ['description', 'weight']),
            `${phrase}: keyword has missing or unexpected fields`);
        check(Number.isInteger(meta?.weight) && meta.weight >= 1 && meta.weight <= 3,
            `${phrase}: weight must be an integer 1-3`);
        const stateEntry = (state?.phrases || {})[phrase.toLowerCase()];
        check(stateEntry?.display === phrase,
            `${phrase}: no matching state entry (published phrases must be tracked)`);
        // Derived exactly from validated state fields so the description
        // carries no free numbers or text of its own
        if (stateEntry) {
            const derived = `In ${stateEntry.outlets} outlets across the spectrum (since ${String(stateEntry.firstSeen).slice(0, 10)})`;
            check(meta?.description === derived,
                `${phrase}: description must be derived from its state entry`);
        }
    }

    const loweredTitles = headlines === null
        ? null
        : headlines.map(h => ({ title: String(h?.title || '').toLowerCase(), source: String(h?.source || '') }));
    const onWordBoundary = canon => {
        const escaped = canon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
        return new Set(loweredTitles.filter(h => pattern.test(h.title)).map(h => h.source));
    };
    const maxRetentionMs = (tuning.maxRetentionDays + 1) * 86400000;
    for (const [canon, phrase] of Object.entries(state?.phrases || {})) {
        check(canon === canon.toLowerCase(), `state ${canon}: key must be lowercase`);
        check(canon === canon.trim() && canon.trim().length >= 2,
            `state "${canon.slice(0, 80)}": key is empty or has stray whitespace`);
        check(sameKeys(phrase, PHRASE_KEYS), `state ${canon}: missing or unexpected fields`);
        check(typeof phrase?.display === 'string' && phrase.display.toLowerCase() === canon,
            `state ${canon}: display must be a casing of the key`);
        check(Number.isFinite(phrase?.heat) && phrase.heat >= 0 && phrase.heat <= MAX_HEAT,
            `state ${canon}: heat must be a number in 0-${MAX_HEAT}`);
        check(Number.isFinite(phrase?.peakHeat) && phrase.peakHeat >= phrase.heat - 1e-9
            && phrase.peakHeat <= MAX_HEAT,
            `state ${canon}: peakHeat must be >= heat and <= ${MAX_HEAT}`);
        check(Number.isInteger(phrase?.daysActive) && phrase.daysActive >= 1
            && phrase.daysActive <= MAX_DAYS_ACTIVE,
            `state ${canon}: daysActive must be a positive integer <= ${MAX_DAYS_ACTIVE}`);
        check(typeof phrase?.bipartisan === 'boolean', `state ${canon}: bipartisan must be a boolean`);
        check(Number.isInteger(phrase?.outlets) && phrase.outlets >= 1 && phrase.outlets <= MAX_OUTLETS,
            `state ${canon}: outlets must be a positive integer <= ${MAX_OUTLETS}`);
        check(isDate(phrase?.firstSeen), `state ${canon}: firstSeen is not a date`);
        check(isDate(phrase?.lastSeen), `state ${canon}: lastSeen is not a date`);
        check(isDate(phrase?.expiresAt), `state ${canon}: expiresAt is not a date`);
        if (isDate(phrase?.firstSeen) && isDate(phrase?.lastSeen) && isDate(phrase?.expiresAt)) {
            const firstMs = Date.parse(phrase.firstSeen);
            const lastMs = Date.parse(phrase.lastSeen);
            const expiresMs = Date.parse(phrase.expiresAt);
            check(firstMs <= lastMs, `state ${canon}: firstSeen is after lastSeen`);
            check(Number.isNaN(updatedMs) || lastMs <= updatedMs,
                `state ${canon}: lastSeen is after the state update time`);
            check(expiresMs > lastMs, `state ${canon}: already expired at lastSeen`);
            check(Number.isNaN(updatedMs) || expiresMs > updatedMs,
                `state ${canon}: already expired at the state update time`);
            check(expiresMs - lastMs <= maxRetentionMs,
                `state ${canon}: expiresAt exceeds the ${tuning.maxRetentionDays}-day retention cap`);
        }
        if (loweredTitles && baselinePhrases && !Object.hasOwn(baselinePhrases, canon)) {
            const evidence = onWordBoundary(canon);
            check(evidence.size >= tuning.minOutlets,
                `state ${canon}: added phrase must appear (whole words) in headlines from ${tuning.minOutlets}+ sources`);
            check(!Number.isInteger(phrase?.outlets) || phrase.outlets <= evidence.size,
                `state ${canon}: outlets overstates the headline evidence`);
        }
        // Curation may drop or re-case retained entries, never rewrite their
        // tracking metadata -- decay math depends on it
        if (baselinePhrases && Object.hasOwn(baselinePhrases, canon)) {
            const base = baselinePhrases[canon];
            for (const field of PHRASE_KEYS) {
                if (field === 'display') continue;
                check(phrase?.[field] === base?.[field],
                    `state ${canon}: ${field} was altered from the heuristic baseline`);
            }
        }
    }

    // Removals and additions must hit both files, or the next heuristic run
    // silently undoes the curation: a phrase deleted only from trending.json
    // republishes from state, and a state-only addition never surfaces
    const publishedCanons = new Set(Object.keys(keywords).map(k => k.toLowerCase()));
    if (baselineCategory) {
        const baseKeywords = baselineCategory?.[CATEGORY_NAME]?.keywords || {};
        for (const basePhrase of Object.keys(baseKeywords)) {
            const canon = basePhrase.toLowerCase();
            if (!publishedCanons.has(canon)) {
                check(!Object.hasOwn(state?.phrases || {}, canon),
                    `state ${canon}: removed from the published list but still tracked in state`);
            }
        }
    }
    if (baselinePhrases) {
        for (const canon of Object.keys(state?.phrases || {})) {
            if (!Object.hasOwn(baselinePhrases, canon)) {
                check(publishedCanons.has(canon),
                    `state ${canon}: added phrase must also be published in trending.json`);
            }
        }
    }
    // A dormant phrase (tracked but deliberately left unpublished by the
    // heuristics) needs the same fresh-headline evidence as a new one
    // before curation may publish it
    if (baselineCategory && loweredTitles && baselinePhrases) {
        const basePublished = new Set(
            Object.keys(baselineCategory?.[CATEGORY_NAME]?.keywords || {}).map(k => k.toLowerCase())
        );
        for (const canon of publishedCanons) {
            if (!basePublished.has(canon) && Object.hasOwn(baselinePhrases, canon)) {
                check(onWordBoundary(canon).size >= tuning.minOutlets,
                    `${canon}: republished dormant phrase must appear (whole words) in headlines from ${tuning.minOutlets}+ sources`);
            }
        }
    }

    return problems;
}
