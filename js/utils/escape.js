// Escape a value for interpolation into HTML markup. The keyword lists and
// context/category names are fetched from a remote repo at runtime, so they
// must be treated as untrusted even though we curate them.
export function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// Escape a value for embedding inside a single-quoted JS string that itself
// lives inside an HTML attribute (onclick="fn('...')"). The browser decodes
// HTML entities before the JS engine sees the string, so backslash-escape the
// JS delimiters first, then HTML-escape the result.
export function escapeJsAttr(value) {
    return escapeHtml(
        String(value)
            .replaceAll('\\', '\\\\')
            .replaceAll("'", "\\'")
            .replaceAll('\n', '\\n')
            .replaceAll('\r', '\\r')
    );
}
