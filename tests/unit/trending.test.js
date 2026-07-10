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
    buildTrendingCategory,
    phraseOverlaps,
    excludePermanent,
    titleIsTitleCase
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

    it('ignores capitalization evidence from Title Case headlines', () => {
        // Every capitalized mid-headline sighting comes from a Title Case
        // outlet; sentence-case outlets only use the word headline-initial.
        // Without the Title Case guard, "shutdown" (like the once-published
        // "Reveals") qualified as a proper noun on those two votes alone.
        const headlines = [
            { title: 'Government Shutdown Looms Over Capitol Talks', source: 'right-0', lean: 'right' },
            { title: 'Markets Brace For Another Shutdown Fight', source: 'right-1', lean: 'right' },
            { title: 'Shutdown talks stall in congress', source: 'left-0', lean: 'left' },
            { title: 'Shutdown fears grow among agencies', source: 'center-0', lean: 'center' }
        ];
        const scored = scoreCandidates(extractCandidates(headlines));
        expect(scored.map(s => s.canon)).not.toContain('shutdown');
    });

    it('never emits bare state names, only the specific phrase', () => {
        const headlines = [
            { title: 'Voters flock to Maine Senate contest', source: 'left-0', lean: 'left' },
            { title: 'Fallout grows in Maine Senate battle', source: 'right-0', lean: 'right' },
            { title: 'Donors pour into Maine Senate fight', source: 'center-0', lean: 'center' }
        ];
        const canons = scoreCandidates(extractCandidates(headlines)).map(s => s.canon);
        expect(canons).toContain('maine senate');
        expect(canons).not.toContain('maine');
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

    it('admits broadly-covered mainstream stories one wing ignores', () => {
        // One wing plus five center outlets: the other wing's silence (it
        // words the same story differently) must not disqualify it
        const scored = scoreCandidates(extractCandidates(
            headlinesFor('offshore drilling ban', { left: 1, center: 5, extraMentions: 3 })
        ));
        expect(scored.find(s => s.canon === 'offshore drilling ban').bipartisan).toBe(false);
        const state = updateTrendingState({ phrases: {} }, scored, NOW);
        expect(state.phrases['offshore drilling ban']).toBeDefined();
        expect(state.phrases['offshore drilling ban'].bipartisan).toBe(false);
    });

    it('still rejects one-wing volume without center pickup', () => {
        const scored = scoreCandidates(extractCandidates(
            headlinesFor('offshore drilling ban', { left: 6, extraMentions: 6 })
        ));
        const state = updateTrendingState({ phrases: {} }, scored, NOW);
        expect(state.phrases['offshore drilling ban']).toBeUndefined();
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
        const data = category['New Developments'];
        expect(data.keywords['Phrase 0'].weight).toBe(3);   // hottest
        expect(data.keywords['Phrase 4'].weight).toBe(2);   // middle
        expect(data.keywords['Phrase 9'].weight).toBe(1);   // coolest
        expect(data.keywords['Phrase 0'].description).toContain('6 outlets');
    });

    function phrase(canon, display, heat) {
        return [canon, {
            display, firstSeen: NOW, lastSeen: NOW, heat, peakHeat: heat,
            daysActive: 1, expiresAt: '2026-12-31T00:00:00.000Z',
            bipartisan: true, outlets: 5
        }];
    }

    it('drops phrases overlapping the permanent keyword lists', () => {
        const state = {
            updatedAt: NOW,
            phrases: Object.fromEntries([
                phrase('trump', 'Trump', 100),        // exact permanent match
                phrase('trumps', 'Trumps', 20),       // plural of a permanent keyword
                phrase('kirk', 'Kirk', 30),           // word inside permanent "charlie kirk"
                phrase('trump tariffs', 'Trump tariffs', 25), // contains permanent "trump"
                phrase('platner', 'Platner', 90)
            ])
        };
        const category = buildTrendingCategory(state, {
            excludeKeywords: ['Trump', 'Charlie Kirk']
        });
        expect(Object.keys(category['New Developments'].keywords)).toEqual(['Platner']);
    });

    it('keeps only the hottest of overlapping trending phrases', () => {
        const state = {
            updatedAt: NOW,
            phrases: Object.fromEntries([
                phrase('graham', 'Graham', 80),
                phrase('graham platner', 'Graham Platner', 50),
                phrase('epstein files', 'Epstein Files', 40),
                phrase('epstein', 'Epstein', 20),
                phrase('tariff fight', 'Tariff Fight', 10)
            ])
        };
        const category = buildTrendingCategory(state);
        expect(Object.keys(category['New Developments'].keywords))
            .toEqual(['Graham', 'Epstein Files', 'Tariff Fight']);
    });

    it('never emits blocklisted fragments lingering in state', () => {
        const state = {
            updatedAt: NOW,
            phrases: Object.fromEntries([
                phrase('white', 'White', 50),
                phrase('maine', 'Maine', 45),
                phrase('world cup', 'World Cup', 42),
                phrase('platner', 'Platner', 40)
            ])
        };
        const category = buildTrendingCategory(state);
        expect(Object.keys(category['New Developments'].keywords)).toEqual(['Platner']);
    });
});

describe('excludePermanent', () => {
    const entry = heat => ({
        display: 'x', firstSeen: NOW, lastSeen: NOW, heat, peakHeat: heat,
        daysActive: 1, expiresAt: '2026-12-31T00:00:00.000Z',
        bipartisan: true, outlets: 5
    });

    it('prunes overlapping phrases from carried state and fresh scores', () => {
        const { prevState, scored } = excludePermanent(
            { updatedAt: NOW, phrases: { trump: entry(100), trumps: entry(20), platner: entry(90) } },
            [{ canon: 'kirk', score: 10 }, { canon: 'maine', score: 8 }],
            new Set(['trump', 'charlie kirk'])
        );
        expect(Object.keys(prevState.phrases)).toEqual(['platner']);
        expect(scored.map(s => s.canon)).toEqual(['maine']);
    });

    it('is a no-op without exclusions', () => {
        const state = { updatedAt: NOW, phrases: { trump: entry(100) } };
        const scored = [{ canon: 'trump', score: 10 }];
        expect(excludePermanent(state, scored, new Set())).toEqual({ prevState: state, scored });
    });

    it('frees maxPhrases slots for eligible phrases', () => {
        // Without exclusion, red-hot "trump" would take one of the two slots
        const tuning = { ...TUNING, maxPhrases: 2 };
        const carried = { updatedAt: NOW, phrases: { trump: entry(1000), maine: entry(5), platner: entry(4) } };
        const { prevState, scored } = excludePermanent(carried, [], new Set(['trump']));
        const state = updateTrendingState(prevState, scored, NOW, tuning);
        expect(Object.keys(state.phrases).sort()).toEqual(['maine', 'platner']);
    });
});

describe('phraseOverlaps', () => {
    it('matches whole words and singular/plural variants only', () => {
        expect(phraseOverlaps('maine senate', 'maine')).toBe(true);
        expect(phraseOverlaps('trumps', 'trump')).toBe(true);
        expect(phraseOverlaps('kirk', 'charlie kirk')).toBe(true);
        expect(phraseOverlaps('martial law', 'art')).toBe(false); // substring, not a word
        expect(phraseOverlaps('iran', 'iraq')).toBe(false);
    });
});

describe('headline-verb stopwords', () => {
    it('keeps headline verbs from bounding phrases', () => {
        const canon = [...extractPhrasesFromTitle('Epstein files reveal secret meeting').keys()]
            .map(p => p.toLowerCase());
        expect(canon).toContain('epstein files');
        expect(canon).toContain('secret meeting');
        expect(canon).not.toContain('reveal');
        expect(canon).not.toContain('files reveal');
    });

    it('blocks sports evergreens and bare states at extraction', () => {
        const canon = [...extractPhrasesFromTitle('Fans mob Florida stadium after World Cup upset').keys()]
            .map(p => p.toLowerCase());
        expect(canon).not.toContain('world cup');
        expect(canon).not.toContain('florida');
        expect(canon).toContain('florida stadium');
    });
});

describe('titleIsTitleCase', () => {
    it('detects Title Case house style without flagging sentence case', () => {
        expect(titleIsTitleCase('Military Strikes Rock Region')).toBe(true);
        expect(titleIsTitleCase('Iran strikes kill dozens near Baghdad')).toBe(false);
        // Too few mid-clause words to judge: assume sentence case
        expect(titleIsTitleCase('Trump slams Biden')).toBe(false);
    });
});

describe('clause splitting', () => {
    it('treats parenthesized attributions as their own clause', () => {
        const canon = [...extractPhrasesFromTitle('Senate blocks funding measure (Jane Doe/Some Outlet)').keys()]
            .map(p => p.toLowerCase());
        // Extracted -- outlet breadth will kill it -- but never glued onto
        // the story phrase across the parenthesis
        expect(canon).toContain('jane doe');
        expect(canon).not.toContain('measure jane');
    });
});

describe('possessive normalization', () => {
    it("treats Trump's as Trump", () => {
        const phrases = extractPhrasesFromTitle("Court blocks Trump's tariffs plan");
        const keys = [...phrases.keys()];
        expect(keys).toContain('Trump');
        expect(keys.some(k => k.includes("'"))).toBe(false);
    });

    it('handles typographic apostrophes without gluing the s on', () => {
        const phrases = extractPhrasesFromTitle('Court blocks Trump’s tariffs plan');
        const keys = [...phrases.keys()];
        expect(keys).toContain('Trump');
        expect(keys).not.toContain('Trumps');
    });
});
