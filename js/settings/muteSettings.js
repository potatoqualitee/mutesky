const DEFAULT_SETTINGS = {
    duration: 'forever',
    scope: 'text-and-tags',
    excludeFollows: true
};

export function loadMuteSettings() {
    try {
        const saved = localStorage.getItem('muteSettings');
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (error) {
        console.error('Error loading mute settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
}

export function saveMuteSettings(settings) {
    try {
        localStorage.setItem('muteSettings', JSON.stringify({
            ...DEFAULT_SETTINGS,
            ...settings
        }));
    } catch (error) {
        console.error('Error saving mute settings:', error);
    }
}

export function getExpirationDate(duration) {
    if (duration === 'forever') return null;

    const now = new Date();
    switch (duration) {
        case '24h':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        default:
            return null;
    }
}
