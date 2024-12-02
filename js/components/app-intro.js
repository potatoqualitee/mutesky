class AppIntro extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <div class="app-intro">
                <p>Mutesky helps you manage and filter unwanted content on your Bluesky feed using curated keyword groups and smart filtering. Choose Simple Mode for easy context-based filtering with exceptions, or Advanced Mode for detailed control over individual keywords and categories.</p>
            </div>
        `;
    }
}

customElements.define('app-intro', AppIntro);

export default AppIntro;
