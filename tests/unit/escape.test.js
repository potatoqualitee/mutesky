import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeJsAttr } from '../../js/utils/escape.js';

describe('escapeHtml', () => {
    it('neutralizes markup', () => {
        expect(escapeHtml('<script>alert(1)</script>'))
            .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(escapeHtml('a & "b" \'c\'')).toBe('a &amp; &quot;b&quot; &#39;c&#39;');
    });

    it('renders inert inside innerHTML', () => {
        const div = document.createElement('div');
        div.innerHTML = `<span>${escapeHtml('<img src=x onerror=alert(1)>')}</span>`;
        expect(div.querySelector('img')).toBeNull();
        expect(div.textContent).toBe('<img src=x onerror=alert(1)>');
    });
});

describe('escapeJsAttr', () => {
    it('cannot break out of a single-quoted JS string in an attribute', () => {
        // A keyword with an apostrophe -- common in political names/phrases
        const hostile = "O'Brien'); alert(1);//";
        const div = document.createElement('div');
        div.innerHTML = `<button onclick="fn('${escapeJsAttr(hostile)}')">x</button>`;

        // The attribute must parse back to a single fn('...') call containing
        // the original text once the browser decodes entities
        const attr = div.querySelector('button').getAttribute('onclick');
        expect(attr).toBe("fn('O\\'Brien\\'); alert(1);//')");
    });

    it('escapes backslashes before quotes', () => {
        expect(escapeJsAttr("\\'")).toBe('\\\\\\&#39;');
    });
});
