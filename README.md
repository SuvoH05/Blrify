# 🔒 Blrify Extension  
*A Chrome extension to make social media safer by blurring harmful content before you see it.*  

---

## 🚀 Overview  
Blrify is a browser extension built for the **Gen AI Exchange Hackathon (H2S)**.  
It scans content in real time on platforms like **X (Twitter)** and **Instagram**, detects harmful or toxic language using **Google’s Perspective API**, and applies a **blur filter with an overlay** to protect users.  

Users can still **choose to reveal content** with a single click, ensuring safety without censorship.  

---

## ✨ Features  
- 🧠 **AI-Powered Filtering** – Uses Google Perspective API to detect toxicity, insults, threats, profanity, etc.  
- 👀 **Dynamic Content Scanning** – Works even when new posts load via infinite scroll (thanks to MutationObserver).  
- 🎭 **Blur & Overlay System** – Harmful posts are blurred with a clear warning + “Reveal” button.  
- ⚡ **Caching** – Avoids re-scanning the same text multiple times for efficiency.  
- 🔐 **Configurable API Key** – Secure API key management with `config.js` (ignored from GitHub).  

---

## 🛠️ Tech Stack  

| **Category**            | **Technology / Tool** |
|--------------------------|------------------------|
| Programming Language     | JavaScript (ES6+) |
| Frontend                 | HTML5, CSS3 |
| Browser Extension APIs   | Manifest v3, Content Scripts, Background Service Worker |
| DOM Utilities            | MutationObserver API, Custom Blur Utility (`blur.js`) |
| AI/ML Service            | Google Perspective API |
| Optimization             | Cache Layer (Map) |
| Project Setup & Security | `config.js` (API key), `.gitignore` |
| Version Control          | GitHub |

---

## 📂 Project Structure  

```

chrome-extension/
│── manifest.json          # Extension config
│── background.js          # Service worker (API requests)
│── content.js             # Scans page & applies blur
│── utils/
│    ├── blur.js           # Blur + overlay logic
│── config.js              # Local API key (ignored in GitHub)
│── config.example.js      # Example placeholder for collaborators

````

---

## ⚙️ Setup & Installation  

1. Clone this repo:  
   ```bash
   git clone https://github.com/your-username/Blrify-extension.git
   ```
2. Create a `config.js` in the root directory:

   
   const CONFIG = {
     PERSPECTIVE_API_KEY: "YOUR_API_KEY_HERE"
   };
   

3. Load the extension into Chrome:

   * Go to `chrome://extensions/`
   * Enable **Developer Mode**
   * Click **Load unpacked**
   * Select the project folder

4. Open **X (Twitter)** or **Instagram** → watch harmful posts auto-blur!

---

## 📸 Demo

*(Add screenshots or GIFs here of the blur in action.)*

---

## 🔮 Future Enhancements

* Hybrid detection (Perspective API + keyword-based rules)
* User-adjustable sensitivity levels
* Support for more platforms (Reddit, Facebook, YouTube comments)
* Analytics dashboard (track filtered content types)

---

## 🧑‍💻 Contributors

* \[Suvojoti Howlader]
* \[Team Member(s):Tanmoy Das, Subhajit De, Somita Roy, Sambaran Das]

