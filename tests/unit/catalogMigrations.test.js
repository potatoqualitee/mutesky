import { describe, it, expect, beforeEach } from 'vitest';

import { state } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import {
    getPreservedRetirements,
    reconcileCatalogMigrations
} from '../../js/api/catalogMigrations.js';
import {
    MY_KEYWORD_ORIGIN_RETIRED_DEFAULT,
    MY_KEYWORD_ORIGIN_USER
} from '../../js/myKeywords.js';

function manifest(changes) {
    return {
        schemaVersion: 1,
        catalogVersion: '2026.07.1',
        migrations: [{
            version: '2026.07.1',
            releasedAt: '2026-07-10',
            changes
        }]
    };
}

function retirement(keyword = 'Old Topic', extra = {}) {
    return {
        type: 'retire',
        keyword,
        category: 'Old Category',
        lifecycle: 'event',
        preserveExistingMute: true,
        reason: 'No longer current',
        ...extra
    };
}

function rename(from = 'Tim Cast', to = 'Timcast') {
    return {
        type: 'rename',
        from,
        to,
        category: 'New Developments',
        preservePreference: true,
        reason: 'Canonical spelling'
    };
}

beforeEach(() => {
    resetStateWithFixtures();
});

describe('catalog migration manifest parsing', () => {
    it('accepts only explicit preserved retirements and renames from schema v1', () => {
        const parsed = getPreservedRetirements(manifest([
            retirement(),
            retirement('Drop Me', { preserveExistingMute: false }),
            rename('old', 'new')
        ]));

        expect(parsed.map(item => [item.keyword, item.operation])).toEqual([
            ['Old Topic', 'retire'],
            ['old', 'rename']
        ]);
        expect(parsed[0].id).toBe('2026.07.1:retire:old topic');
        expect(parsed[1].id).toBe('2026.07.1:rename:old->new');
    });

    it('ignores malformed or unsupported manifests instead of inferring a diff', () => {
        expect(getPreservedRetirements({ schemaVersion: 2, migrations: [] })).toEqual([]);
        expect(getPreservedRetirements({ removedKeywords: ['Old Topic'] })).toEqual([]);
    });
});

describe('reconcileCatalogMigrations', () => {
    it('moves an active retired default into My Keywords with provenance', () => {
        state.activeKeywords.add('Old Topic');

        const result = reconcileCatalogMigrations(state, manifest([retirement()]));

        expect(result.added).toEqual(['Old Topic']);
        expect(state.myKeywords.has('Old Topic')).toBe(true);
        expect(state.myKeywordProvenance.get('old topic')).toMatchObject({
            origin: MY_KEYWORD_ORIGIN_RETIRED_DEFAULT,
            category: 'Old Category',
            lifecycle: 'event',
            reason: 'No longer current'
        });
        expect(state.appliedCatalogMigrations.has('2026.07.1:retire:old topic')).toBe(true);
    });

    it('keeps an actually muted retirement checked even without saved active state', () => {
        state.originalMutedKeywords.add('old topic');

        reconcileCatalogMigrations(state, manifest([retirement()]));

        expect(state.myKeywords.has('Old Topic')).toBe(true);
        expect(state.activeKeywords.has('Old Topic')).toBe(true);
    });

    it('respects a sticky manual opt-out and consumes the migration once', () => {
        state.originalMutedKeywords.add('old topic');
        state.manuallyUnchecked.add('OLD TOPIC');

        const result = reconcileCatalogMigrations(state, manifest([retirement()]));

        expect(result.added).toEqual([]);
        expect(state.myKeywords.size).toBe(0);
        expect(result.applied).toEqual(['2026.07.1:retire:old topic']);
    });

    it('waits while the keyword is still present in the current catalog', () => {
        const result = reconcileCatalogMigrations(
            state,
            manifest([retirement('gun control')])
        );

        expect(result.added).toEqual([]);
        expect(result.applied).toEqual([]);
        expect(state.appliedCatalogMigrations.size).toBe(0);
    });

    it('never overwrites user-authored ownership', () => {
        state.myKeywords.add('Old Topic');
        state.myKeywordProvenance.set('old topic', { origin: MY_KEYWORD_ORIGIN_USER });
        state.activeKeywords.add('Old Topic');

        reconcileCatalogMigrations(state, manifest([retirement()]));

        expect(state.myKeywords.size).toBe(1);
        expect(state.myKeywordProvenance.get('old topic')).toEqual({
            origin: MY_KEYWORD_ORIGIN_USER
        });
    });

    it('keeps an old spelling and stages its explicit catalog replacement', () => {
        state.keywordGroups['Political Rhetoric']['Political Rhetoric']
            .keywords.Timcast = { weight: 3 };
        state.activeKeywords.add('Tim Cast');

        const result = reconcileCatalogMigrations(state, manifest([rename()]));

        expect(result.added).toEqual(['Tim Cast']);
        expect(result.staged).toEqual(['Timcast']);
        expect(state.activeKeywords.has('Tim Cast')).toBe(true);
        expect(state.activeKeywords.has('Timcast')).toBe(true);
        expect(state.myKeywordProvenance.get('tim cast')).toMatchObject({
            origin: MY_KEYWORD_ORIGIN_RETIRED_DEFAULT,
            operation: 'rename',
            replacement: 'Timcast',
            reason: 'Canonical spelling'
        });
    });

    it('does not stage a replacement for an independently user-owned spelling', () => {
        state.keywordGroups['Political Rhetoric']['Political Rhetoric']
            .keywords.Timcast = { weight: 3 };
        state.myKeywords.add('Tim Cast');
        state.myKeywordProvenance.set('tim cast', { origin: MY_KEYWORD_ORIGIN_USER });
        state.activeKeywords.add('Tim Cast');

        const result = reconcileCatalogMigrations(state, manifest([rename()]));

        expect(result.staged).toEqual([]);
        expect(state.activeKeywords.has('Timcast')).toBe(false);
        expect(state.myKeywordProvenance.get('tim cast'))
            .toEqual({ origin: MY_KEYWORD_ORIGIN_USER });
    });
    it('does not stage a rename replacement the user explicitly opted out of', () => {
        state.keywordGroups['Political Rhetoric']['Political Rhetoric']
            .keywords.Timcast = { weight: 3 };
        state.originalMutedKeywords.add('tim cast');
        state.manuallyUnchecked.add('TIMCAST');

        const result = reconcileCatalogMigrations(state, manifest([rename()]));

        expect(result.added).toEqual(['Tim Cast']);
        expect(result.staged).toEqual([]);
        expect(state.activeKeywords.has('Tim Cast')).toBe(true);
        expect(state.activeKeywords.has('Timcast')).toBe(false);
    });

    it('is idempotent', () => {
        state.activeKeywords.add('Old Topic');
        const data = manifest([retirement()]);

        reconcileCatalogMigrations(state, data);
        const second = reconcileCatalogMigrations(state, data);

        expect(second).toEqual({ added: [], staged: [], applied: [], stateChanged: false });
        expect(state.myKeywords).toEqual(new Set(['Old Topic']));
        expect(state.appliedCatalogMigrations.size).toBe(1);
    });
});
