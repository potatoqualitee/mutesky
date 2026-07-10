import { describe, it, expect } from 'vitest';
import {
    TUNING,
    parseFeedXml,
    filterFreshHeadlines,
    extractPhrasesFromTitle,
    extractCandidates,
    scoreCandidates,
    retentionDays,
    updateTrendingState,
    buildTrendingCategory
} from '../../scripts/trending/lib.js';

const NOW = '2026-07-10T12:00:00.000Z';

function headlinesFor(phrase, { left = 0, center = 0, right = 0, extraMentions = 0 } = {}) {
    const headlines = [];
    let n = 0;
    for (const [lean, count] of [['left', left], ['center', center], ['right', right]]) {
        for (let i = 0; i < count; i++) {
            headlines.push({ title: `Senators clash over ${phrase} in heated hearing`, source: `${lean}-${i}`, lean });
        }
    }
    for (let i = 0; i < extraMentions; i++) {
        headlines.push({ title: `More fallout from ${phrase} today`, source: 'left-0', lean: 'left' });
        n++;
    }
    return headlines;
}

describe('parseFeedXml', () => {
    it('parses RSS items with CDATA and entities', () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item><title><![CDATA[Trump &amp; Biden spar over debate rules]]></title>
                <pubDate>Thu, 09 Jul 2026 12:00:00 GMT</pubDate></item>
            <item><title>Senate votes on budget</title></item>
        </channel></rss>`;
        const items = parseFeedXml(xml);
        expect(items).toHaveLength(2);
        expect(items[0].title).toBe('Trump & Biden spar over debate rules');
        expect(items[0].pubDate).toMatch(/^2026-07-09/);
        expect(items[1].pubDate).toBeNull();
    });

    it('parses Atom entries', () => {
        const xml = `<feed><entry><title>Border bill collapses</title>
            <updated>2026-07-10T01:00:00Z</updated></entry></feed>`;
        const items = parseFeedXml(xml);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Border bill collapses');
    });
});

describe('filterFreshHeadlines', () => {
    it('drops stale items but keeps undated ones', () => {
        const now = new Date(NOW).getTime();
        const items = [
            { title: 'fresh', pubDate: new Date(now - 3600e3).toISOString() },
            { title: 'stale', pubDate: new Date(now - 100 * 3600e3).toISOString() },
            { title: 'undated', pubDate: null }
        ];
        const fresh = filterFreshHeadlines(items, now);
        expect(fresh.map(i => i.title)).toEqual(['fresh', 'undated']);
    });
});

describe('extractPhrasesFromTitle', () => {
    it('extracts n-grams with meaningful boundaries', () => {
        const phrases = extractPhrasesFromTitle('Supreme Court blocks student loan plan');
        expect(phrases.has('student loan')).toBe(true);
        expect(phrases.has('student loan plan')).toBe(true);
        // "supreme court" alone is on the evergreen blocklist
        expect([...phrases.keys()].some(p => p.toLowerCase() === 'supreme court')).toBe(false);
    });

    it('never emits stopword-bounded or generic phrases', () => {
        const phrases = [...extractPhrasesFromTitle('Breaking News: the White House says a deal is near').keys()];
        const canon = phrases.map(p => p.toLowerCase());
        expect(canon).not.toContain('breaking news');
        expect(canon).not.toContain('white house');
        expect(canon).not.toContain('the white');
        expect(canon).not.toContain('says a');
    });

    it('keeps outlet attributions in their own clause where breadth filters kill them', () => {
        const phrases = extractPhrasesFromTitle('Tariff fight escalates - CNN Politics');
        const canon = [...phrases.keys()].map(p => p.toLowerCase());
        expect(canon).toContain('tariff fight');
        // The dash starts a new clause: the attribution IS extracted but never
        // crosses the clause boundary into the story phrase
        expect(canon).toContain('cnn politics');
        expect(canon).not.toContain('escalates cnn');

        // ...and because only CNN's own feed carries it, outlet breadth keeps
        // it out of the published candidates
        const headlines = [
            { title: 'Tariff fight escalates - CNN Politics', source: 'cnn', lean: 'left' },
            { title: 'Tariff fight hits farmers', source: 'right-0', lean: 'right' },
            { title: 'Tariff fight splits senate', source: 'center-0', lean: 'center' }
        ];
        const published = scoreCandidates(extractCandidates(headlines)).map(s => s.canon);
        expect(published).toContain('tariff fight');
        expect(published).not.toContain('cnn politics');
    });

    it('marks phrases that only appear at the start of the headline', () => {
        const phrases = extractPhrasesFromTitle('Strikes hit Tehran as Strikes continue');
        expect(phrases.get('Strikes').atStart).toBe(false); // reappears mid-title
        const onlyStart = extractPhrasesFromTitle('Strikes hit Tehran overnight');
        expect(onlyStart.get('Strikes').atStart).toBe(true);
    });

    it('treats words after colons and dashes as clause-initial', () => {
        const phrases = extractPhrasesFromTitle('Breaking today: Strikes hit airbase');
        expect(phrases.get('Strikes').atStart).toBe(true);
        const dashed = extractPhrasesFromTitle('Analysis - Strikes reshape the region');
        expect(dashed.get('Strikes').atStart).toBe(true);
    });
});

describe('scoreCandidates', () => {
    it('requires minimum outlet breadth', () => {
        const candidates = extractCandidates(headlinesFor('debt ceiling', { left: 2 }));
        expect(scoreCandidates(candidates).find(s => s.canon === 'debt ceiling')).toBeUndefined();
    });

    it('rewards bipartisan coverage far above one-sided coverage', () => {
        const bipartisan = scoreCandidates(
            extractCandidates(headlinesFor('debt ceiling', { left: 2, center: 1, right: 2 }))
        ).find(s => s.canon === 'debt ceiling');
        const oneSided = scoreCandidates(
            extractCandidates(headlinesFor('debt ceiling', { left: 5 }))
        ).find(s => s.canon === 'debt ceiling');

        expect(bipartisan.bipartisan).toBe(true);
        expect(oneSided.bipartisan).toBe(false);
        expect(bipartisan.score).toBeGreaterThan(oneSided.score * 2);
    });

    it('rejects lone common nouns but keeps proper-noun unigrams', () => {
        // Sentence-case outlets write "strikes" lowercase; Title Case outlets
        // capitalize it. Mixed evidence must fail the proper-noun test.
        const headlines = [
            { title: 'Iran strikes kill dozens', source: 'left-0', lean: 'left' },
            { title: 'Airbase strikes escalate conflict', source: 'left-1', lean: 'left' },
            { title: 'Military Strikes Rock Region', source: 'right-0', lean: 'right' },
            { title: 'Talks with Iran stall', source: 'right-1', lean: 'right' },
            { title: 'Sanctions on Iran expand', source: 'center-0', lean: 'center' }
        ];
        const scored = scoreCandidates(extractCandidates(headlines));
        const canons = scored.map(s => s.canon);
        expect(canons).not.toContain('strikes');
        expect(canons).toContain('iran');
    });

    it('one Title Case outlet cannot vouch for a common noun alone', () => {
        const headlines = [
            { title: 'Strikes rock the capital', source: 'left-0', lean: 'left' },
            { title: 'Region Braces As Strikes Widen', source: 'right-0', lean: 'right' },
            { title: 'Officials Say New Strikes Coming', source: 'right-0', lean: 'right' },
            { title: 'Strikes continue for third day', source: 'center-0', lean: 'center' }
        ];
        // Two capitalized mid-headline sightings, but both from right-0
        const scored = scoreCandidates(extractCandidates(headlines));
        expect(scored.map(s => s.canon)).not.toContain('strikes');
    });

    it('ignores sentence-initial capitalization as proper-noun evidence', () => {
        // "Strikes" always leads the headline: capitalized every time, but
        // that proves nothing -- must not qualify as a proper noun
        const headlines = [
            { title: 'Strikes rock the capital', source: 'left-0', lean: 'left' },
            { title: 'Strikes escalate overnight', source: 'left-1', lean: 'left' },
            { title: 'Strikes draw condemnation', source: 'right-0', lean: 'right' },
            { title: 'Strikes continue for third day', source: 'center-0', lean: 'center' }
        ];
        const scored = scoreCandidates(extractCandidates(headlines));
        expect(scored.map(s => s.canon)).not.toContain('strikes');
    });

    it('requires more than one mid-headline sighting as evidence', () => {
        // Headline-initial everywhere except one Title Case outlet: one
        // capitalized mid-headline sighting must not flip it to proper noun
        const headlines = [
            { title: 'Strikes rock the capital', source: 'left-0', lean: 'left' },
            { title: 'Strikes escalate overnight', source: 'left-1', lean: 'left' },
            { title: 'Region Braces As Strikes Widen', source: 'right-0', lean: 'right' },
            { title: 'Strikes continue for third day', source: 'center-0', lean: 'center' }
        ];
        const scored = scoreCandidates(extractCandidates(headlines));
        expect(scored.map(s => s.canon)).not.toContain('strikes');
    });

    it('prefers the more specific phrase when scores are comparable', () => {
        const scored = scoreCandidates(
            extractCandidates(headlinesFor('classified documents trial', { left: 2, center: 1, right: 2 }))
        );
        const canons = scored.map(s => s.canon);
        expect(canons).toContain('classified documents trial');
        expect(canons).not.toContain('classified documents');
        expect(canons).not.toContain('documents trial');
    });
});

describe('retentionDays', () => {
    it('gives short retention to one-day flaps and long to sustained stories', () => {
        const flap = retentionDays(TUNING.addThreshold, 1);
        const sustained = retentionDays(TUNING.addThreshold * 20, 14);
        expect(flap).toBeGreaterThanOrEqual(TUNING.minRetentionDays);
        expect(flap).toBeLessThan(7);
        expect(sustained).toBeGreaterThan(15);
        expect(sustained).toBeLessThanOrEqual(TUNING.maxRetentionDays);
    });
});

describe('updateTrendingState', () => {
    const bigStory = () => scoreCandidates(
        extractCandidates(headlinesFor('impeachment inquiry', { left: 3, center: 2, right: 3, extraMentions: 4 }))
    );

    it('admits bipartisan phrases above the threshold', () => {
        const state = updateTrendingState({ phrases: {} }, bigStory(), NOW);
        const phrase = state.phrases['impeachment inquiry'];
        expect(phrase).toBeDefined();
        expect(phrase.firstSeen).toBe(NOW);
        expect(new Date(phrase.expiresAt).getTime()).toBeGreaterThan(new Date(NOW).getTime());
    });

    it('rejects one-sided phrases regardless of volume', () => {
        const scored = scoreCandidates(
            extractCandidates(headlinesFor('impeachment inquiry', { left: 8, extraMentions: 10 }))
        );
        const state = updateTrendingState({ phrases: {} }, scored, NOW);
        expect(state.phrases['impeachment inquiry']).toBeUndefined();
    });

    it('decays heat and drops phrases after they expire', () => {
        let state = updateTrendingState({ phrases: {} }, bigStory(), NOW);
        const startHeat = state.phrases['impeachment inquiry'].heat;

        // Story goes quiet: run the engine again 2 days later with no hits
        const later = '2026-07-12T12:00:00.000Z';
        state = updateTrendingState(state, [], later);
        expect(state.phrases['impeachment inquiry'].heat).toBeLessThan(startHeat);

        // Way past expiry with no coverage: gone
        const wayLater = '2026-09-01T12:00:00.000Z';
        state = updateTrendingState(state, [], wayLater);
        expect(state.phrases['impeachment inquiry']).toBeUndefined();
    });

    it('makes expired phrases re-qualify instead of resurrecting on weak coverage', () => {
        const expired = {
            phrases: {
                'impeachment inquiry': {
                    display: 'impeachment inquiry', firstSeen: '2026-06-01T00:00:00.000Z',
                    lastSeen: '2026-06-02T00:00:00.000Z', heat: 1, peakHeat: 20,
                    daysActive: 2, expiresAt: '2026-06-10T00:00:00.000Z',
                    bipartisan: true, outlets: 8
                }
            }
        };
        // Weak one-sided coverage after expiry: must NOT come back
        const weak = scoreCandidates(
            extractCandidates(headlinesFor('impeachment inquiry', { left: 3, extraMentions: 1 }))
        );
        let state = updateTrendingState(expired, weak, NOW);
        expect(state.phrases['impeachment inquiry']).toBeUndefined();

        // Full bipartisan resurgence: re-admitted as a fresh story
        state = updateTrendingState(expired, bigStory(), NOW);
        expect(state.phrases['impeachment inquiry']).toBeDefined();
        expect(state.phrases['impeachment inquiry'].firstSeen).toBe(NOW);
    });

    it('extends retention while coverage continues', () => {
        let state = updateTrendingState({ phrases: {} }, bigStory(), NOW);
        const firstExpiry = state.phrases['impeachment inquiry'].expiresAt;

        const nextDay = '2026-07-11T12:00:00.000Z';
        state = updateTrendingState(state, bigStory(), nextDay);
        const phrase = state.phrases['impeachment inquiry'];
        expect(new Date(phrase.expiresAt).getTime()).toBeGreaterThan(new Date(firstExpiry).getTime());
        expect(phrase.daysActive).toBe(2);
        expect(phrase.firstSeen).toBe(NOW); // origin preserved
    });

    it('is near-idempotent when rerun minutes later on the same coverage', () => {
        const first = updateTrendingState({ phrases: {} }, bigStory(), NOW);
        const heatAfterFirst = first.phrases['impeachment inquiry'].heat;

        const fourMinutesLater = '2026-07-10T12:04:00.000Z';
        const second = updateTrendingState(first, bigStory(), fourMinutesLater);
        const heatAfterRerun = second.phrases['impeachment inquiry'].heat;

        // Re-processing near-identical coverage must not double the heat
        expect(heatAfterRerun).toBeLessThan(heatAfterFirst * 1.1);
        expect(heatAfterRerun).toBeGreaterThan(heatAfterFirst * 0.9);
    });

    it('accumulates the same heat whether an interval runs once or in parts', () => {
        const story = bigStory();
        const canon = 'impeachment inquiry';
        const t0 = '2026-07-10T12:00:00.000Z';
        const tHalf = '2026-07-10T15:00:00.000Z';
        const t1 = '2026-07-10T18:00:00.000Z';

        const seed = updateTrendingState({ phrases: {} }, story, t0);

        // One combined 6h step vs two 3h steps over identical coverage
        const combined = updateTrendingState(seed, story, t1);
        const partitioned = updateTrendingState(updateTrendingState(seed, story, tHalf), story, t1);

        expect(partitioned.phrases[canon].heat)
            .toBeCloseTo(combined.phrases[canon].heat, 6);
    });

    it('handles a no-decay tuning without corrupting heat', () => {
        const noDecay = { ...TUNING, heatDecay: 1 };
        const state = updateTrendingState({ phrases: {} }, bigStory(), NOW, noDecay);
        const later = updateTrendingState(state, bigStory(), '2026-07-10T18:00:00.000Z', noDecay);
        expect(Number.isFinite(later.phrases['impeachment inquiry'].heat)).toBe(true);
        expect(later.phrases['impeachment inquiry'].heat)
            .toBeGreaterThan(state.phrases['impeachment inquiry'].heat);
    });

    it('caps the list at maxPhrases keeping the hottest', () => {
        const phrases = {};
        for (let i = 0; i < 100; i++) {
            phrases[`phrase ${i}`] = {
                display: `phrase ${i}`, firstSeen: NOW, lastSeen: NOW,
                heat: i, peakHeat: i, daysActive: 1,
                expiresAt: '2026-12-31T00:00:00.000Z', bipartisan: true, outlets: 5
            };
        }
        const state = updateTrendingState({ phrases }, [], NOW);
        const kept = Object.values(state.phrases);
        expect(kept.length).toBe(TUNING.maxPhrases);
        expect(kept.some(p => p.display === 'phrase 99')).toBe(true);
        expect(kept.some(p => p.display === 'phrase 10')).toBe(false);
    });
});

describe('buildTrendingCategory', () => {
    it('produces calm-the-chaos category format with percentile weights', () => {
        const phrases = {};
        for (let i = 0; i < 10; i++) {
            phrases[`phrase ${i}`] = {
                display: `Phrase ${i}`, firstSeen: NOW, lastSeen: NOW,
                heat: 100 - i * 10, peakHeat: 100, daysActive: 2,
                expiresAt: '2026-12-31T00:00:00.000Z', bipartisan: true, outlets: 6
            };
        }
        const category = buildTrendingCategory({ updatedAt: NOW, phrases });
        const data = category['Trending Controversies'];
        expect(data.keywords['Phrase 0'].weight).toBe(3);   // hottest
        expect(data.keywords['Phrase 4'].weight).toBe(2);   // middle
        expect(data.keywords['Phrase 9'].weight).toBe(1);   // coolest
        expect(data.keywords['Phrase 0'].description).toContain('6 outlets');
    });
});
