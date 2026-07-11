export const myKeywordsTemplate = `
    <div id="my-keywords-modal" class="modal">
        <div class="modal-content my-keywords-content">
            <button class="modal-close" onclick="window.myKeywordsHandlers.handleMyKeywordsModalToggle()">&times;</button>

            <div class="modal-header">
                <h2>My Keywords</h2>
            </div>

            <div class="modal-body">
                <p class="my-keywords-intro">
                    Add your own words or phrases to mute — anything MuteSky's lists don't
                    cover. When a shared default is retired, MuteSky keeps it here instead
                    of silently dropping your mute. Paste a whole list at once: one per line
                    or separated by commas. Changes are applied when you press Mute, and you
                    can uncheck them anytime under "My Keywords" in Advanced Mode.
                </p>

                <div class="my-keywords-add">
                    <textarea id="my-keywords-input" rows="2"
                        placeholder="e.g. spoilers, pumpkin spice latte, my ex's name"
                        aria-label="Keywords to add"></textarea>
                    <button id="my-keywords-add-btn" class="btn-primary"
                        onclick="window.myKeywordsHandlers.handleMyKeywordsAdd()">Add</button>
                </div>

                <div id="my-keywords-feedback" class="my-keywords-feedback" role="status"></div>

                <div id="my-keywords-list" class="my-keywords-list" aria-live="polite">
                    <!-- Populated by myKeywordsHandlers.js -->
                </div>
            </div>

            <div class="modal-footer my-keywords-footer">
                <div id="my-keywords-usage" class="my-keywords-usage">
                    <!-- Populated by myKeywordsHandlers.js -->
                </div>
            </div>
        </div>
    </div>
`;
