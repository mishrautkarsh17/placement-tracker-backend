import streamlit as st
import pandas as pd
import altair as alt
from datetime import datetime
import requests

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from config import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
    POD_AI_USERNAME, POD_AI_PASSWORD, get_secret
)
from auth import get_user_profile, get_oauth_url, exchange_code_for_token, get_user_credentials

API_URL = get_secret("API_URL", default="http://localhost:8000/api")

# --- CACHED DATA FETCHERS ---
# This prevents the app from re-fetching from the network on every button click
@st.cache_data(ttl=300, show_spinner=False)
def fetch_daily_brief(roll_no):
    try:
        res = requests.get(f"{API_URL}/daily-brief/{roll_no}")
        return res.json().get("brief", "Could not generate brief.")
    except Exception as e:
        return f"Failed to load daily brief: {e}"

@st.cache_data(ttl=300, show_spinner=False)
def fetch_calendar():
    try:
        req = requests.get(f"{API_URL}/calendar")
        return pd.DataFrame(req.json().get("data", []))
    except Exception as e:
        st.error(f"Failed to fetch calendar from API: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=300, show_spinner=False)
def fetch_analytics():
    try:
        req = requests.get(f"{API_URL}/analytics")
        return req.json()
    except Exception as e:
        st.error(f"Failed to fetch analytics from API: {e}")
        return {}

@st.cache_data(ttl=300, show_spinner=False)
def fetch_offers():
    try:
        req = requests.get(f"{API_URL}/offers")
        return pd.DataFrame(req.json().get("data", []))
    except Exception as e:
        st.error(f"Failed to fetch offers from API: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=300, show_spinner=False)
def fetch_applications(roll_no):
    try:
        req = requests.get(f"{API_URL}/applications/{roll_no}")
        return pd.DataFrame(req.json().get("data", []))
    except Exception as e:
        st.error(f"Failed to fetch applications from API: {e}")
        return pd.DataFrame()


# --- PAGE CONFIG ---
st.set_page_config(page_title="AI Placement Tracker", page_icon="", layout="wide")

# --- CUSTOM CSS ---
st.markdown("""
<style>
    /* Premium Minimalist Font */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    /* Background & Main App */
    .stApp {
        background-color: #09090b; /* Solid zinc-950 */
    }

    /* Clean up the top padding and header */
    .block-container {
        padding-top: 2rem !important;
        max-width: 1200px;
    }
    
    /* Clean Solid Metric Cards */
    [data-testid="stMetric"] {
        background: #18181b; /* Solid zinc-900 */
        border-radius: 8px;
        padding: 1.5rem;
        border: 1px solid #27272a; /* Solid zinc-800 */
        transition: border-color 0.2s ease;
    }
    [data-testid="stMetric"]:hover {
        border-color: #3f3f46;
    }

    [data-testid="stMetricLabel"] {
        color: #a1a1aa !important;
        font-weight: 500 !important;
        font-size: 0.95rem !important;
    }
    [data-testid="stMetricValue"] {
        color: #fafafa !important;
        font-weight: 600 !important;
        font-size: 2rem !important;
    }
    
    /* Clean Primary Buttons */
    .stButton > button {
        background: #fafafa;
        color: #09090b;
        border: none;
        border-radius: 6px;
        padding: 0.5rem 1.5rem;
        font-weight: 500;
        transition: background 0.2s ease;
    }
    .stButton > button:hover {
        background: #e4e4e7;
        color: #09090b;
    }
    
    /* Expander Styling */
    .streamlit-expanderHeader {
        background: #18181b !important;
        border-radius: 8px !important;
        font-weight: 500;
        border: 1px solid #27272a !important;
        color: #fafafa !important;
    }
    [data-testid="stExpander"] {
        border: none !important;
        background: transparent !important;
    }
    
    /* Modern Chat Interface */
    [data-testid="stChatMessage"] {
        background: #18181b;
        border-radius: 8px;
        padding: 1.2rem;
        margin-bottom: 1rem;
        border: 1px solid #27272a;
    }
    /* Distinguish Assistant vs User */
    [data-testid="stChatMessage"]:nth-child(even) {
        border-left: 3px solid #fafafa;
    }
    [data-testid="stChatMessage"]:nth-child(odd) {
        border-left: 3px solid #71717a;
    }
    
    /* Chat Input Box */
    [data-testid="stChatInput"] {
        border-radius: 8px !important;
        border: 1px solid #27272a !important;
        background: #18181b !important;
    }
    [data-testid="stChatInput"]:focus-within {
        border-color: #fafafa !important;
    }
    
    /* Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: transparent;
        border-bottom: 1px solid #27272a;
    }
    .stTabs [data-baseweb="tab"] {
        background-color: transparent;
        padding-top: 1rem;
        padding-bottom: 1rem;
        font-weight: 500;
        color: #a1a1aa;
    }
    .stTabs [aria-selected="true"] {
        color: #fafafa;
        border-bottom: 2px solid #fafafa;
    }
    
    /* Dataframe styling */
    [data-testid="stDataFrame"] {
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #27272a;
    }
    
    /* Headers Typography */
    h1, h2, h3 {
        color: #fafafa;
        font-weight: 600;
        letter-spacing: -0.02em;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #09090b;
        border-right: 1px solid #27272a;
    }
</style>
""", unsafe_allow_html=True)


# --- USER PROFILE ---
if 'roll_no' not in st.session_state or 'name' not in st.session_state:
    st.title(" Welcome to Placement Tracker")
    st.write("Please authenticate with your IIITD Google account to securely load your dashboard.")

    # Check for OAuth callback code in URL
    if "code" in st.query_params:
        with st.spinner("Authenticating..."):
            if exchange_code_for_token(st.query_params["code"]):
                st.query_params.clear()
                # After exchange, fall through to show the confirm screen
            else:
                st.error("Authentication failed. Please try again.")

    # Check if we have a cached token
    creds = get_user_credentials()
    if creds and creds.valid:
        # Fetch profile to show WHO is cached  don't auto-login silently
        profile = get_user_profile()
        if profile:
            cached_email = profile.get("email", "")
            cached_name = profile.get("name", "")

            # Only auto-accept if it's an IIITD account
            is_iiitd = cached_email.endswith("@iiitd.ac.in")

            st.success(f" Google account detected: **{cached_name}** ({cached_email})")

            col_confirm, col_switch = st.columns(2)
            with col_confirm:
                if st.button(" Continue as this account", use_container_width=True, type="primary"):
                    roll_no = "".join(filter(str.isdigit, cached_email))
                    st.session_state['name'] = cached_name
                    st.session_state['roll_no'] = roll_no
                    st.rerun()
            with col_switch:
                if st.button(" Switch Account", use_container_width=True):
                    # Delete the cached token so next login goes through Google account chooser
                    import os
                    if os.path.exists("user_token.json"):
                        os.remove("user_token.json")
                    st.rerun()
        else:
            st.error("Could not fetch profile information. Please try logging in again.")
            import os
            if os.path.exists("user_token.json"):
                os.remove("user_token.json")
    else:
        # No cached credentials  show the Google login button

        st.link_button("Login with Google", get_oauth_url(), type="primary")

    st.stop()

name = st.session_state['name']



roll_no = st.session_state['roll_no']

# --- SIDEBAR ---
with st.sidebar:
    st.title(" Placement Tracker")
    st.markdown(f"**Name:** {name}")
    st.markdown(f"**Roll No:** {roll_no}")
    st.divider()
    
    # Simple logout button clearing session state
    if st.button("Logout"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

# --- MAIN APP ---
tab1, tab2, tab3, tab4 = st.tabs([" Copilot", " Calendar", " Analytics", " Company Hub & Applications"])

with tab1:
    st.header(" AI Placement Copilot")
    
    with st.expander(" Your Daily Placement Brief", expanded=True):
        brief = fetch_daily_brief(roll_no)
        if isinstance(brief, str) and ("I'm having trouble" in brief or "Rate Limit" in brief):
            st.error(f" **AI Unavailable:** {brief}")
        elif isinstance(brief, dict):
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("###  Your Next Action")
                na = brief.get("next_action", {})
                company = na.get("company", "")
                title = na.get("title", "")
                tag = na.get("tag", "")
                countdown = na.get("countdown", "")
                time_loc = na.get("time_location", "")
                
                st.markdown(f"**{company} {title}** &nbsp;` {tag} `")
                
                time_str = ""
                if countdown and countdown.lower() not in ["continuous", "no upcoming events scheduled"]:
                    time_str += countdown.replace("Upcoming on ", "") + " • "
                time_str += time_loc
                
                st.caption(f" {time_str}")
                
            with col2:
                st.markdown("###  Today's Progress")
                prog = brief.get("progress", {})
                checklist = prog.get("checklist", [])
                
                for item in checklist:
                    # Streamlit checkboxes (read-only for preview)
                    st.checkbox(item.get("task", ""), value=item.get("done", False), key=item.get("task", ""))
        else:
            st.write(brief)
                
    st.divider()
    
    # st.fragment isolates the chat so typing doesn't reload the whole page
    @st.fragment
    def chat_interface():
        st.info("Ask me anything about your placement schedule or applications!")
        
        if "messages" not in st.session_state:
            st.session_state.messages = []
            
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                
        if prompt := st.chat_input("What should I prepare for today?"):
            st.session_state.messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)
                
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    try:
                        res = requests.post(
                            f"{API_URL}/chat", 
                            json={"message": prompt, "student_id": roll_no}
                        )
                        reply = res.json().get("reply", "Sorry, I couldn't process that.")
                    except Exception as e:
                        reply = f"Error connecting to backend: {e}"
            if "I'm having trouble" in reply or "Rate Limit" in reply:
                st.error(f" **AI Unavailable:** {reply}")
            else:
                st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})

    chat_interface()

    st.divider()

    # --- AI RESUME MATCHER ---
    with st.expander(" AI Resume Matcher  Find Your Best Company Fits", expanded=False):
        st.markdown("Upload your resume and the AI will analyse it against companies currently recruiting on campus.")
        uploaded_resume = st.file_uploader("Upload Resume (PDF only)", type=["pdf"], key="resume_uploader")
        if uploaded_resume:
            if st.button(" Find My Best Matches", use_container_width=True):
                with st.spinner("Analysing your resume against active companies... "):
                    try:
                        res = requests.post(
                            f"{API_URL}/recommend-companies",
                            files={"resume": (uploaded_resume.name, uploaded_resume.getvalue(), "application/pdf")}
                        )
                        if res.status_code == 200:
                            recommendation = res.json().get("recommendation", "No recommendations generated.")
                            st.session_state["resume_recommendation"] = recommendation
                        else:
                            st.error(f"Backend error: {res.json().get('detail', 'Unknown error')}")
                    except Exception as e:
                        st.error(f"Failed to connect to backend: {e}")

        if "resume_recommendation" in st.session_state:
            rec = st.session_state["resume_recommendation"]
            if "I'm having trouble" in rec or "Rate Limit" in rec:
                st.error(f" **AI Unavailable:** {rec}")
            else:
                st.markdown(rec)

with tab2:
    st.header("Campus Placement Calendar")
    
    col_c, col_d = st.columns([3, 1])
    with col_c:
        st.write("Official schedule for upcoming PPTs, Tests, and Interviews.")
    with col_d:
        if st.button(" Sync Calendar", use_container_width=True):
            with st.spinner("Syncing calendar (Check browser if login needed)..."):
                try:
                    req = requests.post(f"{API_URL}/sync-calendar")
                    res = req.json()
                    if "error" in res:
                        st.error(res["error"])
                    else:
                        st.success(f"Successfully synced {res.get('rows', 0)} rows!")
                        fetch_calendar.clear()
                        st.rerun()
                except Exception as e:
                    st.error(f"Sync failed: {e}")
    
    df_cal = fetch_calendar()
    df_apps = fetch_applications(roll_no)
    
    if df_cal.empty:
        st.info("No calendar data available.")
    else:
        # Strip whitespace from column names (sheet has trailing spaces like 'Date ', 'Company ')
        df_cal.columns = df_cal.columns.str.strip()
        
        filter_my_apps = st.checkbox(" Show only companies I've applied to / am eligible for", value=True)
        
        if filter_my_apps:
            if df_apps.empty:
                st.info(" You haven't synced your applications yet. Showing the full calendar. Head to the **Company Hub** tab to sync your data!")
            elif 'Company' in df_cal.columns and 'company_name' in df_apps.columns:
                import re
                def normalize(name):
                    return re.sub(r'[^a-z0-9]', '', str(name).lower())
                
                my_companies = df_apps['company_name'].apply(normalize).unique()
                my_companies = [c for c in my_companies if len(c) > 1]
                
                def is_match(c):
                    c_norm = normalize(c)
                    if len(c_norm) < 2: return False
                    for mc in my_companies:
                        if mc in c_norm or c_norm in mc:
                            return True
                    return False
                
                mask = df_cal['Company'].apply(is_match)
                df_cal = df_cal[mask]

        if df_cal.empty:
            st.success("No scheduled events found for your applied companies. ")
        else:
            # Today's Highlights
            st.subheader("Today's Events")
            today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            if 'Date' in df_cal.columns:
                # Clean up date column values: strip whitespace
                df_cal['Date'] = df_cal['Date'].astype(str).str.strip()
                
                # Parse dates trying multiple formats
                parsed = pd.to_datetime(df_cal['Date'], format='%d-%m-%Y', errors='coerce')
                # Try alternate format if some failed
                mask_na = parsed.isna()
                if mask_na.any():
                    parsed[mask_na] = pd.to_datetime(df_cal.loc[mask_na, 'Date'], format='%d/%m/%Y', errors='coerce')
                df_cal['parsed_date'] = parsed
                
                # Today's events
                today_events = df_cal[df_cal['parsed_date'] == today_dt]
                if not today_events.empty:
                    for _, row in today_events.iterrows():
                        st.error(f" **{row.get('Company', 'Unknown')}** - {row.get('Process', '')} at {row.get('Test Start Time', '')} / {row.get('PPT Start Time', '')}")
                else:
                    st.success("No events scheduled for today.")
            
                st.divider()
            
                # Filter: only show today and future events
                df_cal_future = df_cal[df_cal['parsed_date'] >= today_dt].drop(columns=['parsed_date'])
                st.dataframe(df_cal_future, width='stretch')
            else:
                st.divider()
                st.dataframe(df_cal, width='stretch')

with tab3:
    st.header("Placement Analytics")
    
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button(" Sync Global Offers & CTC", use_container_width=True, type="primary"):
            with st.spinner("Step 1/2: Syncing offers from emails..."):
                try:
                    req = requests.post(f"{API_URL}/sync-email-offers")
                    if req.status_code == 200:
                        st.success(" Emails synced successfully!")
                    else:
                        st.error(f"Email sync failed: {req.text}")
                except Exception as e:
                    st.error(f"Email sync failed: {e}")
                    
            with st.spinner("Step 2/2: Starting CTC Enrichment from pod.ai..."):
                try:
                    ctc_req = requests.post(f"{API_URL}/sync-ctc-enrichment")
                    if ctc_req.status_code == 200:
                        st.success(" CTC Enrichment has started in the background! (This process takes a few minutes. Check back later to see the updated CTCs).")
                        st.cache_data.clear()
                    else:
                        st.error(f"CTC sync failed to start: {ctc_req.text}")
                except Exception as e:
                    st.error(f"CTC sync failed: {e}")
                    
    with col_btn2:
        if st.button(" Clear Sheet Data & Reset Cron", use_container_width=True):
            with st.spinner("Clearing sheets and resetting cron to 1st July..."):
                try:
                    req = requests.post(f"{API_URL}/clear-offers")
                    if req.status_code == 200:
                        st.success("Successfully cleared sheets and reset cron start date!")
                        st.rerun()
                    else:
                        st.error(f"Failed to clear sheets: {req.text}")
                except Exception as e:
                    st.error(f"Failed to clear sheets: {e}")
                    
    analytics_data = fetch_analytics()
    overall = analytics_data.get("overall", {})
    branch_data = analytics_data.get("branch_data", [])
    
    with st.expander("Overall Metrics", expanded=True):
        m1, m2 = st.columns(2)
        m1.metric("TOTAL STUDENTS", overall.get("total_students", 0))
        m2.metric("PLACED STUDENTS", overall.get("placed_students", 0))
        
        m3, m4 = st.columns(2)
        m3.metric("PLACEMENT RATE", f"{overall.get('placement_rate', 0)}%")
        m4.metric("TOTAL OFFERS", overall.get("total_offers", 0))
        
        st.metric("RECRUITING COMPANIES", f"{overall.get('companies_hiring', 0)} firms", f"Top Branch: {overall.get('top_branch', 'N/A')}", delta_color="off")
        
    if branch_data:
        with st.expander(" Branch Comparison: Total Students vs Placed Students", expanded=True):
            st.caption("Paired side-by-side bars for every branch.")
            
            df_branch = pd.DataFrame(branch_data)
            
            df_melt = df_branch.melt(id_vars=["branch"], value_vars=["total_students", "placed_students"], var_name="Type", value_name="Count")
            df_melt["Type"] = df_melt["Type"].map({"total_students": "Total Students", "placed_students": "Placed Students"})
            
            chart = alt.Chart(df_melt).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
                x=alt.X("Type:N", title=None, axis=alt.Axis(labels=False, ticks=False)),
                y=alt.Y("Count:Q", title="Count (Students)"),
                color=alt.Color("Type:N", title="", scale=alt.Scale(domain=["Total Students", "Placed Students"], range=["#6366f1", "#10b981"])),
                column=alt.Column("branch:N", title=None, header=alt.Header(labelOrient="bottom", labelFontSize=12, labelFontWeight="bold")),
                tooltip=["branch", "Type", "Count"]
            ).properties(width=80, height=350).configure_view(stroke="transparent")
            
            st.altair_chart(chart, use_container_width=False)
            
        with st.expander("Detailed Branch Performance Summary", expanded=True):
            st.caption("Total student cohort versus placed count, offers tally, and placement percentages")
            df_branch = df_branch.drop(columns=['intern_only'], errors='ignore')
            
            st.dataframe(
                df_branch,
                column_config={
                    "branch": "Branch",
                    "full_name": "Full Program Name",
                    "total_students": st.column_config.NumberColumn("Total Students", format="%d"),
                    "placed_students": st.column_config.NumberColumn("Placed Students", format="%d"),
                    "offers_count": st.column_config.NumberColumn("Offers Count", format="%d"),
                    "firms": st.column_config.NumberColumn("Firms", format="%d"),
                    "placement_rate": st.column_config.ProgressColumn(
                        "Placement Rate",
                        help="Percentage of placed students",
                        format="%.1f%%",
                        min_value=0,
                        max_value=100,
                    ),
                },
                hide_index=True,
                use_container_width=True
            )
            
    with st.expander("Raw Offers Data", expanded=False):
        df_raw_offers = fetch_offers()
        if not df_raw_offers.empty:
            st.dataframe(df_raw_offers, use_container_width=True)
        else:
            st.info("No raw offers data available.")

with tab4:
    st.header(" Company Hub & Applications")

    # Company Knowledge Base Search
    st.subheader("Company Insights")
    search_company = st.text_input("Search for a company's historical placement pattern (e.g., Adobe, Microsoft)")
    if search_company:
        try:
            res = requests.get(f"{API_URL}/company/{search_company}")
            company_data = res.json().get("data")
            if company_data:
                st.success(f"Found insights for {search_company.title()}")
                col_i1, col_i2 = st.columns(2)
                col_i1.metric("Interview Rounds", company_data.get("rounds", "N/A"))
                st.write("**OA Pattern:**", company_data.get("oa_pattern", ""))
                st.write("**Frequent Topics:**", ", ".join(company_data.get("frequent_topics", [])))
                st.info(f"**Preparation Tips:** {company_data.get('preparation_tips', '')}")
            else:
                st.warning(f"No historical insights found for {search_company} in the knowledge base.")
        except Exception as e:
            st.error(f"Failed to fetch company insights: {e}")

    st.divider()
    st.subheader("My Applications")

    # Load cached personal applications from API
    df_apps = fetch_applications(roll_no)
    if not df_apps.empty:
        df_apps = df_apps.iloc[::-1]

    col1, col2 = st.columns([3, 1])
    with col1:
        if not df_apps.empty:
            st.caption(f"Found {len(df_apps)} synced applications.")
        else:
            st.caption("No applications found in cache.")
    with col2:
        if st.button(" Sync pod.ai Data", use_container_width=True):
            if POD_AI_USERNAME and POD_AI_PASSWORD:
                with st.spinner("Scraping pod.ai... This may take a minute."):
                    try:
                        req = requests.post(f"{API_URL}/sync-applications", json={
                            "pod_ai_username": POD_AI_USERNAME,
                            "pod_ai_password": POD_AI_PASSWORD,
                            "student_name": name,
                            "student_id": roll_no
                        })
                        res = req.json()
                        if res.get("errors"):
                            st.error("Errors occurred during sync:")
                            for err in res["errors"]:
                                st.error(err)
                        else:
                            st.success(f"Successfully scraped and cached {res.get('portal_records', 0)} applications!")
                    except Exception as e:
                        st.error(f"Sync failed: {e}")
            else:
                st.session_state['show_sync_modal'] = True

    if st.session_state.get('show_sync_modal', False):
        st.warning("Playwright Scraping Required")
        st.write("To sync your latest applications, please enter your pod.ai credentials. These are used live and never stored.")
        with st.form("sync_form"):
            pod_email = st.text_input("pod.ai Email", value="")
            pod_pwd = st.text_input("pod.ai Password", type="password")
            if st.form_submit_button("Run Sync"):
                if pod_email and pod_pwd:
                    with st.spinner("Scraping pod.ai... This may take a minute."):
                        try:
                            req = requests.post(f"{API_URL}/sync-applications", json={
                                "pod_ai_username": pod_email,
                                "pod_ai_password": pod_pwd,
                                "student_name": name,
                                "student_id": roll_no
                            })
                            res = req.json()
                            if res.get("errors"):
                                st.error("Errors occurred during sync:")
                                for err in res["errors"]:
                                    st.error(err)
                            else:
                                st.success(f"Successfully scraped and cached {res.get('portal_records', 0)} applications!")
                        except Exception as e:
                            st.error(f"Sync failed: {e}")
                    st.session_state['show_sync_modal'] = False
                    st.rerun()
                else:
                    st.error("Credentials required.")

    st.divider()

    if df_apps.empty:
        st.info("No applications to show. Click Sync to fetch them!")
    else:
        # --- STATUS BADGE HELPER ---
        STATUS_COLORS = {
            "Interviewing": ("#6366f1", ""),
            "Offered":      ("#22c55e", ""),
            "Shortlisted":  ("#f59e0b", ""),
            "Applied":      ("#3b82f6", ""),
            "Rejected":     ("#ef4444", ""),
            "N/A":          ("#6b7280", ""),
        }

        def render_status_badge(status):
            color, icon = STATUS_COLORS.get(status, ("#6b7280", ""))
            return f'<span style="background:{color}22; color:{color}; border:1px solid {color}66; padding:3px 10px; border-radius:99px; font-size:0.8rem; font-weight:600">{icon} {status}</span>'

        def render_app_card(row):
            status = row.get('status', 'N/A')
            badge = render_status_badge(status)
            st.markdown(f"""
            <div style="background:rgba(30,30,47,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:1.2rem 1.5rem; margin-bottom:1rem; backdrop-filter:blur(10px);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:1.1rem; font-weight:700; color:#f8fafc;">{row.get('company_name', 'Unknown')}</div>
                        <div style="color:#a0a0b8; font-size:0.9rem; margin-top:2px;">{row.get('offer_type', 'N/A')} &nbsp;&nbsp; CTC: <b style='color:#4ECDC4'>{row.get('ctc', 'N/A')}</b></div>
                    </div>
                    <div>{badge}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

        # --- THREE-FILTER TABS ---
        df_apps["status"] = df_apps["status"].fillna("N/A").astype(str).str.strip()

        # Classify based on substring to handle variations like 'Not Eligible', 'eligible', etc.
        mask_ineligible = df_apps["status"].str.contains("Not Eligible|Not-Eligible", case=False, na=False)
        mask_eligible = df_apps["status"].str.contains("Eligible", case=False, na=False) & ~mask_ineligible
        
        df_ineligible = df_apps[mask_ineligible]
        df_eligible = df_apps[mask_eligible]
        
        # Everything else falls into 'Applied' bucket (Registered, Shortlisted, Offered, N/A, etc.)
        df_applied = df_apps[~mask_eligible & ~mask_ineligible]

        f_tab1, f_tab2, f_tab3 = st.tabs([
            f" Applied ({len(df_applied)})",
            f" Eligible ({len(df_eligible)})",
            f" Not Eligible ({len(df_ineligible)})",
        ])

        with f_tab1:
            if df_applied.empty:
                st.info("No applied companies. Click Sync to fetch your applications!")
            else:
                for _, row in df_applied.iterrows():
                    render_app_card(row)

        with f_tab2:
            if df_eligible.empty:
                st.info("No eligible companies found. Sync pod.ai to fetch your eligibility data.")
            else:
                for _, row in df_eligible.iterrows():
                    render_app_card(row)

        with f_tab3:
            if df_ineligible.empty:
                st.info("No ineligible companies found.")
            else:
                for _, row in df_ineligible.iterrows():
                    render_app_card(row)

