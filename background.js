// GuardianLens v10.0 - Background Service Worker
// Handles extension lifecycle, settings, and API calls

'use strict';

// ===================== CONSTANTS =====================
const STORAGE_KEYS = {
    enabled: 'guardianEnabled',
    apiKey: 'geminiApiKey',
    sensitivity: 'guardianSensitivity',
    platforms: 'guardianPlatforms',
    stats: 'guardianStats'
};

const DEFAULT_SETTINGS = {
    [STORAGE_KEYS.enabled]: true,
    [STORAGE_KEYS.sensitivity]: 'medium',
    [STORAGE_KEYS.platforms]: {
        youtube: true,
        linkedin: true,
        instagram: true,
        gmail: true,
        quora: true,
        twitter: true,
        reddit: true,
        facebook: true
    },
    [STORAGE_KEYS.stats]: {
        totalBlurred: 0,
        sessionsProtected: 0,
        lastActive: null
    }
};

// ===================== INSTALLATION =====================
chrome.runtime.onInstalled.addListener((details) => {
    console.log('GuardianLens installed:', details.reason);

    if (details.reason === 'install') {
        // Set default settings on first install
        chrome.storage.sync.set(DEFAULT_SETTINGS);
        console.log('Default settings applied');
    }

    // Update session count
    chrome.storage.sync.get(STORAGE_KEYS.stats, (result) => {
        const stats = result[STORAGE_KEYS.stats] || DEFAULT_SETTINGS[STORAGE_KEYS.stats];
        stats.sessionsProtected++;
        stats.lastActive = new Date().toISOString();
        chrome.storage.sync.set({ [STORAGE_KEYS.stats]: stats });
    });
});

// ===================== MESSAGE HANDLING =====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'guardian_fetch') {
        handleFetch(message.payload)
            .then(sendResponse)
            .catch((error) => {
                console.error('Fetch error:', error);
                sendResponse({ ok: false, error: error.message });
            });
        return true; // Keep channel open for async response
    }

    if (message.type === 'get_settings') {
        chrome.storage.sync.get(null, (settings) => {
            sendResponse(settings);
        });
        return true;
    }

    if (message.type === 'update_stats') {
        chrome.storage.sync.get(STORAGE_KEYS.stats, (result) => {
            const stats = result[STORAGE_KEYS.stats] || DEFAULT_SETTINGS[STORAGE_KEYS.stats];
            stats.totalBlurred += message.count || 0;
            stats.lastActive = new Date().toISOString();
            chrome.storage.sync.set({ [STORAGE_KEYS.stats]: stats });
            sendResponse({ success: true });
        });
        return true;
    }

    return false;
});

// ===================== FETCH HANDLER =====================
async function handleFetch(payload) {
    try {
        const response = await fetch(payload.url, payload.options);
        const data = await response.json();

        return {
            ok: response.ok,
            status: response.status,
            data: data
        };
    } catch (error) {
        return {
            ok: false,
            error: error.message
        };
    }
}

// ===================== KEEP-ALIVE =====================
// Create alarm to keep service worker active
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        console.log('GuardianLens: Service worker active');
    }
});

// ===================== STARTUP =====================
chrome.runtime.onStartup.addListener(() => {
    console.log('GuardianLens: Browser started');

    // Update stats
    chrome.storage.sync.get(STORAGE_KEYS.stats, (result) => {
        const stats = result[STORAGE_KEYS.stats] || DEFAULT_SETTINGS[STORAGE_KEYS.stats];
        stats.sessionsProtected++;
        stats.lastActive = new Date().toISOString();
        chrome.storage.sync.set({ [STORAGE_KEYS.stats]: stats });
    });
});

console.log('GuardianLens v10.0 Background Service Worker Ready');
