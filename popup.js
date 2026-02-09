// GuardianLens v10.6 - Production Popup
'use strict';

// Production API Key
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';

document.addEventListener('DOMContentLoaded', async () => {
    const enableToggle = document.getElementById('enableToggle');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusBadge = document.getElementById('statusBadge');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusMsg = document.getElementById('statusMsg');

    // Clear old sample data (one-time cleanup)
    const cleanup = await chrome.storage.local.get('dataCleared');
    if (!cleanup.dataCleared) {
        await chrome.storage.local.remove('activityData');
        await chrome.storage.local.set({ dataCleared: true });
        console.log('[GL] Cleared old sample data');
    }

    // Load settings
    async function loadSettings() {
        const sync = await chrome.storage.sync.get(['guardianEnabled']);

        const enabled = sync.guardianEnabled !== false;
        enableToggle.checked = enabled;
        updateStatusUI(enabled);
    }

    function updateStatusUI(enabled) {
        if (enabled) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Protected';
            statusText.className = 'status-text';
            statusBadge.style.background = 'rgba(0, 255, 136, 0.1)';
            statusBadge.style.borderColor = 'rgba(0, 255, 136, 0.3)';
        } else {
            statusDot.className = 'status-dot inactive';
            statusText.textContent = 'Disabled';
            statusText.className = 'status-text inactive';
            statusBadge.style.background = 'rgba(255, 68, 68, 0.1)';
            statusBadge.style.borderColor = 'rgba(255, 68, 68, 0.3)';
        }
    }

    // Toggle handler
    enableToggle.addEventListener('change', async () => {
        const enabled = enableToggle.checked;
        await chrome.storage.sync.set({ guardianEnabled: enabled });
        updateStatusUI(enabled);

        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'toggle', enabled });
            } catch (e) { }
        }
    });

    // Download Report
    downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        statusMsg.textContent = '⏳ Generating report...';
        statusMsg.className = 'status-msg loading';

        try {
            const local = await chrome.storage.local.get('activityData');
            const data = local.activityData || getDefaultData();

            const reportHtml = await generateReport(data);
            downloadHtml(reportHtml);

            statusMsg.textContent = '✅ Report downloaded!';
            statusMsg.className = 'status-msg success';
        } catch (error) {
            console.error('[GL] Report error:', error);
            statusMsg.textContent = '❌ ' + (error.message || 'Generation failed');
            statusMsg.className = 'status-msg error';
        }

        setTimeout(() => {
            downloadBtn.disabled = false;
            statusMsg.textContent = '';
        }, 3000);
    });

    // Default data structure if no activity yet
    function getDefaultData() {
        const today = new Date().toISOString().split('T')[0];
        return {
            weekStart: today,
            totalTime: 0,
            contentInterventions: 0,
            dailyBreakdown: {},
            categoryTime: {},
            topWebsites: {}
        };
    }

    // Generate Report with AI
    async function generateReport(data) {
        // Always calculate fresh week dates
        const weekStartStr = getWeekStartDate();
        const weekEndStr = getWeekEndDate();
        const weekStart = formatDate(weekStartStr);
        const weekEnd = formatDate(weekEndStr);

        console.log('[GL] Week range:', weekStartStr, 'to', weekEndStr);
        console.log('[GL] Formatted:', weekStart, 'to', weekEnd);

        const prompt = buildPrompt(data, weekStart, weekEnd);

        console.log('[GL] Calling Gemini API...');

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
                })
            });

            console.log('[GL] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[GL] API Error:', errorText);
                throw new Error('API failed: ' + response.status);
            }

            const result = await response.json();
            console.log('[GL] Got result:', result);

            let html = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            html = html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

            if (!html) {
                throw new Error('Empty response from API');
            }

            return html;
        } catch (err) {
            console.error('[GL] Fetch error:', err);
            throw err;
        }
    }

    function buildPrompt(data, weekStart, weekEnd) {
        const totalTime = data.totalTime || 0;
        const totalHours = Math.floor(totalTime / 60);
        const totalMins = totalTime % 60;
        const interventions = data.contentInterventions || 0;
        const categories = data.categoryTime || {};
        const dailyBreakdown = data.dailyBreakdown || {};

        const sites = Object.entries(data.topWebsites || {})
            .sort((a, b) => b[1].time - a[1].time)
            .slice(0, 10)
            .map(([domain, info]) => ({
                domain: domain.replace('www.', ''),
                minutes: info.time,
                category: info.category
            }));

        const catTotal = Object.values(categories).reduce((a, b) => a + b, 0) || 1;
        const catPercents = {};
        for (const [cat, time] of Object.entries(categories)) {
            catPercents[cat] = Math.round((time / catTotal) * 100);
        }

        return `Generate a PRODUCTION-QUALITY HTML weekly parent report email.

=== DATA ===
REPORT PERIOD: ${weekStart} to ${weekEnd}
TOTAL SCREEN TIME: ${totalHours}h ${totalMins}m (${totalTime} minutes)
CONTENT BLOCKED: ${interventions} items

DAILY USAGE:
${Object.entries(dailyBreakdown).map(([date, mins]) => `${date}: ${mins}m`).join(', ') || 'No data yet'}

CATEGORIES:
${Object.entries(categories).map(([cat, mins]) => `${cat}: ${mins}m (${catPercents[cat]}%)`).join(', ') || 'No data yet'}

TOP SITES:
${sites.map((s, i) => `${i + 1}. ${s.domain} (${s.minutes}m, ${s.category})`).join(', ') || 'No data yet'}

=== REQUIREMENTS ===
Create a beautiful, professional HTML email report with:

1. HEADER - GuardianLens branding with 🛡️, dates
2. SUMMARY - Quick overview cards (time, blocked, sites)
3. DAILY CHART - Visual bar representation of daily usage
4. CATEGORIES - Colored breakdown with percentages
5. TOP SITES - Table with icons and time
6. SAFETY - Positive framing of blocked content
7. INSIGHTS - AI observations about browsing habits
8. TIPS - 2 parent recommendations
9. FOOTER - Branding

DESIGN:
- Max 600px width, email-compatible inline CSS
- Colors: #4A90E2 (blue), #27AE60 (green), #7B2CBF (purple)
- Modern cards, rounded corners, clean typography
- Visual charts using CSS only

Return ONLY HTML starting with <!DOCTYPE html>.`;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getWeekStartDate() {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        // Use local date format instead of ISO
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }

    function getWeekEndDate() {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? 0 : 7 - day; // Sunday
        const sunday = new Date(now);
        sunday.setDate(now.getDate() + diff);
        // Use local date format instead of ISO
        return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    }

    function downloadHtml(html) {
        let fullHtml = html;
        if (!html.includes('<!DOCTYPE')) {
            fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Weekly Report</title></head><body style="margin:0;padding:20px;background:#f5f5f5;font-family:system-ui,sans-serif;">${html}</body></html>`;
        }

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GuardianLens-Report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    await loadSettings();
});
