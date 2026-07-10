import { describe, it, expect } from 'vitest';
import { validateTrending, buildTrendingCategory } from '../../scripts/trending/lib.js';

const NOW = '2026-07-10T12:00:00.000Z';

function makePhrase(overrides = {}) {
    return {
        display: 'Platner',
        firstSeen: '2026-07-09T12:00:00.000Z',
        lastSeen: NOW,
        heat: 12,
        peakHeat: 12,
        daysActive: 2,
        expiresAt: '2026-07-14T12:00:00.000Z',
        bipartisan: true,
        outlets: 9,
        ...overrides
    };
}

function makeState(phrases = { platner: makePhrase() }) {
    return { updatedAt: NOW, phrases };
}

// Valid fixtures come from the real builder so the validator can never
// drift from what the pipeline actually emits
function makeFixture(phrases) {
    const state = makeState(phrases);
    return { category: buildTrendingCategory(state), state };
}

describe('validateTrending', () => {
    it('accepts the builder output unchanged', () => {
        expect(validateTrending(makeFixture())).toEqual([]);
    });

    it('rejects a renamed category', () => {
        const fixture = makeFixture();
        fixture.category = { 'Other Name': fixture.category['New Developments'] };
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects unexpected fields on category, keyword, and state entries', () => {
        let fixture = makeFixture();
        fixture.category['New Developments'].payload = 'x';
        expect(validateTrending(fixture)).not.toEqual([]);

        fixture = makeFixture();
        fixture.category['New Developments'].keywords.Platner.payload = 'x';
        expect(validateTrending(fixture)).not.toEqual([]);

        fixture = makeFixture();
        fixture.state.phrases.platner.payload = 'x';
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects a freeform keyword description', () => {
        const fixture = makeFixture();
        fixture.category['New Developments'].keywords.Platner.description = 'aGV4IGR1bXA=';
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects weights outside 1-3', () => {
        const fixture = makeFixture();
        fixture.category['New Developments'].keywords.Platner.weight = 5;
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects published phrases with no state entry', () => {
        const fixture = makeFixture();
        fixture.category['New Developments'].keywords.Ghost = {
            weight: 1,
            description: 'In 4 outlets across the spectrum (since 2026-07-10)'
        };
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects out-of-order and over-retained timestamps', () => {
        let fixture = makeFixture({ platner: makePhrase({ firstSeen: '2026-07-11T00:00:00.000Z' }) });
        expect(validateTrending(fixture)).not.toEqual([]);

        fixture = makeFixture({ platner: makePhrase({ expiresAt: '2026-09-20T00:00:00.000Z' }) });
        expect(validateTrending(fixture)).not.toEqual([]);

        fixture = makeFixture({ platner: makePhrase({ lastSeen: '2026-07-10T13:00:00.000Z' }) });
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects state keys that are not the lowercased display', () => {
        const fixture = makeFixture({ PLATNER: makePhrase() });
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects empty or padded phrases', () => {
        const fixture = makeFixture({ ' ': makePhrase({ display: ' ' }) });
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects descriptions not derived from the state entry', () => {
        const fixture = makeFixture();
        fixture.category['New Developments'].keywords.Platner.description =
            'In 31337 outlets across the spectrum (since 2026-07-09)';
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects out-of-bounds numeric metadata', () => {
        for (const overrides of [{ heat: 1e9, peakHeat: 1e9 }, { outlets: 9999 }, { daysActive: 99999 }]) {
            const fixture = makeFixture({ platner: makePhrase(overrides) });
            expect(validateTrending(fixture)).not.toEqual([]);
        }
    });

    it('rejects entries already expired at the update time', () => {
        const fixture = makeFixture({
            platner: makePhrase({ lastSeen: '2026-07-09T12:00:00.000Z', expiresAt: '2026-07-10T11:00:00.000Z' })
        });
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects containers that are not plain objects', () => {
        let fixture = makeFixture();
        fixture.category['New Developments'].keywords = [];
        expect(validateTrending(fixture)).not.toEqual([]);

        fixture = makeFixture();
        fixture.state.phrases = [];
        expect(validateTrending(fixture)).not.toEqual([]);
    });

    it('rejects an updatedAt that drifts from the heuristic baseline', () => {
        const problems = validateTrending({
            ...makeFixture(),
            baselinePhrases: { platner: makePhrase() },
            baselineUpdatedAt: '2026-07-10T06:00:00.000Z',
            headlines: []
        });
        expect(problems.join()).toContain('baseline');
    });

    it('does not treat __proto__ as a baseline entry', () => {
        // "__proto__" in {} is true via the prototype chain, so an `in`
        // check would skip headline validation for this added phrase
        const fixture = makeFixture(
            Object.fromEntries([
                ['platner', makePhrase()],
                ['__proto__', makePhrase({ display: '__proto__', firstSeen: NOW })]
            ])
        );
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            headlines: [{ title: 'Unrelated headline', source: 'abc', lean: 'center' }]
        });
        expect(problems.join()).toContain('__proto__');
    });

    it('requires added phrases on word boundaries in headlines from 3+ sources', () => {
        const headline = (title, source) => ({ title, source, lean: 'center' });
        const added = makePhrase({ display: 'Epstein Files', firstSeen: NOW, outlets: 3 });
        const fixture = makeFixture({ platner: makePhrase(), 'epstein files': added });
        const baselinePhrases = { platner: makePhrase() };

        const missing = validateTrending({
            ...fixture, baselinePhrases,
            headlines: [headline('Platner surges in Maine', 'abc')]
        });
        expect(missing.join()).toContain('epstein files');

        const tooFewSources = validateTrending({
            ...fixture, baselinePhrases,
            headlines: [
                headline('New Epstein files released', 'abc'),
                headline('Epstein files stun Congress', 'abc')
            ]
        });
        expect(tooFewSources.join()).toContain('epstein files');

        const present = validateTrending({
            ...fixture, baselinePhrases,
            headlines: [
                headline('New Epstein files released by committee', 'abc'),
                headline('Epstein files stun Congress', 'fox'),
                headline('What the Epstein files reveal', 'npr')
            ]
        });
        expect(present).toEqual([]);
    });

    it('rejects an added phrase whose outlets count overstates headline evidence', () => {
        const headline = (title, source) => ({ title, source, lean: 'center' });
        const added = makePhrase({ display: 'Epstein Files', firstSeen: NOW, outlets: 9 });
        const fixture = makeFixture({ platner: makePhrase(), 'epstein files': added });
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            headlines: [
                headline('New Epstein files released by committee', 'abc'),
                headline('Epstein files stun Congress', 'fox'),
                headline('What the Epstein files reveal', 'npr')
            ]
        });
        expect(problems.join()).toContain('overstates');
    });

    it('rejects substring matches inside larger words', () => {
        const headline = (title, source) => ({ title, source, lean: 'center' });
        const added = makePhrase({ display: 'War', firstSeen: NOW, outlets: 5 });
        const fixture = makeFixture({ platner: makePhrase(), war: added });
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            headlines: [
                headline('Awards season kicks off', 'abc'),
                headline('Awards gala draws stars', 'fox'),
                headline('Toward a new deal', 'npr')
            ]
        });
        expect(problems.join()).toContain('war');
    });

    it('rejects retained entries whose tracking metadata was rewritten', () => {
        const fixture = makeFixture({ platner: makePhrase({ heat: 500, peakHeat: 500 }) });
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() }
        });
        expect(problems.join()).toContain('altered from the heuristic baseline');
    });

    it('allows display re-casing on retained entries', () => {
        const fixture = makeFixture({ platner: makePhrase({ display: 'PLATNER' }) });
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            baselineCategory: makeFixture().category
        });
        expect(problems).toEqual([]);
    });

    it('rejects removing a phrase from trending.json while state still tracks it', () => {
        const baseline = makeFixture();
        const curated = makeFixture();
        delete curated.category['New Developments'].keywords.Platner;
        const problems = validateTrending({
            ...curated,
            baselinePhrases: baseline.state.phrases,
            baselineCategory: baseline.category
        });
        expect(problems.join()).toContain('still tracked in state');
    });

    it('rejects state-only additions that are never published', () => {
        const headline = (title, source) => ({ title, source, lean: 'center' });
        const added = makePhrase({ display: 'Epstein Files', firstSeen: NOW, outlets: 3 });
        const fixture = makeFixture({ platner: makePhrase(), 'epstein files': added });
        delete fixture.category['New Developments'].keywords['Epstein Files'];
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            headlines: [
                headline('New Epstein files released by committee', 'abc'),
                headline('Epstein files stun Congress', 'fox'),
                headline('What the Epstein files reveal', 'npr')
            ]
        });
        expect(problems.join()).toContain('must also be published');
    });

    it('requires headline evidence to republish a dormant tracked phrase', () => {
        const headline = (title, source) => ({ title, source, lean: 'center' });
        const dormant = makePhrase({ display: 'Dormant Topic' });
        // Baseline run tracked the phrase but did not publish it
        const baseline = makeFixture({ platner: makePhrase() });
        const curated = makeFixture({ platner: makePhrase(), 'dormant topic': dormant });
        const args = {
            ...curated,
            baselinePhrases: { platner: makePhrase(), 'dormant topic': dormant },
            baselineCategory: baseline.category
        };

        const unsupported = validateTrending({
            ...args,
            headlines: [headline('Unrelated headline', 'abc')]
        });
        expect(unsupported.join()).toContain('dormant topic');

        const supported = validateTrending({
            ...args,
            headlines: [
                headline('Dormant topic roars back', 'abc'),
                headline('The dormant topic fight resumes', 'fox'),
                headline('Dormant topic splits Congress', 'npr')
            ]
        });
        expect(supported).toEqual([]);
    });

    it('skips the headline check for phrases already in the baseline', () => {
        const fixture = makeFixture();
        const problems = validateTrending({
            ...fixture,
            baselinePhrases: { platner: makePhrase() },
            headlines: [{ title: 'Unrelated headline', source: 'abc', lean: 'center' }]
        });
        expect(problems).toEqual([]);
    });
});
