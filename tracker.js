// GuardianLens v10.5 - Activity Tracker Module
// Tracks web activity for weekly parent reports
// Does NOT interfere with blur functionality

'use strict';

const ActivityTracker = {
    // Current session data
    session: {
        startTime: Date.now(),
        domain: location.hostname,
        category: 'general',
        timeSpent: 0
    },

    // Detect category based on domain
    detectCategory(domain) {
        const categories = {
            educational: [
                'coursera', 'udemy', 'khanacademy', 'edx', 'duolingo',
                'wikipedia', 'britannica', 'quizlet', 'chegg', 'studocu',
                'codecademy', 'freecodecamp', 'w3schools', 'stackoverflow',
                'github', 'gitlab', 'leetcode', 'hackerrank', 'kaggle',
                'google.com/search', 'scholar.google', 'research', 'edu'
            ],
            creative: [
                'figma', 'canva', 'photopea', 'codepen', 'replit',
                'scratch', 'tinkercad', 'behance', 'dribbble', 'deviantart'
            ],
            social: [
                'facebook', 'twitter', 'instagram', 'snapchat', 'tiktok',
                'linkedin', 'discord', 'reddit', 'whatsapp', 'messenger'
            ],
            entertainment: [
                'youtube', 'netflix', 'twitch', 'spotify', 'soundcloud',
                'hulu', 'disney', 'primevideo', 'hbomax', 'crunchyroll'
            ],
            productivity: [
                'docs.google', 'sheets.google', 'slides.google', 'notion',
                'trello', 'asana', 'monday', 'office', 'outlook', 'gmail'
            ]
        };

        const d = domain.toLowerCase();

        for (const [category, keywords] of Object.entries(categories)) {
            for (const keyword of keywords) {
                if (d.includes(keyword)) {
                    return category;
                }
            }
        }

        return 'other';
    },

    // Initialize tracking
    init() {
        this.session.domain = location.hostname;
        this.session.category = this.detectCategory(location.hostname);
        this.session.startTime = Date.now();

        // Track time spent
        this.trackTime();

        // Save on unload
        window.addEventListener('beforeunload', () => this.saveSession());

        // Save periodically
        setInterval(() => this.saveSession(), 60000); // Every minute

        console.log('[GL Tracker] Tracking:', this.session.domain, '|', this.session.category);
    },

    // Track active time
    trackTime() {
        let lastActive = Date.now();

        const updateTime = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const diff = now - lastActive;

                // Only count if less than 2 minutes (assumed inactive otherwise)
                if (diff < 120000) {
                    this.session.timeSpent += diff;
                }

                lastActive = now;
            }
        };

        // Update on activity
        ['mousemove', 'keydown', 'scroll', 'click'].forEach(event => {
            document.addEventListener(event, updateTime, { passive: true, once: false });
        });

        // Update on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                lastActive = Date.now();
            } else {
                updateTime();
            }
        });
    },

    // Save session to storage
    async saveSession() {
        if (this.session.timeSpent < 5000) return; // Skip if less than 5 seconds

        try {
            const today = new Date().toISOString().split('T')[0];

            // Get existing data
            const result = await chrome.storage.local.get('activityData');
            const data = result.activityData || {
                weekStart: this.getWeekStart(),
                dailyBreakdown: {},
                categoryTime: {},
                topWebsites: {},
                contentInterventions: 0,
                totalTime: 0
            };

            // Reset if new week
            if (data.weekStart !== this.getWeekStart()) {
                data.weekStart = this.getWeekStart();
                data.dailyBreakdown = {};
                data.categoryTime = {};
                data.topWebsites = {};
                data.contentInterventions = 0;
                data.totalTime = 0;
            }

            const minutes = Math.round(this.session.timeSpent / 60000);

            // Update daily breakdown
            data.dailyBreakdown[today] = (data.dailyBreakdown[today] || 0) + minutes;

            // Update category time
            data.categoryTime[this.session.category] = (data.categoryTime[this.session.category] || 0) + minutes;

            // Update top websites
            if (!data.topWebsites[this.session.domain]) {
                data.topWebsites[this.session.domain] = {
                    time: 0,
                    category: this.session.category
                };
            }
            data.topWebsites[this.session.domain].time += minutes;

            // Update total time
            data.totalTime += minutes;

            // Save
            await chrome.storage.local.set({ activityData: data });

            // Reset session time (keep tracking)
            this.session.timeSpent = 0;

        } catch (e) {
            console.error('[GL Tracker] Save error:', e);
        }
    },

    // Get week start date (Monday)
    getWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        return monday.toISOString().split('T')[0];
    },

    // Record content intervention (blur)
    recordIntervention() {
        chrome.storage.local.get('activityData', (result) => {
            const data = result.activityData || { contentInterventions: 0 };
            data.contentInterventions = (data.contentInterventions || 0) + 1;
            chrome.storage.local.set({ activityData: data });
        });
    }
};

// Export for use in content.js
window.ActivityTracker = ActivityTracker;

// Initialize
ActivityTracker.init();
