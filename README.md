# SkillForge AI — Setup Guide
## Adaptive Learning Platform with Local AI (Ollama)

---

## STEP 1 — Install Node.js (ONE TIME ONLY)

1. Open browser → go to: https://nodejs.org
2. Click "LTS" version (green button) → download
3. Run the downloaded installer → click Next, Next, Install
4. After install: open Command Prompt → type `node --version`
5. You should see something like: v20.x.x ✓

---

## STEP 2 — Install Ollama (ONE TIME ONLY, for AI features)

> Skip this step if you want fallback mode (static questions, no AI)

1. Open browser → go to: https://ollama.com/download
2. Click "Download for Windows" → run installer
3. After install, open Command Prompt and run:
   ```
   ollama pull llama3.2
   ```
4. Wait for download (~2GB) — this is the AI brain!
5. After download: `ollama serve` (keep this running)

---

## STEP 3 — Run SkillForge (EVERY TIME)

### Option A — Easy Way (Double-click)
1. Find `START.bat` in the skillforge folder
2. Double-click it
3. Wait for both servers to start
4. Browser opens automatically at http://localhost:5173

### Option B — Manual Way
Open TWO Command Prompt windows:

**Window 1 — Django Backend:**
```cmd
cd skillforge\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Window 2 — React Frontend:**
```cmd
cd skillforge\frontend
npm install
npm run dev
```

Then open: http://localhost:5173

---

## HOW IT WORKS

```
Topic Select → Quiz (5 questions per topic, AI-generated)
     ↓
Knowledge Graph (shows weak/strong topics visually)
     ↓
Project Recommendation (AI suggests project based on weak areas)
     ↓
Code Editor (write code → AI reviews in real-time)
```

---

## WITHOUT OLLAMA (Fallback Mode)

If Ollama is not installed, the app still works!
- Quiz uses pre-built quality questions
- Project recommendation uses smart templates
- Code review shows "Install Ollama for AI review"

---

## TROUBLESHOOTING

**"Django not found" error:**
```cmd
python -m pip install django djangorestframework django-cors-headers requests python-decouple
```

**"npm not found" error:**
→ Node.js not installed. Go to Step 1.

**Port 8000 already in use:**
```cmd
netstat -ano | findstr :8000
taskkill /PID <number> /F
```

**Ollama connection error:**
```cmd
ollama serve
```
(Run in a separate Command Prompt window)

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| AI | Ollama + llama3.2 (local, free) |
| Backend | Django 5 + Django REST Framework |
| Frontend | React 18 + Vite |
| Graph | React Flow |
| Editor | Monaco Editor (VS Code engine) |
| Database | SQLite (no setup needed) |
| State | Zustand |

---

Made with ❤️ — SkillForge AI
