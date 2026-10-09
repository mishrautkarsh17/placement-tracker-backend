# AI Placement Tracker - Frontend

This is the Streamlit-based frontend for the AI Placement Tracker. It connects to the FastAPI backend to provide students with a unified dashboard to track their placements, view analytics, and get AI-powered insights.

## Features

- **AI Placement Copilot**: Get a daily brief of upcoming tests/interviews and chat with an AI assistant regarding placement preparation.
- **AI Resume Matcher**: Upload your resume to find the best company matches from the active hiring list.
- **Campus Calendar**: Syncs and displays upcoming PPTs, tests, and interviews based on the companies you are eligible for or have applied to.
- **Analytics Dashboard**: View overall batch placement metrics, branch-wise performance comparisons, and raw offer data.
- **Company Hub & Applications**: 
  - Search for historical placement patterns (e.g. OA patterns, interview rounds) for specific companies.
  - View all your synced applications from the placement portal (pod.ai) automatically categorized by status (Eligible, Not Eligible, Applied).

## Setup & Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configuration**:
   - The application looks for `API_URL` to connect to the backend. By default, it expects the backend to be running on `http://localhost:8000/api`.
   - Setup OAuth and other secrets by configuring `.streamlit/secrets.toml`.

## Running the Application

To start the Streamlit frontend locally, run:

```bash
streamlit run app.py
```

The application will be accessible in your web browser at `http://localhost:8501`.
