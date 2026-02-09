// GuardianLens v11.1 - AI-Powered Content Protection
// Features: Local Regex + Gemini AI Verification + Deep Scanning
// Now respects the enabled/disabled toggle

'use strict';

console.log('🛡️ GL v11.1 - Deep Scan Active');

// ===== CONFIG =====
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ===== STATE =====
let enabled = true;
const done = new WeakSet(); // Elements already processed/blurred
const checked = new WeakSet(); // Elements checked by AI and found safe
const processing = new WeakSet(); // Elements currently being checked by AI

// Cache for AI results to avoid frequent API calls
const aiCache = new Map(); // "text" -> boolean (isSafe)

// ===== LOAD ENABLED STATE =====
chrome.storage.sync.get('guardianEnabled', (result) => {
    enabled = result.guardianEnabled !== false;
    console.log('[GL] Enabled:', enabled);
    if (enabled) scan();
});

// ===== LISTEN FOR TOGGLE =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggle') {
        enabled = message.enabled;
        console.log('[GL] Toggled:', enabled);

        if (!enabled) {
            // Remove all blur classes
            document.querySelectorAll('.gl-text-blur, .gl-analyzing').forEach(el => {
                el.classList.remove('gl-text-blur', 'gl-analyzing');
            });
        } else {
            // Re-scan
            done.clear && done.clear(); // WeakSet only has .add/.has, need to re-scan manually
            // We can't clear WeakSet, so we just trigger scan. 
            scan();
        }
    }

    if (message.type === 'getStats') {
        sendResponse({ blurred: document.querySelectorAll('.gl-text-blur').length });
    }

    return true;
});

// ===== PATTERNS =====

// 1. STRICT BAD (Block immediately, no questions asked)
const STRICT_BAD = [
    /porn/i,
    /nigger/i,
    /faggot/i,
    /pussy/i,
    /cock/i,
    /tits/i,
    /blowjob/i,
    /masturbat/i,
    /whore/i,
    /slut/i,
    /bitch/i,
    /prostitut/i,
    /fuck/i,
    /rape/i,
    /incest/i,
    /pedophile/i,
    /hentai/i,
    /xxx/i,
    /sex\s*video/i,
    /nude\s*pics/i
];

// 2. SUSPICIOUS (Block temporarily, check with AI)
// Words that are often bad but can be safe in context
const SUSPICIOUS = [
    /kill/i,
    /shoot/i,
    /murder/i,
    /dead/i,
    /die/i,
    /blood/i,
    /hurt/i,
    /suicide/i,
    /drug/i,
    /bomb/i,
    /gun/i,
    /weapon/i,
    /assault/i,
    /attack/i,
    /sex/i,
    /nude/i,
    /naked/i,
    /breast/i,
    /dick/i,
    /hate/i,
    /racist/i,
    /stupid/i,
    /idiot/i,
    /dumb/i,
    /ugly/i,
    /fat/i,
    /fight/i,
    /beat/i,
    /alcohol/i,
    /beer/i,
    /vodka/i
];

// ===== STYLES =====
const css = document.createElement('style');
css.textContent = `
    .gl-text-blur {
        filter: blur(12px) !important;
        opacity: 0.6 !important;
        background-color: #e0e0e0 !important;
        color: transparent !important;
        text-shadow: 0 0 10px rgba(0,0,0,0.5) !important;
        user-select: none !important;
        pointer-events: none !important;
        cursor: default !important;
    }
    .gl-analyzing {
        filter: blur(5px) !important;
        opacity: 0.8 !important;
        transition: filter 0.3s ease !important;
    }
    .gl-text-blur * {
        pointer-events: none !important;
        visibility: hidden !important; 
    }
    .gl-blur-container {
        position: relative !important;
        cursor: not-allowed !important;
    }
    .gl-blur-container::after {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(200, 200, 200, 0.2) !important;
        pointer-events: all !important;
        z-index: 9999 !important;
    }
`;
(document.head || document.documentElement).appendChild(css);

// ===== HELPER FUNCTIONS =====

function isStrictlyBad(text) {
    if (!text || text.length < 3) return false;
    const t = text.toLowerCase();
    return STRICT_BAD.some(p => p.test(t));
}

function isSuspicious(text) {
    if (!text || text.length < 3) return false;
    const t = text.toLowerCase();
    return SUSPICIOUS.some(p => p.test(t));
}

// ===== AI CHECKER =====
async function checkWithAI(text, element) {
    if (!text || text.length < 10) return;

    // Cache Check
    if (aiCache.has(text)) {
        if (aiCache.get(text)) {
            // SAFE
            unblurElement(element);
        } else {
            // UNSAFE
            blurElement(element, true);
        }
        return;
    }

    try {
        const prompt = `Classify this text for a child safety filter.
        Reply ONLY "SAFE" or "UNSAFE".
        
        Text: "${text.substring(0, 300)}"
        
        Rules:
        - UNSAFE: Sexual, Violence, Hate Speech, Self-Harm, Bullying, Drugs, Heavy Profanity.
        - SAFE: Educational, News (neutral), Medical, General conversation.
        
        Decision:`;

        const payload = {
            url: API_URL,
            options: {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        };

        chrome.runtime.sendMessage({ type: 'guardian_fetch', payload }, (response) => {
            if (response && response.ok && response.data) {
                const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const isSafe = answer.toUpperCase().includes('SAFE') && !answer.toUpperCase().includes('UNSAFE');

                aiCache.set(text, isSafe);

                if (isSafe) {
                    unblurElement(element);
                } else {
                    console.log(`[GL] AI Confirmed Block: "${text.substring(0, 20)}..."`);
                    blurElement(element, true);
                }
            } else {
                // If API fails, better be safe than sorry? Or fail open?
                // User said "not blocking some data", so maybe they prefer safety.
                // But generally fail-open is better for UX.
                // Let's Unblur on error.
                unblurElement(element);
            }
        });

    } catch (e) {
        console.error('[GL] AI Check Error:', e);
        unblurElement(element);
    }
}

// ===== DOM MANIPULATION =====

function blurElement(el, isStrict = false) {
    if (!el) return;

    // Skip big structural elements unless they are media
    const tag = (el.tagName || '').toLowerCase();
    if (!['img', 'video', 'iframe'].includes(tag)) {
        try {
            const r = el.getBoundingClientRect();
            // Allow blurring smaller containers
            if (r.width > 800 && r.height > 600) return;
        } catch (e) { }
    }

    if (['html', 'body', 'main', 'nav', 'header', 'footer'].includes(tag)) return;

    if (isStrict) {
        el.classList.remove('gl-analyzing');
        el.classList.add('gl-text-blur');
        done.add(el);
        if (el.parentElement) el.parentElement.classList.add('gl-blur-container');

        // Record Intervention
        if (window.ActivityTracker?.recordIntervention) {
            window.ActivityTracker.recordIntervention();
        }
    } else {
        el.classList.add('gl-analyzing');
        processing.add(el);
    }

    // Block clicks
    el.addEventListener('click', (e) => {
        if (el.classList.contains('gl-text-blur') || el.classList.contains('gl-analyzing')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}

function unblurElement(el) {
    if (!el) return;
    el.classList.remove('gl-text-blur', 'gl-analyzing');
    if (el.parentElement) {
        el.parentElement.classList.remove('gl-blur-container');
    }
    processing.delete(el);
    done.delete(el);
    checked.add(el); // Mark as checked/safe
}

// ===== FIND ELEMENTS =====

function processElement(el) {
    if (!el || done.has(el) || checked.has(el) || processing.has(el)) return;

    // Mark as temporarily checked to avoid infinite loops if we don't blur
    // If we find it bad later, we uncheck and blur
    checked.add(el);

    if (el.classList.contains('gl-text-blur')) return;

    const tag = el.tagName;

    // 1. Check Media
    if (['IMG', 'VIDEO', 'IFRAME'].includes(tag)) {
        const alt = el.getAttribute('alt') || el.getAttribute('title') || '';
        if (isStrictlyBad(alt)) {
            checked.delete(el);
            blurElement(el, true);
        } else if (isSuspicious(alt)) {
            checked.delete(el);
            checkWithAI(alt, el);
            blurElement(el, false);
        }
        return;
    }

    // 2. Check Text
    // Check leaf nodes (no children) or safe text tags
    // Added DIV scan for modern web apps
    if (['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'A', 'TD', 'TH', 'YT-FORMATTED-STRING'].includes(tag) || (tag === 'DIV' && el.children.length === 0)) {

        const text = el.innerText || el.textContent || '';
        if (text.length < 3) return;

        if (isStrictlyBad(text)) {
            // console.log('[GL] Strict Bad:', text.substring(0, 20));
            checked.delete(el);
            blurElement(el, true);
        } else if (isSuspicious(text)) {
            // console.log('[GL] Suspicious:', text.substring(0, 20));
            checked.delete(el);
            checkWithAI(text, el);
            blurElement(el, false);
        }
    }
}

// ===== SCANNING =====

function scan() {
    if (!enabled) return;

    // targeted scan including leaf divs
    const targets = document.querySelectorAll('p, span, h1, h2, h3, a, img, video, iframe, li, yt-formatted-string, div, h4, h5, h6');
    for (const el of targets) {
        processElement(el);
    }
}

// ===== MUTATION OBSERVER =====
const obs = new MutationObserver((mutations) => {
    if (!enabled) return;
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType === 1) { // Element
                processElement(node);

                // Deep scan children of new nodes
                const children = node.querySelectorAll ? node.querySelectorAll('p, span, h1, a, img, video, div, h4') : [];
                for (const child of children) {
                    processElement(child);
                }
            } else if (node.nodeType === 3) { // Text Node
                // Handle direct text injection (rare but happens)
                if (node.parentElement) processElement(node.parentElement);
            }
        }
    }
});

if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
}

// ===== TIMERS =====
setInterval(scan, 2000); // Periodic check for misses
setTimeout(scan, 500);
setTimeout(scan, 1500);

window.addEventListener('scroll', () => {
    if (window.scrollTimeout) clearTimeout(window.scrollTimeout);
    window.scrollTimeout = setTimeout(scan, 200);
}, { passive: true });
