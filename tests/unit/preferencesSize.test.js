import { describe, it, expect, vi, beforeEach } from 'vitest';

// MuteService pulls in settings handlers (localStorage) but not the whole app
import {
    MuteService,
    PreferencesSizeError,
    measureJsonBytes,
    MAX_PREFERENCES_BYTES,
    PDS_JSON_LIMIT_BYTES
} from '../../js/mute.js';

const putPreferences = vi.fn(async () => ({}));
const getPreferences = vi.fn();

vi.mock('@atproto/api', () => ({
    Agent: class {
        constructor() {
            this.app = {
                bsky: {
                    actor: {
                        getPreferences: (...args) => getPreferences(...args),
                        putPreferences: (...args) => putPreferences(...args)
                    }
                }
            };
        }
    }
}));

function mutedWordsPref(count, valuePrefix = 'keyword') {
    return {
        $type: 'app.bsky.actor.defs#mutedWordsPref',
        items: Array.from({ length: count }, (_, i) => ({
            value: `${valuePrefix}-${i}`,
            targets: ['content', 'tag']
        }))
    };
}

beforeEach(() => {
    putPreferences.mockClear();
    getPreferences.mockClear();
    localStorage.clear();
});

describe('measureJsonBytes', () => {
    it('measures UTF-8 wire bytes, not string length', () => {
        const s = 'héllo🎉';
        expect(measureJsonBytes(s)).toBeGreaterThan(s.length);
        expect(measureJsonBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    });
});

describe('PreferencesSizeError', () => {
    it('estimates how many keywords to deselect', () => {
        const err = new PreferencesSizeError({
            payloadBytes: 200 * 1024,
            limitBytes: MAX_PREFERENCES_BYTES,
            mutedWordCount: 1500,
            mutedWordsBytes: 90 * 1024
        });
        expect(err.keywordsToRemove).toBeGreaterThan(0);
        expect(err.message).toMatch(/deselecting roughly [\d,]+ keywords/);
    });

    it('gives generic guidance when the server rejected below our limit', () => {
        const err = new PreferencesSizeError({
            payloadBytes: 100 * 1024,
            limitBytes: MAX_PREFERENCES_BYTES,
            mutedWordCount: 1000,
            mutedWordsBytes: 60 * 1024,
            serverRejected: true
        });
        expect(err.keywordsToRemove).toBeNull();
        expect(err.message).not.toMatch(/roughly/);
        expect(err.message).toMatch(/too large/);
    });
});

describe('MuteService.updateMutedKeywords size guard', () => {
    const session = { did: 'did:plc:test' };

    it('submits small payloads and preserves custom keywords', async () => {
        getPreferences.mockResolvedValue({
            data: {
                preferences: [
                    {
                        $type: 'app.bsky.actor.defs#mutedWordsPref',
                        items: [
                            { value: 'my-custom-word', targets: ['content'] },
                            { value: 'managed-1', targets: ['content', 'tag'] }
                        ]
                    }
                ]
            }
        });

        const service = new MuteService(session);
        await service.updateMutedKeywords(['managed-2'], ['managed-1', 'managed-2']);

        expect(putPreferences).toHaveBeenCalledTimes(1);
        const sent = putPreferences.mock.calls[0][0].preferences;
        const pref = sent.find(p => p.$type === 'app.bsky.actor.defs#mutedWordsPref');
        const values = pref.items.map(i => i.value);
        expect(values).toContain('my-custom-word');  // user's own keyword kept
        expect(values).toContain('managed-2');       // newly selected
        expect(values).not.toContain('managed-1');   // deselected managed keyword
    });

    it('throws PreferencesSizeError before sending an oversized payload', async () => {
        // ~3000 selected keywords x ~50 bytes each puts the payload well past 148KB
        const managed = Array.from({ length: 3000 }, (_, i) => `managed-keyword-${i}`);
        getPreferences.mockResolvedValue({
            data: { preferences: [mutedWordsPref(0)] }
        });

        const service = new MuteService(session);
        await expect(service.updateMutedKeywords(managed, managed))
            .rejects.toThrow(PreferencesSizeError);
        expect(putPreferences).not.toHaveBeenCalled();
    });

    it('translates a server 413 into PreferencesSizeError', async () => {
        getPreferences.mockResolvedValue({
            data: { preferences: [mutedWordsPref(0)] }
        });
        putPreferences.mockRejectedValueOnce(
            Object.assign(new Error('request entity too large'), { status: 413 })
        );

        const service = new MuteService(session);
        await expect(service.updateMutedKeywords(['a'], ['a']))
            .rejects.toThrow(PreferencesSizeError);
    });

    it('sanity: limit constants line up with the PDS jsonLimit', () => {
        expect(PDS_JSON_LIMIT_BYTES).toBe(150 * 1024);
        expect(MAX_PREFERENCES_BYTES).toBeLessThan(PDS_JSON_LIMIT_BYTES);
    });
});
