# AI Placement Tracker - Backend

This is the FastAPI backend for the AI Placement Tracker and Copilot system. It serves the frontend Streamlit application, providing endpoints for placement tracking, LLM-based insights, and automated data synchronization.

## Key Features
- **FastAPI Application**: A robust backend providing REST endpoints.
- **Automated Cron Watcher (`cron_watcher.py`)**: Runs in the background (as a thread on startup) to sync placement offers from emails, track Google Calendar events, and enrich CTC data by scraping `pod.ai`.
- **LLM Client (`llm_client.py`)**: Connects to Google's Gemini models with a round-robin API key fallback system to gracefully handle rate limits and quotas.
- **Placement Portal Scraper (`portal_scraper.py`)**: Uses Playwright to navigate React-heavy portals (like pod.ai) and extract unstructured application and CTC data, handling dynamic scrolling and rendering.
- **Google Sheets & Drive Integration**: Synchronizes events with a central college calendar via Google Sheets.

## Prerequisites
- Python 3.9+
- Playwright (for portal scraping)

## Setup

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   *(Ensure you run `playwright install` if this is your first time using Playwright)*

2. **Environment Variables**
   Create a `.env` file or export the following variables:
   - `GEMINI_API_KEY`: Comma-separated list of Gemini API keys for round-robin usage.
   - `GOOGLE_SHEET_ID`: ID of the Google Sheet for the college calendar.
   - `POD_AI_USERNAME` / `POD_AI_PASSWORD`: Credentials for portal scraping.
   - Any required Google OAuth credentials for Drive/Sheets access.

## Running the Server

You can run the backend server using Uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Alternatively, just run the main script which will start the server and the background cron thread:
```bash
python main.py
```

The API documentation will be available at `http://localhost:8000/docs`.
