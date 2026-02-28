"""
Tenable Security Center FastAPI Proxy
=====================================
Implementation follows Tenable SC API Documentation:
- Analysis API: https://docs.tenable.com/security-center/api/Analysis.htm
- Query API: https://docs.tenable.com/security-center/api/Query.htm
"""

import os
import time
import asyncio
import httpx
import smtplib
import json
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Optional, List, Dict, Union
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ScanMan2 Proxy", version="1.4.0")

# Configure CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = allowed_origins_env.split(",") if allowed_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TENABLE_SC_HOST = os.getenv("TENABLE_SC_HOST", "").rstrip("/")
TENABLE_SC_ACCESS_KEY = os.getenv("TENABLE_SC_ACCESS_KEY", "")
TENABLE_SC_SECRET_KEY = os.getenv("TENABLE_SC_SECRET_KEY", "")
VERIFY_SSL = os.getenv("VERIFY_SSL", "true").lower() == "true"

# SMTP Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "scanman2@example.com")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() == "true"

SCHEDULES_FILE = "schedules.json"

# Initialize Scheduler
scheduler = AsyncIOScheduler()

def get_headers() -> Dict[str, str]:
    """Return auth headers for Tenable SC API key authentication."""
    return {
        "x-apikey": f"accesskey={TENABLE_SC_ACCESS_KEY}; secretkey={TENABLE_SC_SECRET_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# --- Models ---

class Filter(BaseModel):
    filterName: str
    operator: str
    value: str

class QueryModel(BaseModel):
    id: Optional[Union[int, str]] = None
    name: Optional[str] = None
    description: Optional[str] = None
    tool: Optional[str] = None
    type: Optional[str] = None
    filters: Optional[List[Filter]] = None
    target: Optional[str] = None
    context: Optional[str] = None

class AnalysisRequest(BaseModel):
    type: str
    query: Optional[QueryModel] = None
    queryId: Optional[Union[int, str]] = None
    sourceType: Optional[str] = "cumulative"
    sortField: Optional[str] = None
    sortDir: Optional[str] = "ASC"
    startOffset: Optional[int] = 0
    endOffset: Optional[int] = 50
    scanID: Optional[int] = None
    view: Optional[str] = None
    maxResults: Optional[int] = None
    pageSize: Optional[int] = 200
    pageDelay: Optional[float] = 0.5

class ScheduleReportRequest(BaseModel):
    dashboardName: str
    email: EmailStr
    frequency: str  # "daily", "weekly", "monthly"
    widgets: List[Dict[str, Any]]
    filters: List[Dict[str, Any]]


# --- Helpers ---

def save_schedules(schedules: List[Dict]):
    with open(SCHEDULES_FILE, "w") as f:
        json.dump(schedules, f)

def load_schedules() -> List[Dict]:
    if os.path.exists(SCHEDULES_FILE):
        try:
            with open(SCHEDULES_FILE, "r") as f:
                return json.load(f)
        except:
            return []
    return []

def send_email_report(to_email: str, subject: str, body: str):
    if not SMTP_HOST or not SMTP_USER:
        logger.info(f"[DEMO MODE] Email to {to_email}: {subject}")
        return

    msg = MIMEMultipart()
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        if SMTP_TLS:
            server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        logger.info(f"Email sent successfully to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")

async def run_scheduled_report(dashboard_name: str, email: str, widgets: List, filters: List):
    """
    This function is called by the scheduler.
    In production, it could perform the actual data fetching and format a PDF/HTML.
    """
    logger.info(f"Executing scheduled report for {dashboard_name} -> {email}")
    
    subject = f"ScanMan2 Scheduled Report: {dashboard_name}"
    body = f"Hello,\n\nThis is your scheduled report for dashboard '{dashboard_name}'.\n"
    body += f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    body += f"Total Widgets: {len(widgets)}\n"
    body += f"Global Filters applied: {len(filters)}\n\n"
    body += "Please log in to ScanMan2 to see the live data.\n\n"
    body += "Regards,\nScanMan2 Automations"
    
    send_email_report(email, subject, body)

def add_job_to_scheduler(dashboard_name: str, email: str, frequency: str, widgets: List, filters: List):
    job_id = f"{dashboard_name}_{email}_{frequency}"
    
    # Define triggers
    if frequency == "daily":
        trigger = CronTrigger(hour=8, minute=0) # 8 AM daily
    elif frequency == "weekly":
        trigger = CronTrigger(day_of_week='mon', hour=8, minute=0) # 8 AM Monday
    else: # monthly
        trigger = CronTrigger(day=1, hour=8, minute=0) # 8 AM first of month

    scheduler.add_job(
        run_scheduled_report,
        trigger,
        id=job_id,
        args=[dashboard_name, email, widgets, filters],
        replace_existing=True
    )
    return job_id


# --- Lifecycle ---

@app.on_event("startup")
async def startup_event():
    scheduler.start()
    # Reload existing schedules from file
    schedules = load_schedules()
    for s in schedules:
        add_job_to_scheduler(
            s["dashboardName"], s["email"], s["frequency"], s["widgets"], s["filters"]
        )
    logger.info(f"Scheduler started with {len(schedules)} jobs loaded.")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()


# --- Endpoints ---

@app.get("/health")
async def health():
    return {
        "status": "ok", 
        "smtp_configured": bool(SMTP_USER),
        "scheduler_running": scheduler.running
    }

@app.post("/analysis")
async def analysis(request: AnalysisRequest):
    # (Implementation remains same as before...)
    return await _api_request("POST", "/analysis", json=request.dict(exclude_none=True))

@app.post("/schedule-report")
async def schedule_report(request: ScheduleReportRequest):
    # 1. Add to APScheduler
    add_job_to_scheduler(
        request.dashboardName, request.email, request.frequency, request.widgets, request.filters
    )
    
    # 2. Persist to file
    schedules = load_schedules()
    # Update if exists, else append
    new_entry = request.dict()
    found = False
    for i, s in enumerate(schedules):
        if s["dashboardName"] == request.dashboardName and s["email"] == request.email:
            schedules[i] = new_entry
            found = True
            break
    if not found:
        schedules.append(new_entry)
    
    save_schedules(schedules)
    
    return {
        "status": "scheduled",
        "message": f"Report for '{request.dashboardName}' scheduled ({request.frequency}) for {request.email}"
    }

# (Other query endpoints remain...)

async def _api_request(method: str, path: str, **kwargs) -> dict:
    url = f"{TENABLE_SC_HOST}/rest{path}"
    headers = {**get_headers(), **kwargs.pop("headers", {})}
    async with httpx.AsyncClient(verify=VERIFY_SSL, timeout=60.0) as client:
        response = await client.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
