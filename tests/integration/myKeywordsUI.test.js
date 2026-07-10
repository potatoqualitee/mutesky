import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../js/bluesky.js', () => ({
    blueskyService: {
        session: null,
        mute: { getMutedKeywords: vi.fn(async () => []), updateMutedKeywords: vi.fn(async () => true) },
        updateMuteCount: vi.fn(async () => {}),
        setup: vi.fn(async () => ({}))
    }
}));

vi.mock('@atproto/api', () => ({
    Agent: class {}
}));

import { state } from '../../js/state.js';
import { resetStateWithFixtures } from '../helpers/fixtures.js';
import '../../js/components/modals/keywords-modal.js';
import {
    handleMyKeywordsModalToggle,
    handleMyKeywordsAdd,
    handleMyKeywordsRemove
} from '../../js/handlers/myKeywordsHandlers.js';

function modal() {
    return document.getElementById('my-keywords-modal');
}

beforeEach(() => {
    resetStateWithFixtures();
    document.body.innerHTML = '<my-keywords-modal></my-keywords-modal>';
    window.myKeywordsHandlers = {
        handleMyKeywordsModalToggle,
        handleMyKeywordsAdd,
        handleMyKeywordsRemove
    };
});

describe('My Keywords modal', () => {
    it('opens with an empty state and a usage meter', () => {
        handleMyKeywordsModalToggle();

        expect(modal().classList.contains('visible')).toBe(true);
        expect(document.getElementById('my-keywords-list').textContent)
            .toContain('No keywords yet');
        expect(document.getElementById('my-keywords-usage').textContent)
            .toMatch(/0 keywords selected/);
    });

    it('adds keywords from the textarea and renders chips sorted', () => {
        handleMyKeywordsModalToggle();
        document.getElementById('my-keywords-input').value = 'zebra, Apple\nmango';
        handleMyKeywordsAdd();

        const chips = Array.from(document.querySelectorAll('.my-keyword-chip'))
            .map(chip => chip.textContent.replace('×', '').trim());
        expect(chips).toEqual(['Apple', 'mango', 'zebra']);
        expect(document.getElementById('my-keywords-feedback').textContent)
            .toContain('Added 3 keywords');
        expect(document.getElementById('my-keywords-input').value).toBe('');
        expect(state.activeKeywords.has('zebra')).toBe(true);
        // Meter reflects the pending selection
        expect(document.getElementById('my-keywords-usage').textContent)
            .toMatch(/3 keywords selected/);
    });

    it('escapes hostile keyword text in the chip list', () => {
        handleMyKeywordsModalToggle();
        document.getElementById('my-keywords-input').value = `"><img src=x onerror="hacked()">`;
        handleMyKeywordsAdd();

        const list = document.getElementById('my-keywords-list');
        expect(list.querySelector('img')).toBeNull();
        expect(list.textContent).toContain('"><img src=x onerror="hacked()">');
    });

    it('removes a keyword via its chip handler and reports the pending unmute', () => {
        handleMyKeywordsModalToggle();
        document.getElementById('my-keywords-input').value = 'spoilers';
        handleMyKeywordsAdd();

        handleMyKeywordsRemove('spoilers');

        expect(document.querySelectorAll('.my-keyword-chip')).toHaveLength(0);
        expect(document.getElementById('my-keywords-feedback').textContent)
            .toContain('Removed "spoilers"');
        expect(state.myKeywords.size).toBe(0);
        expect(state.removedMyKeywords.has('spoilers')).toBe(true);
    });

    it('routes curated keywords to their existing checkbox instead of a chip', () => {
        handleMyKeywordsModalToggle();
        document.getElementById('my-keywords-input').value = 'gun control';
        handleMyKeywordsAdd();

        expect(document.querySelectorAll('.my-keyword-chip')).toHaveLength(0);
        expect(document.getElementById('my-keywords-feedback').textContent)
            .toContain("already in MuteSky's lists");
        expect(state.activeKeywords.has('gun control')).toBe(true);
    });
});
