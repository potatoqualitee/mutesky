import { updateWarningVisibility } from '../handlers/modalHandlers.js';
import { loadAppearanceSettings, saveAppearanceSettings } from '../settings/appearanceSettings.js';

class SettingsModal extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <div id="settings-modal" class="modal">
                <div class="modal-content">
                    <button class="modal-close" onclick="window.settingsHandlers.handleSettingsModalToggle()">&times;</button>

                    <div class="settings-tabs">
                        <button class="settings-tab active" data-tab="muting">Muting</button>
                        <button class="settings-tab" data-tab="appearance">Appearance</button>
                        <button class="settings-tab" data-tab="about">About</button>
                    </div>

                    <div class="settings-content active" data-content="muting">
                        <div class="settings-group">
                            <h3>Mute Duration</h3>
                            <div class="settings-option">
                                <input type="radio" id="duration-forever" name="duration" value="forever">
                                <div class="radio-circle"></div>
                                <label for="duration-forever">Forever</label>
                            </div>
                            <div class="settings-option">
                                <input type="radio" id="duration-24h" name="duration" value="24h">
                                <div class="radio-circle"></div>
                                <label for="duration-24h">24 hours</label>
                            </div>
                            <div class="settings-option">
                                <input type="radio" id="duration-7d" name="duration" value="7d">
                                <div class="radio-circle"></div>
                                <label for="duration-7d">7 days</label>
                            </div>
                            <div class="settings-option">
                                <input type="radio" id="duration-30d" name="duration" value="30d">
                                <div class="radio-circle"></div>
                                <label for="duration-30d">30 days</label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <h3>Mute Scope</h3>
                            <div class="settings-option">
                                <input type="radio" id="scope-text-tags" name="scope" value="text-and-tags">
                                <div class="radio-circle"></div>
                                <label for="scope-text-tags">Text & tags</label>
                            </div>
                            <div class="settings-option">
                                <input type="radio" id="scope-tags" name="scope" value="tags-only">
                                <div class="radio-circle"></div>
                                <label for="scope-tags">Tags only</label>
                            </div>
                        </div>

                        <div class="settings-group">
                            <h3>Exceptions</h3>
                            <div class="settings-option">
                                <input type="checkbox" id="exclude-follows">
                                <div class="checkbox-box"></div>
                                <label for="exclude-follows">Don't mute people I follow</label>
                            </div>
                        </div>
                    </div>

                    <div class="settings-content" data-content="appearance">
                        <div class="settings-group">
                            <h3>Color mode</h3>
                            <div class="button-group">
                                <button class="theme-mode-switch" data-theme="system">System</button>
                                <button class="theme-mode-switch" data-theme="light">Light</button>
                                <button class="theme-mode-switch" data-theme="dark">Dark</button>
                            </div>
                        </div>

                        <div class="settings-group">
                            <h3>Font</h3>
                            <div class="button-group">
                                <button class="font-switch" data-font="system">System font</button>
                                <button class="font-switch" data-font="theme">Theme font</button>
                            </div>
                        </div>

                        <div class="settings-group">
                            <h3>Font size</h3>
                            <div class="button-group">
                                <button class="font-switch" data-size="smaller">Smaller</button>
                                <button class="font-switch" data-size="default">Default</button>
                                <button class="font-switch" data-size="larger">Larger</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-content" data-content="about">
                        <div class="settings-group about-content">
                            <div class="about-header">
                                <div class="creator-image-container">
                                    <img src="https://cdn.bsky.app/img/avatar/plain/did:plc:oqmead6vafy6py7otaam7whk/bafkreibqosdn5givnkc34j2vmeomf4tpsfo52i6pydviqcwebyhgbhtule@jpeg"
                                         alt="Creator"
                                         class="creator-image"
                                         loading="lazy"
                                         width="80"
                                         height="80">
                                </div>
                                <div class="about-title">
                                    <h2>Mutesky</h2>
                                    <span class="version">Version 1.0.0</span>
                                </div>
                            </div>
                            <div class="about-description">
                                <p>Mutesky is based off of my old Twitter mental health mute list.</p>
                                <p style="margin-top: 16px">This project was built with <a href="https://github.com/cline/cline">Cline</a> and used $300 in Openrouter.ai and Anthropic API credits. My wife says I can't get any more so pls help me keep this project going 😅</p>
                            </div>
                            <div class="about-links">
                                <div class="about-link">
                                    <span class="link-label">Created by:</span>
                                    <a href="https://bsky.app/profile/funbucket.dev" target="_blank" class="link-value">Chrissy LeMaire</a>
                                </div>
                                <div class="about-link">
                                    <span class="link-label">GitHub:</span>
                                    <a href="https://github.com/potatoqualitee/mutesky" target="_blank" class="link-value">github.com/potatoqualitee/mutesky</a>
                                </div>
                            </div>

                            <div class="sponsor-section">
                                <p class="sponsor-text">Support the development of Mutesky</p>
                                <a href="https://github.com/sponsors/potatoqualitee" target="_blank" class="sponsor-button">
                                    <img src="images/sponsor.svg" alt="Sponsor on GitHub">
                                    <span>Become a Sponsor</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <div id="settings-warning" class="settings-warning">
                            Note: Temporary muting may reduce the number of keywords you can mute.
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add tab switching functionality
        this.setupTabs();
        // Add appearance settings handlers
        this.setupAppearanceHandlers();
    }

    setupTabs() {
        const tabs = this.querySelectorAll('.settings-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and contents
                this.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                this.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));

                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const content = this.querySelector(`[data-content="${tab.dataset.tab}"]`);
                content.classList.add('active');

                // Show/hide warning based on active tab and duration
                const warningElement = this.querySelector('.settings-warning');
                if (tab.dataset.tab === 'muting') {
                    const duration = document.querySelector('input[name="duration"]:checked')?.value;
                    warningElement.style.display = duration && duration !== 'forever' ? 'flex' : 'none';
                } else {
                    warningElement.style.display = 'none';
                }

                // Lazy load the creator image when about tab is clicked
                if (tab.dataset.tab === 'about') {
                    const img = this.querySelector('.creator-image');
                    if (img) {
                        img.loading = 'eager'; // Switch to eager loading when tab is active
                    }
                }
            });
        });
    }

    setupAppearanceHandlers() {
        // Load current settings from localStorage
        const settings = loadAppearanceSettings();

        // Set initial active states
        this.querySelector(`.theme-mode-switch[data-theme="${settings.colorMode}"]`)?.classList.add('active');
        this.querySelector(`.font-switch[data-font="${settings.font}"]`)?.classList.add('active');
        this.querySelector(`.font-switch[data-size="${settings.fontSize}"]`)?.classList.add('active');

        // Theme buttons
        this.querySelectorAll('.theme-mode-switch[data-theme]').forEach(button => {
            button.addEventListener('click', () => {
                this.querySelectorAll('.theme-mode-switch[data-theme]').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                settings.colorMode = button.dataset.theme;
                saveAppearanceSettings(settings);
            });
        });

        // Font buttons
        this.querySelectorAll('.font-switch[data-font]').forEach(button => {
            button.addEventListener('click', () => {
                this.querySelectorAll('.font-switch[data-font]').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                settings.font = button.dataset.font;
                saveAppearanceSettings(settings);
            });
        });

        // Font size buttons
        this.querySelectorAll('.font-switch[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                this.querySelectorAll('.font-switch[data-size]').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                settings.fontSize = button.dataset.size;
                saveAppearanceSettings(settings);
            });
        });
    }
}

customElements.define('settings-modal', SettingsModal);

export { SettingsModal };
