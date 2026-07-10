import { myKeywordsTemplate } from './keywords-template.js';

// Dumb shell like SettingsModal: this file is loaded unbundled by
// components/index.js, so it must not import app state or handlers. All
// behavior lives in js/handlers/myKeywordsHandlers.js (the bundle), reached
// through window.myKeywordsHandlers at event time.
class MyKeywordsModal extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = myKeywordsTemplate;

        // Enter adds the current input (Shift+Enter keeps inserting newlines
        // for multi-line pastes typed by hand)
        const input = this.querySelector('#my-keywords-input');
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                window.myKeywordsHandlers?.handleMyKeywordsAdd();
            }
        });
    }
}

customElements.define('my-keywords-modal', MyKeywordsModal);

export { MyKeywordsModal };
