from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import sys
import os
import io
import logging
import uuid
import time

# Ensure we can import from the existing project structure
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from placement_tracker.storage import sheets_client

# In-memory store for the OAuth refresh token pushed by the frontend after login.
# Falls back to GOOGLE_REFRESH_TOKEN env var if never set at runtime.
_runtime_refresh_token: str | None = None

# Background job tracker for long-running tasks like CTC enrichment.
# {job_id: {"status": "running"|"done"|"error", "result": ..., "started_at": float}}
_jobs: dict[str, dict] = {}

router = APIRouter()

# --- Simple manual caching for MVP ---
import time
CACHE_TTL = 300 # 5 minutes

class SimpleCache:
    def __init__(self):
        self.cache = {}
        self.timestamps = {}

    def get(self, key):
        if key in self.cache and time.time() - self.timestamps.get(key, 0) < CACHE_TTL:
            return self.cache[key]
        return None

    def set(self, key, value):
        self.cache[key] = value
        self.timestamps[key] = time.time()

data_cache = SimpleCache()

@router.get("/calendar")
def get_calendar():
    cached = data_cache.get("calendar")
    if cached is not None:
        return {"data": cached}
        
    try:
        df = sheets_client.read_calendar()
        if df.empty:
            return {"data": []}
        data = df.fillna("").to_dict(orient="records")
        data_cache.set("calendar", data)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/offers")
def get_offers():
    cached = data_cache.get("offers")
    if cached is not None:
        return {"data": cached}
        
    try:
        df = sheets_client.read_offers()
        if df.empty:
            return {"data": []}
        data = df.fillna("").to_dict(orient="records")
        data_cache.set("offers", data)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/applications/{student_id}")
def get_applications(student_id: str):
    # Personal data, caching might be tricky if it updates often, but 5 mins is okay
    cache_key = f"apps_{student_id}"
    cached = data_cache.get(cache_key)
    if cached is not None:
        return {"data": cached}
        
    try:
        df = sheets_client.read_applications(student_id)
        if df.empty:
            return {"data": []}
        data = df.fillna("").to_dict(orient="records")
        data_cache.set(cache_key, data)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_analytics():
    cached = data_cache.get("analytics")
    if cached is not None:
        return cached

    try:
        df_offers = sheets_client.read_offers()
        cohort_stats = sheets_client.get_cohort_stats()
        
        # Base case
        if df_offers.empty:
            return {
                "overall": {
                    "total_offers": 0, "companies_hiring": 0, "total_students": sum(cohort_stats.values()),
                    "placed_students": 0, "placement_rate": 0, "top_branch": "N/A"
                },
                "branch_data": []
            }
        # Fetch the pre-calculated stats directly from the sheet
        sheet_analytics = sheets_client.get_branch_analytics()
        overall = sheet_analytics.get("overall", {})
        branch_data = sheet_analytics.get("branch_data", [])
        
        # Merge in the metrics that aren't in the sheet
        if 'branch' in df_offers.columns:
            df_offers['branch_norm'] = df_offers['branch'].astype(str).str.strip().str.upper()
        else:
            df_offers['branch_norm'] = "N/A"
            
        full_names = {
            "EVE": "Electronics & VLSI Engineering",
            "CSAI": "CS & Artificial Intelligence",
            "CSB": "CS & Biosciences",
            "CSE": "Computer Science & Engineering",
            "ECE": "Electronics & Communication",
            "CSSS": "CS & Social Sciences",
            "CSD": "CS & Design",
            "CSAM": "CS & Applied Mathematics"
        }
            
        for b_dict in branch_data:
            b_name = b_dict['branch'].upper()
            b_offers = df_offers[df_offers['branch_norm'] == b_name]
            
            b_dict['offers_count'] = len(b_offers)
            b_dict['intern_only'] = len(b_offers[b_offers['offer_type'].str.lower() == 'intern']) if 'offer_type' in b_offers.columns else 0
            b_dict['firms'] = b_offers['company_name'].nunique() if not b_offers.empty and 'company_name' in b_offers.columns else 0
            b_dict['full_name'] = full_names.get(b_name, b_dict['branch'])
            
        # Sort branch data
        branch_data.sort(key=lambda x: x.get('placement_rate', 0), reverse=True)
        
        # Overall stats completion
        overall["total_offers"] = len(df_offers)
        overall["companies_hiring"] = int(df_offers["company_name"].nunique()) if "company_name" in df_offers.columns else 0
        
        top_branch_str = "N/A"
        if branch_data:
            top_branch_str = f"{branch_data[0]['branch']} ({branch_data[0]['placement_rate']}%)"
        overall["top_branch"] = top_branch_str
            
        result = {
            "overall": overall,
            "branch_data": branch_data
        }
        
        data_cache.set("analytics", result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str
    student_id: str

@router.post("/chat")
def chat_copilot(request: ChatRequest):
    from ai.router import route_query, generate_copilot_response
    
    intent_info = route_query(request.message)
    
    if intent_info["intent"] == "DATA_QUERY":
        # Handle deterministic query (MVP: just return a canned response instructing to use the analytics tab)
        return {
            "reply": "I see you're looking for specific company data! Please check the Analytics and Global Offers tabs for real-time filtered data.",
            "sources": []
        }
    
    # Handle REASONING intent
    # Assemble context
    app_data = get_applications(request.student_id).get("data", [])
    cal_data = get_calendar().get("data", [])
    
    context = {}
    context["my_applications"] = app_data
    context["calendar_events"] = _get_filtered_upcoming_events(cal_data, app_data)[:10]
    
    # Call Gemini
    reply = generate_copilot_response(request.message, context)
    
    return {
        "reply": reply,
        "sources": ["Calendar", "Applications"]
    }

def _get_filtered_upcoming_events(cal_data, app_data):
    if not cal_data:
        return []
        
    import re
    import pandas as pd
    def norm(name): return re.sub(r'[^a-z0-9]', '', str(name).lower())
    
    my_companies = set()
    ineligible_companies = set()
    
    for app in app_data:
        c_name = norm(app.get("company_name", ""))
        if not c_name or len(c_name) < 2:
            continue
        status = str(app.get("status", "")).strip().lower()
        if "not eligible" in status or "not-eligible" in status:
            ineligible_companies.add(c_name)
        else:
            my_companies.add(c_name)

    upcoming_events = []
    date_col = next((k for k in cal_data[0].keys() if "date" in str(k).lower()), None)
    comp_col = next((k for k in cal_data[0].keys() if "company" in str(k).lower()), None)
    
    today = pd.Timestamp.now().normalize()
    
    for row in cal_data:
        comp_name = norm(row.get(comp_col, "")) if comp_col else ""
        
        # If user has synced apps, ONLY show companies they've applied to/are eligible for
        if app_data and comp_name:
            is_match = False
            for mc in my_companies:
                if mc in comp_name or comp_name in mc:
                    is_match = True
                    break
            if not is_match or comp_name in ineligible_companies:
                continue
                
        # Skip purely ineligible if app_data was somehow empty but we had ineligible
        if comp_name and comp_name in ineligible_companies:
            continue
            
        if date_col:
            try:
                event_date = pd.to_datetime(row.get(date_col, ""), dayfirst=True)
                if event_date >= today:
                    upcoming_events.append(row)
            except Exception:
                upcoming_events.append(row)
        else:
            upcoming_events.append(row)
            
    return upcoming_events

@router.get("/daily-brief/{student_id}")
def get_daily_brief(student_id: str):
    cache_key = f"daily_brief_{student_id}"
    cached = data_cache.get(cache_key)
    if cached is not None:
        return {"brief": cached}
        
    from ai.router import generate_copilot_response
    
    # Gather Context
    cal_data = get_calendar().get("data", [])
    app_data = get_applications(student_id).get("data", [])
    
    upcoming_events = _get_filtered_upcoming_events(cal_data, app_data)
    
    try:
        import json
        with open(os.path.join(os.path.dirname(__file__), "../data/company_kb.json"), "r") as f:
            kb = json.load(f)
    except Exception:
        kb = {}
        
    context = {
        "calendar_upcoming_7_days": upcoming_events[:15],
        "my_active_applications": app_data,
        "company_knowledge_base": kb
    }
    
    prompt = """
    You are an AI Placement Copilot. Your job is to analyze the student's calendar and applications.
    
    1. Find the SINGLE most immediate upcoming event (Test or Interview) in the next 7 days. This MUST be the "next_action".
    2. Generate a "study_plan" and "checklist" of 4-5 tasks specifically tailored to prepare for this exact event and company.
    
    CRITICAL: The study plan and checklist MUST be highly specific and technical, not generic. 
    DO NOT use generic terms like "DSA", "DBMS", "OS", "OOPS".
    INSTEAD use specific topics like "Dynamic Programming on Trees", "OS Paging & Virtual Memory", "SQL Window Functions", "Sliding Window on Arrays", "Implement LRU Cache".
    
    Output strictly as a JSON object with no markdown wrappers, matching this exact structure:
    {
        "next_action": {
            "company": "[Company Name]",
            "title": "[e.g. Test 1 or HR Interview]",
            "time_location": "[e.g. 7:00 PM • Any Location]",
            "countdown": "[e.g. 05h : 32m left, or 2 Days left]",
            "tag": "[e.g. TODAY, TOMORROW, UPCOMING]"
        },
        "progress": {
            "completed": 0,
            "total": 5,
            "percentage": 0,
            "checklist": [
                {"task": "[Specific technical task, e.g., Practice DP on Grids]", "done": false},
                {"task": "[Specific technical task, e.g., Revise ACID properties]", "done": false},
                {"task": "[Specific technical task]", "done": false}
            ]
        },
        "study_plan": {
            "focus": "[Specific technical focus, e.g. Graph Algorithms & SQL]",
            "recommended_time": "[e.g. 2h 30m of focused study]",
            "next_topic": "[Specific next topic, e.g. Dijkstra's Algorithm]"
        },
        "things_to_carry": ["Photo ID", "Pens", "Resume"]
    }
    
    Ensure the JSON is completely valid. If no events are upcoming, provide a highly specific general interview prep plan focusing on advanced topics.
    """
    
    raw_brief = generate_copilot_response(prompt, context)
    
    # Try to parse the JSON
    import json
    try:
        # Strip potential markdown code blocks
        clean_json = raw_brief.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
            
        structured_brief = json.loads(clean_json.strip())
    except Exception as e:
        logging.error(f"Failed to parse daily brief JSON: {e}")
        # Fallback dummy data if parsing fails
        if upcoming_events:
            next_ev = upcoming_events[0]
            comp = next((v for k, v in next_ev.items() if "company" in str(k).lower()), "Upcoming Company")
            date = next((v for k, v in next_ev.items() if "date" in str(k).lower()), "Upcoming")
            title = next((v for k, v in next_ev.items() if "event" in str(k).lower() or "title" in str(k).lower()), "Selection Process")
            
            structured_brief = {
                "next_action": {"company": str(comp), "title": str(title), "time_location": str(date), "countdown": "Upcoming", "tag": "UPCOMING"},
                "progress": {"completed": 0, "total": 3, "percentage": 0, "checklist": [{"task": f"Solve Top 50 Leetcode for {comp}", "done": False}, {"task": "Revise OS Virtual Memory Concepts", "done": False}, {"task": "Practice System Design: URL Shortener", "done": False}]},
                "study_plan": {"focus": f"Advanced Prep for {comp}", "recommended_time": "2 hours daily", "next_topic": "Dynamic Programming: Knapsack"},
                "things_to_carry": ["Laptop", "Notebook", "Pen"]
            }
        else:
            structured_brief = {
                "next_action": {"company": "Placement Prep", "title": "Self Study", "time_location": "Anytime", "countdown": "Continuous", "tag": "ONGOING"},
                "progress": {"completed": 1, "total": 4, "percentage": 25, "checklist": [{"task": "Solve 3 Hard Graph Problems", "done": True}, {"task": "Implement LRU Cache in Python", "done": False}, {"task": "Revise SQL Window Functions", "done": False}, {"task": "Mock Interview: System Design", "done": False}]},
                "study_plan": {"focus": "Backend Engineering Prep", "recommended_time": "2 hours daily", "next_topic": "Distributed Systems basics"},
                "things_to_carry": ["Laptop", "Notebook", "Water"]
            }

    data_cache.set(cache_key, structured_brief)
    return {"brief": structured_brief}

@router.get("/company/{company_name}")
def get_company_info(company_name: str):
    try:
        import json
        with open(os.path.join(os.path.dirname(__file__), "../data/company_kb.json"), "r") as f:
            kb = json.load(f)
            
        # Case insensitive search
        for key in kb:
            if key.lower() == company_name.lower():
                return {"data": kb[key]}
        return {"data": None, "message": "Company not found in KB."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-calendar")
def sync_calendar():
    try:
        res = sheets_client.sync_college_calendar()
        data_cache.cache.clear()  # Calendar updated, invalidate cache
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/store-refresh-token")
def store_refresh_token(req: RefreshTokenRequest):
    """Called by the frontend after OAuth login to give the backend a refresh token.
    This lets the cron watcher perform calendar sync without a user session."""
    global _runtime_refresh_token
    _runtime_refresh_token = req.refresh_token.strip()
    # Also inject into environment so auth.py picks it up immediately
    os.environ["GOOGLE_REFRESH_TOKEN"] = _runtime_refresh_token
    logging.info("[AUTH] Runtime refresh token updated from frontend login.")
    return {"success": True}

class SyncAppRequest(BaseModel):
    pod_ai_username: str
    pod_ai_password: str
    student_name: str
    student_id: str

@router.post("/sync-applications")
def sync_applications(req: SyncAppRequest):
    from placement_tracker.pipeline import orchestrator
    try:
        res = orchestrator.sync_job_applications(
            pod_ai_username=req.pod_ai_username,
            pod_ai_password=req.pod_ai_password,
            student_name=req.student_name,
            student_id=req.student_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-email-offers")
def sync_email_offers():
    """Syncs offer letters from Gmail only (lightweight, no Playwright)."""
    from placement_tracker.pipeline import orchestrator
    try:
        res = orchestrator.sync_offer_letters()
        data_cache.cache.clear()  # Invalidate cache so dashboard refreshes
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-ctc-enrichment")
def sync_ctc_enrichment(background_tasks: BackgroundTasks):
    """Kicks off a background pod.ai scrape for CTC enrichment. Returns immediately with a job_id."""
    from placement_tracker.config import POD_AI_USERNAME, POD_AI_PASSWORD
    if not POD_AI_USERNAME or not POD_AI_PASSWORD:
        raise HTTPException(status_code=400, detail="Pod.ai credentials not configured.")

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "result": None, "started_at": time.time()}

    def _run(jid: str):
        from placement_tracker.pipeline import orchestrator
        try:
            res = orchestrator.sync_global_opportunities(POD_AI_USERNAME, POD_AI_PASSWORD)
            data_cache.cache.clear()
            _jobs[jid] = {"status": "done", "result": res, "started_at": _jobs[jid]["started_at"]}
            logging.info(f"[CTC] Background job {jid} complete: {res.get('portal_records', 0)} records.")
        except Exception as e:
            _jobs[jid] = {"status": "error", "result": {"error": str(e)}, "started_at": _jobs[jid]["started_at"]}
            logging.error(f"[CTC] Background job {jid} failed: {e}")

    background_tasks.add_task(_run, job_id)
    return {"job_id": job_id, "status": "running", "message": "CTC enrichment started in background. Poll /sync-ctc-enrichment/status?job_id={job_id} for result."}

@router.get("/sync-ctc-enrichment/status")
def sync_ctc_enrichment_status(job_id: str):
    """Poll the status of a background CTC enrichment job."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = _jobs[job_id]
    elapsed = round(time.time() - job["started_at"])
    return {"job_id": job_id, "status": job["status"], "elapsed_seconds": elapsed, "result": job["result"]}

@router.post("/clear-offers")
def clear_offers():
    from placement_tracker.storage import sheets_client
    try:
        return sheets_client.clear_all_offers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommend-companies")
async def recommend_companies(resume: UploadFile = File(...)):
    """Accepts a PDF resume upload, extracts text, and returns AI-powered company recommendations."""
    from ai.router import generate_resume_recommendation

    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        import pypdf
        contents = await resume.read()
        reader = pypdf.PdfReader(io.BytesIO(contents))
        resume_text = "\n".join(
            page.extract_text() for page in reader.pages if page.extract_text()
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    if not resume_text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the PDF. Please ensure it's not a scanned image.")

    # Get active companies from calendar cache
    try:
        cal_data = get_calendar().get("data", [])
        active_companies = [
            {"company": row.get("Company", row.get("company", "")), "ctc": row.get("CTC", "N/A")}
            for row in cal_data if row.get("Company") or row.get("company")
        ]
    except Exception:
        active_companies = []

    recommendation = generate_resume_recommendation(resume_text, active_companies)
    return {"recommendation": recommendation}
