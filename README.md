# GaurdianLens
Privacy-first AI safety browser extension using Gemini 3

# GuardianLens – AI Safety for Student Browsing

GuardianLens is a **privacy-first, real-time AI safety browser extension** built during the **Google DeepMind Gemini 3 Hackathon**.  
It protects students and children from accidental exposure to inappropriate online content while keeping educational browsing uninterrupted.

Unlike traditional parental controls that block entire websites or aggressively monitor activity, GuardianLens selectively blurs only unsafe content using AI-powered context understanding.

---

## 🌟 Inspiration

The idea for GuardianLens came from a real incident. One day, my niece was watching a cartoon-style video on an iPad. The video itself was harmless, but the comments section was filled with vulgar language and inappropriate content. This was shocking and raised an important question: *how often are children exposed to harmful content accidentally, without searching for it?*

GuardianLens was created to solve this exact problem — protecting students from harmful exposure **without breaking learning or violating privacy**.

---

## 🚀 What GuardianLens Does

- Runs directly inside the browser as a Chrome extension
- Analyzes **on-screen content** (text + images + context)
- Selectively blurs:
  - Explicit or vulgar images
  - Inappropriate ads
  - Pornographic or gambling-related content
  - Hateful or abusive comments
- **Never blocks educational or student-related content**
- Generates a **weekly parent-friendly report** summarizing screen time and learning trends
- Stores **no browsing history, screenshots, or personal data**

---

## 🧠 How It Works

1. A content script scans visible web page elements in real time  
2. An AI agent evaluates whether the content is appropriate for students  
3. Unsafe sections are softly blurred instead of blocking the entire page  
4. Activity data is aggregated locally (time and category only)  
5. Gemini 3 is used to generate weekly insight reports from aggregated data  

📌 All decisions prioritize **accuracy, speed, and privacy**.

---

## 🔐 Privacy by Design

GuardianLens is built with privacy as a core principle:

- No browsing history stored  
- No screenshots captured  
- No user profiling  
- No data selling or third-party tracking  
- AI analysis is temporary and context-based  

GuardianLens protects users **without spying on them**.

---

## 📊 Weekly Report

Parents can generate a weekly report that includes:
- Total screen time
- Learning vs entertainment balance
- Safety interventions
- Positive learning trends

Reports are generated using **Gemini 3** based only on aggregated local data.

---

## 🛠️ Tech Stack

- Chrome Extension (Manifest V3)
- JavaScript
- Antigravity Framework
- Google Gemini 3 API
- Chrome Storage API

---

## 🧪 Installation (Developer Mode)

1. Clone or download this repository
2. add your GEMINI_API_KEY = "YOUR_REAL_API_KEY"; (content/popup)
3. Open Chrome and go to `chrome://extensions`  
4. Enable **Developer Mode**  
5. Click **Load unpacked**  
6. Select the project folder containing `manifest.json`  

The extension will start running immediately.

---

## 🎥 Demo Video

📺 Demo Video: https://vimeo.com/1163383126?share=copy&fl=sv&fe=ci

---

## 🏆 Hackathon Note

GuardianLens is a fully functional prototype built during the **Gemini 3 Hackathon**.  
It demonstrates how AI can be used responsibly to improve online safety for students while preserving privacy and freedom to learn.

---

## 🔮 What’s Next

- Expand to a full-fledged platform
- Improve AI accuracy and performance
- Support schools, universities, and corporate environments
- Add multi-platform browser support

---

## 📄 License

This project is released under the MIT License.

