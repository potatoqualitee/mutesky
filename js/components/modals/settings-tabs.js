export function setupTabHandlers() {
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
