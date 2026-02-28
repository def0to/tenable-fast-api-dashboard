import os
import time
import random
import datetime
import json
import logging
from typing import Any, Optional, List, Dict
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ScanMan2 Demo Backend", version="1.4.1")
scheduler = AsyncIOScheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCHEDULES_FILE = "schedules.json"

# --- Models ---

class AnalysisRequest(BaseModel):
    type: str
    query: dict
    sourceType: Optional[str] = "cumulative"
    sortField: Optional[str] = None
    sortDir: Optional[str] = "ASC"
    startOffset: Optional[int] = 0
    endOffset: Optional[int] = 50
    maxResults: Optional[int] = None
    pageSize: Optional[int] = 200
    pageDelay: Optional[float] = 0.5

class ScheduleReportRequest(BaseModel):
    dashboardName: str
    email: EmailStr
    frequency: str  # "daily", "weekly", "monthly"
    widgets: List[Dict[str, Any]]
    filters: List[Dict[str, Any]]

# --- Persistence Helpers ---

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

async def mock_send_report(email: str, dash: str):
    logger.info(f"[DEMO SCHEDULER] Automated report for '{dash}' triggered for {email}")

def add_job_to_scheduler(email: str, dash: str):
    # In demo mode, run every minute to show it works
    scheduler.add_job(
        mock_send_report,
        CronTrigger(second="0"),
        args=[email, dash],
        id=f"{dash}_{email}",
        replace_existing=True
    )

@app.on_event("startup")
async def startup():
    scheduler.start()
    schedules = load_schedules()
    for s in schedules:
        add_job_to_scheduler(s["email"], s["dashboardName"])
    logger.info(f"Demo Scheduler started with {len(schedules)} jobs loaded.")

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "demo", "scheduler_running": scheduler.running}

@app.post("/schedule-report")
async def schedule_report(request: ScheduleReportRequest):
    # 1. Add to Scheduler
    add_job_to_scheduler(request.email, request.dashboardName)
    
    # 2. Persist to file
    schedules = load_schedules()
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
        "message": f"[DEMO] Report scheduled for {request.email}. Persisted to {SCHEDULES_FILE}"
    }

# --- Mock Data Generators ---

def get_mock_listvuln(count=50):
    severities = [
        {"id": "4", "name": "Critical", "description": "Critical Severity"},
        {"id": "3", "name": "High", "description": "High Severity"},
        {"id": "2", "name": "Medium", "description": "Medium Severity"},
        {"id": "1", "name": "Low", "description": "Low Severity"},
        {"id": "0", "name": "Info", "description": "Informational"},
    ]
    families = [
        {"id": "2000002", "name": "Code Execution", "type": "was"},
        {"id": "11", "name": "Web Servers", "type": "active"},
        {"id": "20", "name": "Windows", "type": "active"},
        {"id": "17", "name": "Misc.", "type": "active"},
        {"id": "15", "name": "Databases", "type": "active"},
    ]
    os_list = ["Ubuntu 22.04 LTS", "Windows Server 2019", "CentOS 7", "Debian 11", "Red Hat Enterprise Linux 8"]
    plugins = ["Code Injection", "OpenSSH < 9.0 Multiple Vulnerabilities", "Apache HTTP Server < 2.4.58"]
    results = []
    for i in range(count):
        sev = random.choices(severities, weights=[5, 15, 30, 40, 10])[0]
        results.append({
            "pluginID": str(random.randint(10000, 99999)),
            "severity": sev,
            "ip": f"192.168.1.{random.randint(1, 254)}",
            "pluginName": random.choice(plugins),
            "riskFactor": sev["name"],
            "dnsName": f"host-{i:03}.internal",
            "operatingSystem": random.choice(os_list),
            "family": random.choice(families),
        })
    return results

def get_mock_summary(tool: str):
    if tool == "sumseverity":
        return [
            {"severity": {"id": "4", "name": "Critical"}, "count": str(random.randint(5, 20))},
            {"severity": {"id": "3", "name": "High"}, "count": str(random.randint(20, 50))},
            {"severity": {"id": "2", "name": "Medium"}, "count": str(random.randint(50, 150))},
            {"severity": {"id": "1", "name": "Low"}, "count": str(random.randint(150, 300))},
            {"severity": {"id": "0", "name": "Info"}, "count": str(random.randint(300, 600))},
        ]
    if tool == "sumfamily":
        families = ["Web Servers", "Windows", "General", "CGI abuses", "Databases", "Misc.", "Code Execution"]
        return [{"family": {"name": f}, "count": str(random.randint(10, 100))} for f in families]
    if tool == "sumip":
        return [
            {
                "ip": f"192.168.1.{i*10}", 
                "count": str(random.randint(5, 30)),
                "severityCritical": str(random.randint(0, 5)),
                "severityHigh": str(random.randint(0, 10)),
                "severityMedium": str(random.randint(0, 15)),
                "severityLow": str(random.randint(0, 20)),
            } for i in range(1, 11)
        ]
    if tool == "sumport":
        ports = [("443", "TCP"), ("80", "TCP"), ("22", "TCP"), ("3389", "TCP"), ("5432", "TCP"), ("161", "UDP")]
        return [{"port": p[0], "protocol": p[1], "count": str(random.randint(10, 100))} for p in ports]
    if tool == "sumprotocol":
        return [{"protocol": "TCP", "count": "312"}, {"protocol": "UDP", "count": "56"}, {"protocol": "ICMP", "count": "18"}]
    if tool == "listos":
        os_list = ["Windows Server 2019", "Ubuntu 22.04 LTS", "CentOS 7", "Red Hat Enterprise Linux 8", "Debian 11"]
        return [{"operatingSystem": o, "count": str(random.randint(5, 25))} for o in os_list]
    if tool == "listservices":
        services = [("HTTPS", "443", "TCP"), ("HTTP", "80", "TCP"), ("SSH", "22", "TCP"), ("RDP", "3389", "TCP")]
        return [{"name": s[0], "port": s[1], "protocol": s[2], "count": str(random.randint(5, 50))} for s in services]
    if tool == "sumcve":
        cves = ["CVE-2021-44228", "CVE-2023-44487", "CVE-2023-38408", "CVE-2019-0708"]
        return [{"cveID": c, "count": str(random.randint(3, 15)), "severity": {"name": random.choice(["Critical", "High"])}} for c in cves]
    if tool == "sumid":
        plugins = [("98120", "Code Injection"), ("34477", "OpenSSH Vulnerabilities"), ("11219", "Apache HTTP Server")]
        return [{"pluginID": p[0], "pluginName": p[1], "count": str(random.randint(5, 30)), "severity": {"name": "High"}, "family": {"name": "Misc"}} for p in plugins]
    if tool == "sumremediation":
        solutions = ["Upgrade OpenSSH", "Upgrade Apache", "Apply Microsoft update", "Upgrade Log4j"]
        return [{"solution": s, "hostTotal": str(random.randint(5, 30)), "vulnTotal": str(random.randint(10, 50))} for s in solutions]
    if tool == "sumdnsname":
        hosts = ["web01.internal", "db01.internal", "app01.internal", "api01.internal"]
        return [{"dnsName": h, "count": str(random.randint(5, 30))} for h in hosts]
    if tool == "trend":
        now = datetime.datetime.now()
        results = []
        for i in range(12):
            d = now - datetime.timedelta(days=i*30)
            results.append({
                "date": d.strftime("%Y-%m"),
                "count": str(random.randint(200, 400)),
                "critical": str(random.randint(5, 10)),
                "high": str(random.randint(20, 40)),
                "medium": str(random.randint(60, 100))
            })
        return results
    return []

@app.post("/analysis")
async def analysis(request: AnalysisRequest):
    tool = request.query.get("tool", "listvuln")
    if tool == "listvuln":
        results = get_mock_listvuln(request.pageSize or 50)
    else:
        results = get_mock_summary(tool)
        
    return {
        "type": request.type,
        "response": {
            "totalRecords": str(len(results)),
            "returnedRecords": len(results),
            "startOffset": "0",
            "endOffset": str(len(results)),
            "results": results,
        },
        "error_code": 0,
        "timestamp": int(time.time()),
    }

@app.get("/queries")
async def list_queries(type: str = "vuln"):
    return {"type": type, "response": {"usable": [], "manageable": []}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
