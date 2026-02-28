import { TenableQueryConfig } from "@/types/dashboard";
import { getTimeRangeCutoff } from "./time-range-utils";

// Configure your FastAPI backend URL here
// In Docker/Podman: Nginx proxies /api/ → backend container automatically
// In dev mode: override via localStorage to point at your local backend
const DEFAULT_API_URL = "/api";

export function setApiBaseUrl(url: string) {
  localStorage.setItem("scanman2_api_url", url.replace(/\/$/, ""));
  window.location.reload();
}

export function getApiBaseUrl(): string {
  return localStorage.getItem("scanman2_api_url") || DEFAULT_API_URL;
}

export interface TenableAnalysisResponse {
  type: string;
  response: {
    totalRecords: string;
    returnedRecords: number;
    startOffset: string;
    endOffset: string;
    results: Record<string, any>[];
  };
  error_code: number;
  error_msg: string;
  warnings: string[];
  timestamp: number;
}

export async function executeAnalysis(query: TenableQueryConfig): Promise<TenableAnalysisResponse> {
  const url = `${getApiBaseUrl()}/analysis`;

  // Start with user-defined filters
  const filters = [...query.filters].map((f) => ({
    filterName: f.filterName,
    operator: f.operator,
    value: f.value,
  }));

  // Handle Time Range as a Filter (Tenable SC standard)
  if (query.timeRange && query.timeRange !== "ALL") {
    let filterName = "lastSeen";
    let value = "";
    
    // For patched/mitigated data, Tenable uses 'lastMitigated'
    if (query.sourceType === "patched") {
      filterName = "lastMitigated";
    }

    if (query.timeRange === "CUSTOM") {
      // Use epoch range for custom dates if available
      if (query.startTime && query.endTime) {
        value = `${query.startTime}-${query.endTime}`;
      } else if (query.startTime) {
        value = `${query.startTime}-`;
      }
    } else {
      // Relative ranges: "30:all" style as requested
      const days = query.timeRange === "7D" ? 7 :
                   query.timeRange === "1M" ? 30 : 
                   query.timeRange === "3M" ? 90 : 
                   query.timeRange === "6M" ? 180 : 365;
      value = `${days}:all`;
    }

    if (value) {
      filters.push({
        filterName: filterName,
        operator: "=",
        value: value,
      });
    }
  }

  const body: Record<string, any> = {
    type: query.type,
    sourceType: query.sourceType,
    sortField: query.sortField || undefined,
    sortDir: query.sortDir,
    query: {
      tool: query.tool,
      type: query.type,
      filters: filters,
    },
  };

  // Auto-pagination: send maxResults instead of raw offsets
  if (query.maxResults && query.maxResults > 0) {
    body.maxResults = query.maxResults;
    body.pageSize = query.pageSize || 200;
    body.pageDelay = query.pageDelay ?? 0.5;
  } else {
    body.startOffset = query.startOffset;
    body.endOffset = query.endOffset;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// --- Saved Queries API ---

export interface TenableSavedQueryResponse {
  type: string;
  response: {
    usable: { id: string; name: string; description: string }[];
    manageable: { id: string; name: string; description: string }[];
  };
}

export async function listSavedQueries(type: string = "vuln"): Promise<TenableSavedQueryResponse> {
  const url = `${getApiBaseUrl()}/queries?type=${type}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Failed to fetch saved queries");
  return response.json();
}

export async function createSavedQuery(query: {
  name: string;
  description?: string;
  type?: string;
  tool?: string;
  filters?: { filterName: string; operator: string; value: string }[];
}): Promise<TenableSavedQueryResponse> {
  const url = `${getApiBaseUrl()}/queries`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error("Failed to create query");
  return response.json();
}

export async function deleteSavedQuery(id: string): Promise<{ response: any }> {
  const url = `${getApiBaseUrl()}/queries/${id}`;
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete query");
  return response.json();
}

export async function scheduleReport(payload: {
  dashboardName: string;
  email: string;
  frequency: string;
  widgets: any[];
  filters: any[];
}): Promise<any> {
  const url = `${getApiBaseUrl()}/schedule-report`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Failed to schedule report");
  }
  return await response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const data = await response.json();
    // The real FastAPI backend returns { status: "ok" }; Vite SPA fallback returns HTML
    return data?.status === "ok";
  } catch {
    return false;
  }
}

// =====================================================================
// Mock data for demo mode — matches the REAL Tenable SC Analysis API
// response structure documented at:
//   https://docs.tenable.com/security-center/api/Analysis.htm
// =====================================================================

/**
 * Full listvuln mock rows — every field that Tenable SC returns.
 * Epoch timestamps (firstSeen, lastSeen, pluginPubDate, etc.) are in
 * Unix seconds, exactly as the real API returns them.
 */
const MOCK_LISTVULN: Record<string, any>[] = [
  {
    pluginID: "98120",
    severity: { id: "4", name: "Critical", description: "Critical Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.10",
    uuid: "",
    port: "443",
    protocol: "TCP",
    pluginName: "Code Injection",
    firstSeen: "1744728630",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "A code injection vulnerability exists in a web application.",
    description: "Server-side code injection was detected. Untrusted input is executed as server-side code which could lead to complete server compromise.",
    solution: "Ensure that untrusted input is never processed as server-side code. Validate all inputs to contain only expected data.",
    seeAlso: "http://www.aspdev.org/asp/asp-eval-execute/",
    riskFactor: "Critical",
    stigSeverity: "",
    vprScore: "8.4",
    vprContext: "[]",
    baseScore: "10.0",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:C/I:C/A:C",
    cvssV3BaseScore: "9.8",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1490976000",
    pluginModDate: "1653494400",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "CWE #94,OWASP #2021-A3,PCI_DSS #3.2-6.5.1",
    seolDate: "-1",
    pluginText: "<plugin_output>Code injection confirmed</plugin_output>",
    dnsName: "web01.internal",
    macAddress: "00:1A:2B:3C:4D:5E",
    netbiosName: "",
    operatingSystem: "Ubuntu 22.04 LTS",
    ips: "192.168.1.10",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "02ebb260-30ed-4bf8-9e2c-92a8614cda1a",
    acrScore: "8.0",
    assetExposureScore: "720",
    family: { id: "2000002", name: "Code Execution", type: "was" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "98120 (0/6) Code Injection",
  },
  {
    pluginID: "34477",
    severity: { id: "3", name: "High", description: "High Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.20",
    uuid: "",
    port: "22",
    protocol: "TCP",
    pluginName: "OpenSSH < 9.0 Multiple Vulnerabilities",
    firstSeen: "1735000000",
    lastSeen: "1751396645",
    exploitAvailable: "Yes",
    exploitEase: "Exploits are available",
    exploitFrameworks: "Metasploit",
    synopsis: "The SSH server running on the remote host is affected by multiple vulnerabilities.",
    description: "OpenSSH before 9.0 contains multiple vulnerabilities including a double-free in the options.kex_algorithms handling.",
    solution: "Upgrade OpenSSH to version 9.0 or later.",
    seeAlso: "https://www.openssh.com/security.html",
    riskFactor: "High",
    stigSeverity: "I",
    vprScore: "7.2",
    vprContext: "[{\"id\":\"age_of_vulns\",\"name\":\"Vulnerability Age\",\"type\":\"string\",\"value\":\"730 days +\"}]",
    baseScore: "8.1",
    temporalScore: "7.5",
    cvssVector: "AV:N/AC:L/Au:N/C:P/I:P/A:P",
    cvssV3BaseScore: "8.1",
    cvssV3TemporalScore: "7.5",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    cpe: "cpe:/a:openbsd:openssh",
    vulnPubDate: "1648684800",
    patchPubDate: "1648684800",
    pluginPubDate: "1649548800",
    pluginModDate: "1700006400",
    checkType: "remote",
    version: "8.4p1",
    cve: "CVE-2023-38408",
    bid: "",
    xref: "CWE #415,OWASP #2021-A6",
    seolDate: "-1",
    pluginText: "<plugin_output>Installed version : 8.4p1\nFixed version     : 9.0</plugin_output>",
    dnsName: "db01.internal",
    macAddress: "00:1A:2B:3C:4D:6F",
    netbiosName: "",
    operatingSystem: "CentOS 7",
    ips: "192.168.1.20",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    acrScore: "6.0",
    assetExposureScore: "540",
    family: { id: "17", name: "Misc.", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "34477 (0/6) OpenSSH < 9.0 Multiple Vulnerabilities",
  },
  {
    pluginID: "11219",
    severity: { id: "2", name: "Medium", description: "Medium Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.30",
    uuid: "",
    port: "80",
    protocol: "TCP",
    pluginName: "Apache HTTP Server < 2.4.58 Multiple Vulnerabilities",
    firstSeen: "1730000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The remote web server is affected by multiple vulnerabilities.",
    description: "The version of Apache httpd installed on the remote host is prior to 2.4.58. It is therefore affected by multiple vulnerabilities including HTTP/2 RESET flood.",
    solution: "Upgrade to Apache version 2.4.58 or later.",
    seeAlso: "https://httpd.apache.org/security/vulnerabilities_24.html",
    riskFactor: "Medium",
    stigSeverity: "II",
    vprScore: "5.9",
    vprContext: "[]",
    baseScore: "6.5",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:N/I:N/A:P",
    cvssV3BaseScore: "6.5",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L",
    cpe: "cpe:/a:apache:http_server",
    vulnPubDate: "1697155200",
    patchPubDate: "1697155200",
    pluginPubDate: "1697241600",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "2.4.52",
    cve: "CVE-2023-44487,CVE-2023-45802",
    bid: "",
    xref: "CWE #400,PCI_DSS #3.2-6.2",
    seolDate: "-1",
    pluginText: "<plugin_output>Installed version : 2.4.52\nFixed version     : 2.4.58</plugin_output>",
    dnsName: "app01.internal",
    macAddress: "00:1A:2B:3C:4D:7A",
    netbiosName: "",
    operatingSystem: "Ubuntu 22.04 LTS",
    ips: "192.168.1.30",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    acrScore: "7.0",
    assetExposureScore: "455",
    family: { id: "11", name: "Web Servers", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "11219 (0/6) Apache HTTP Server < 2.4.58",
  },
  {
    pluginID: "56984",
    severity: { id: "4", name: "Critical", description: "Critical Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.40",
    uuid: "",
    port: "3389",
    protocol: "TCP",
    pluginName: "Microsoft RDP BlueKeep (CVE-2019-0708)",
    firstSeen: "1728000000",
    lastSeen: "1751396645",
    exploitAvailable: "Yes",
    exploitEase: "Exploits are available",
    exploitFrameworks: "Metasploit, Core Impact",
    synopsis: "The remote Windows host is affected by a remote code execution vulnerability.",
    description: "The Remote Desktop Services (RDP) implementation on the remote Windows host is affected by a remote code execution vulnerability. An unauthenticated attacker can exploit this to execute arbitrary code.",
    solution: "Apply the appropriate Microsoft security update. Alternatively, enable Network Level Authentication (NLA).",
    seeAlso: "https://portal.msrc.microsoft.com/en-US/security-guidance/advisory/CVE-2019-0708",
    riskFactor: "Critical",
    stigSeverity: "I",
    vprScore: "9.8",
    vprContext: "[{\"id\":\"exploit_code_maturity\",\"name\":\"Exploit Maturity\",\"type\":\"string\",\"value\":\"Functional\"}]",
    baseScore: "10.0",
    temporalScore: "9.0",
    cvssVector: "AV:N/AC:L/Au:N/C:C/I:C/A:C",
    cvssV3BaseScore: "9.8",
    cvssV3TemporalScore: "9.0",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    cpe: "cpe:/o:microsoft:windows",
    vulnPubDate: "1557878400",
    patchPubDate: "1557878400",
    pluginPubDate: "1558915200",
    pluginModDate: "1696118400",
    checkType: "remote",
    version: "",
    cve: "CVE-2019-0708",
    bid: "108273",
    xref: "MSFT #MS19-MAY,IAVA #2019-A-0178,CISA-KNOWN-EXPLOITED",
    seolDate: "-1",
    pluginText: "<plugin_output>The remote host is vulnerable to BlueKeep (CVE-2019-0708)</plugin_output>",
    dnsName: "win01.internal",
    macAddress: "00:1A:2B:3C:4D:8B",
    netbiosName: "WIN01",
    operatingSystem: "Windows Server 2019",
    ips: "192.168.1.40",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    acrScore: "9.0",
    assetExposureScore: "882",
    family: { id: "20", name: "Windows", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "56984 (0/6) Microsoft RDP BlueKeep",
  },
  {
    pluginID: "78901",
    severity: { id: "1", name: "Low", description: "Low Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.50",
    uuid: "",
    port: "161",
    protocol: "UDP",
    pluginName: "SNMP Agent Default Community Name (public)",
    firstSeen: "1725000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The community name of the remote SNMP server can be guessed.",
    description: "It is possible to obtain the default community name of the remote SNMP server. An attacker may use this to gain read access to device information.",
    solution: "Disable the SNMP service if not needed, or change the default community string.",
    seeAlso: "",
    riskFactor: "Low",
    stigSeverity: "III",
    vprScore: "3.1",
    vprContext: "[]",
    baseScore: "3.5",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:P/I:N/A:N",
    cvssV3BaseScore: "3.5",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1009843200",
    pluginModDate: "1672531200",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "CWE #200",
    seolDate: "-1",
    pluginText: "<plugin_output>The remote SNMP server replies to the community name 'public'</plugin_output>",
    dnsName: "switch01.internal",
    macAddress: "00:1A:2B:3C:4D:9C",
    netbiosName: "",
    operatingSystem: "Cisco IOS 15.2",
    ips: "192.168.1.50",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "d4e5f6a7-b8c9-0123-def0-123456789abc",
    acrScore: "4.0",
    assetExposureScore: "140",
    family: { id: "22", name: "SNMP", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "78901 (0/6) SNMP Agent Default Community Name",
  },
  {
    pluginID: "45123",
    severity: { id: "3", name: "High", description: "High Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.60",
    uuid: "",
    port: "8080",
    protocol: "TCP",
    pluginName: "Jenkins < 2.426 Remote Code Execution",
    firstSeen: "1738000000",
    lastSeen: "1751396645",
    exploitAvailable: "Yes",
    exploitEase: "Exploits are available",
    exploitFrameworks: "Metasploit",
    synopsis: "The remote web server hosts a Jenkins instance with a known RCE vulnerability.",
    description: "Jenkins before version 2.426 is affected by a remote code execution vulnerability in the CLI component. An unauthenticated attacker can exploit this to execute arbitrary commands.",
    solution: "Upgrade Jenkins to version 2.426 or later.",
    seeAlso: "https://www.jenkins.io/security/advisory/2024-01-24/",
    riskFactor: "High",
    stigSeverity: "I",
    vprScore: "8.9",
    vprContext: "[]",
    baseScore: "9.1",
    temporalScore: "8.5",
    cvssVector: "AV:N/AC:L/Au:N/C:C/I:C/A:N",
    cvssV3BaseScore: "9.1",
    cvssV3TemporalScore: "8.5",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    cpe: "cpe:/a:jenkins:jenkins",
    vulnPubDate: "1706054400",
    patchPubDate: "1706054400",
    pluginPubDate: "1706140800",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "2.401",
    cve: "CVE-2024-23897",
    bid: "",
    xref: "CWE #78,CISA-KNOWN-EXPLOITED",
    seolDate: "-1",
    pluginText: "<plugin_output>Installed version : 2.401\nFixed version     : 2.426</plugin_output>",
    dnsName: "ci01.internal",
    macAddress: "00:1A:2B:3C:4D:AD",
    netbiosName: "",
    operatingSystem: "Red Hat Enterprise Linux 8",
    ips: "192.168.1.60",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "e5f6a7b8-c9d0-1234-ef01-23456789abcd",
    acrScore: "7.5",
    assetExposureScore: "668",
    family: { id: "13", name: "CGI abuses", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "45123 (0/6) Jenkins < 2.426 RCE",
  },
  {
    pluginID: "67890",
    severity: { id: "2", name: "Medium", description: "Medium Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.70",
    uuid: "",
    port: "5432",
    protocol: "TCP",
    pluginName: "PostgreSQL < 16.1 Authentication Bypass",
    firstSeen: "1732000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The remote database server is affected by an authentication bypass vulnerability.",
    description: "The version of PostgreSQL installed on the remote host is prior to 16.1. An attacker with network access could bypass authentication under specific SCRAM configurations.",
    solution: "Upgrade to PostgreSQL 16.1 or later.",
    seeAlso: "https://www.postgresql.org/support/security/",
    riskFactor: "Medium",
    stigSeverity: "II",
    vprScore: "6.1",
    vprContext: "[]",
    baseScore: "7.3",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:P/I:P/A:N",
    cvssV3BaseScore: "7.3",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
    cpe: "cpe:/a:postgresql:postgresql",
    vulnPubDate: "1699401600",
    patchPubDate: "1699401600",
    pluginPubDate: "1699488000",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "15.4",
    cve: "CVE-2023-5868,CVE-2023-5869",
    bid: "",
    xref: "CWE #287",
    seolDate: "-1",
    pluginText: "<plugin_output>Installed version : 15.4\nFixed version     : 16.1</plugin_output>",
    dnsName: "db02.internal",
    macAddress: "00:1A:2B:3C:4D:BE",
    netbiosName: "",
    operatingSystem: "Debian 11",
    ips: "192.168.1.70",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "f6a7b8c9-d0e1-2345-f012-3456789abcde",
    acrScore: "5.5",
    assetExposureScore: "402",
    family: { id: "15", name: "Databases", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "67890 (0/6) PostgreSQL < 16.1 Auth Bypass",
  },
  {
    pluginID: "23456",
    severity: { id: "4", name: "Critical", description: "Critical Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.80",
    uuid: "",
    port: "443",
    protocol: "TCP",
    pluginName: "Apache Log4j < 2.17.0 RCE (Log4Shell)",
    firstSeen: "1720000000",
    lastSeen: "1751396645",
    exploitAvailable: "Yes",
    exploitEase: "Exploits are available",
    exploitFrameworks: "Metasploit, Core Impact, Canvas",
    synopsis: "A logging library used by the remote host is affected by a remote code execution vulnerability.",
    description: "Apache Log4j2 versions 2.0-beta9 through 2.16.0 are affected by a remote code execution vulnerability via JNDI lookup. An attacker can craft malicious log messages to execute arbitrary code.",
    solution: "Upgrade to Apache Log4j 2.17.0 or later.",
    seeAlso: "https://logging.apache.org/log4j/2.x/security.html",
    riskFactor: "Critical",
    stigSeverity: "I",
    vprScore: "10.0",
    vprContext: "[{\"id\":\"exploit_code_maturity\",\"name\":\"Exploit Maturity\",\"type\":\"string\",\"value\":\"Weaponized\"},{\"id\":\"threat_intensity_last_28\",\"name\":\"Threat Intensity\",\"type\":\"string\",\"value\":\"Very High\"}]",
    baseScore: "10.0",
    temporalScore: "9.5",
    cvssVector: "AV:N/AC:L/Au:N/C:C/I:C/A:C",
    cvssV3BaseScore: "10.0",
    cvssV3TemporalScore: "9.5",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    cpe: "cpe:/a:apache:log4j",
    vulnPubDate: "1639094400",
    patchPubDate: "1639612800",
    pluginPubDate: "1639180800",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "2.14.1",
    cve: "CVE-2021-44228,CVE-2021-45046",
    bid: "",
    xref: "CWE #917,CISA-KNOWN-EXPLOITED,OWASP #2021-A6",
    seolDate: "-1",
    pluginText: "<plugin_output>Installed version : 2.14.1\nFixed version     : 2.17.0</plugin_output>",
    dnsName: "api01.internal",
    macAddress: "00:1A:2B:3C:4D:CF",
    netbiosName: "",
    operatingSystem: "Red Hat Enterprise Linux 8",
    ips: "192.168.1.80",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "a7b8c9d0-e1f2-3456-0123-456789abcdef",
    acrScore: "9.5",
    assetExposureScore: "950",
    family: { id: "11", name: "Web Servers", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "23456 (0/6) Apache Log4j < 2.17.0 RCE",
  },
  {
    pluginID: "89012",
    severity: { id: "0", name: "Info", description: "Informational" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "192.168.1.90",
    uuid: "",
    port: "0",
    protocol: "TCP",
    pluginName: "OS Identification",
    firstSeen: "1715000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "It is possible to determine the remote operating system.",
    description: "Using a combination of remote probes, it is possible to guess the name of the remote operating system.",
    solution: "N/A",
    seeAlso: "",
    riskFactor: "None",
    stigSeverity: "",
    vprScore: "",
    vprContext: "[]",
    baseScore: "0.0",
    temporalScore: "",
    cvssVector: "",
    cvssV3BaseScore: "0.0",
    cvssV3TemporalScore: "",
    cvssV3Vector: "",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1009843200",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "",
    seolDate: "-1",
    pluginText: "<plugin_output>Remote operating system : HP LaserJet P4015</plugin_output>",
    dnsName: "printer01.internal",
    macAddress: "00:1A:2B:3C:4D:E0",
    netbiosName: "",
    operatingSystem: "HP LaserJet Printer",
    ips: "192.168.1.90",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "b8c9d0e1-f2a3-4567-1234-56789abcdef0",
    acrScore: "2.0",
    assetExposureScore: "0",
    family: { id: "1", name: "General", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "89012 (0/6) OS Identification",
  },
  {
    pluginID: "34567",
    severity: { id: "3", name: "High", description: "High Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "10.0.0.15",
    uuid: "",
    port: "25",
    protocol: "TCP",
    pluginName: "SMTP Server Open Relay",
    firstSeen: "1742000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The remote SMTP server is configured as an open relay.",
    description: "The remote SMTP server is misconfigured and allows mail relaying. This could allow spammers to use the server to send unsolicited email.",
    solution: "Configure the SMTP server to reject relay attempts from unauthorized sources.",
    seeAlso: "",
    riskFactor: "High",
    stigSeverity: "II",
    vprScore: "7.5",
    vprContext: "[]",
    baseScore: "7.8",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:N/I:P/A:N",
    cvssV3BaseScore: "7.8",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1009843200",
    pluginModDate: "1672531200",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "CWE #269",
    seolDate: "-1",
    pluginText: "<plugin_output>The SMTP server accepted a relay attempt</plugin_output>",
    dnsName: "mail01.internal",
    macAddress: "00:1A:2B:3C:4D:F1",
    netbiosName: "",
    operatingSystem: "Windows Server 2016",
    ips: "10.0.0.15",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "c9d0e1f2-a3b4-5678-2345-6789abcdef01",
    acrScore: "5.0",
    assetExposureScore: "390",
    family: { id: "25", name: "SMTP problems", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "34567 (0/6) SMTP Server Open Relay",
  },
  {
    pluginID: "99001",
    severity: { id: "2", name: "Medium", description: "Medium Severity" },
    hasBeenMitigated: "1",
    acceptRisk: "0",
    recastRisk: "0",
    ip: "10.0.0.25",
    uuid: "",
    port: "443",
    protocol: "TCP",
    pluginName: "SSL Certificate Cannot Be Trusted",
    firstSeen: "1740000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The SSL certificate for this service cannot be trusted.",
    description: "The server's X.509 certificate does not have a signature from a known public certificate authority. The certificate is self-signed or signed by an unrecognized CA.",
    solution: "Purchase or generate a proper SSL certificate for this service.",
    seeAlso: "",
    riskFactor: "Medium",
    stigSeverity: "II",
    vprScore: "4.2",
    vprContext: "[]",
    baseScore: "5.0",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:N/I:P/A:N",
    cvssV3BaseScore: "5.3",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1009843200",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "CWE #295,PCI_DSS #3.2-4.1",
    seolDate: "-1",
    pluginText: "<plugin_output>Self-signed certificate detected</plugin_output>",
    dnsName: "vpn01.internal",
    macAddress: "00:1A:2B:3C:5E:01",
    netbiosName: "",
    operatingSystem: "Windows Server 2019",
    ips: "10.0.0.25",
    recastRiskRuleComment: "N/A",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "d0e1f2a3-b4c5-6789-3456-789abcdef012",
    acrScore: "6.0",
    assetExposureScore: "318",
    family: { id: "1", name: "General", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "99001 (0/6) SSL Certificate Cannot Be Trusted",
  },
  {
    pluginID: "99002",
    severity: { id: "3", name: "High", description: "High Severity" },
    hasBeenMitigated: "0",
    acceptRisk: "0",
    recastRisk: "1",
    ip: "192.168.1.30",
    uuid: "",
    port: "443",
    protocol: "TCP",
    pluginName: "TLS Version 1.0 Protocol Detection",
    firstSeen: "1720000000",
    lastSeen: "1751396645",
    exploitAvailable: "No",
    exploitEase: "",
    exploitFrameworks: "",
    synopsis: "The remote service encrypts traffic using an older version of TLS.",
    description: "The remote service accepts connections encrypted using TLS 1.0 which has known cryptographic weaknesses.",
    solution: "Enable support for TLS 1.2 and/or 1.3, and disable TLS 1.0.",
    seeAlso: "https://tools.ietf.org/html/rfc8996",
    riskFactor: "High",
    stigSeverity: "I",
    vprScore: "6.7",
    vprContext: "[]",
    baseScore: "6.1",
    temporalScore: "",
    cvssVector: "AV:N/AC:L/Au:N/C:P/I:N/A:N",
    cvssV3BaseScore: "6.1",
    cvssV3TemporalScore: "",
    cvssV3Vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N",
    cpe: "",
    vulnPubDate: "-1",
    patchPubDate: "-1",
    pluginPubDate: "1421712000",
    pluginModDate: "1710374400",
    checkType: "remote",
    version: "",
    cve: "",
    bid: "",
    xref: "CWE #327,PCI_DSS #3.2-4.1,NIST #sp800_52-3.1",
    seolDate: "-1",
    pluginText: "<plugin_output>TLSv1.0 is enabled on port 443</plugin_output>",
    dnsName: "app01.internal",
    macAddress: "00:1A:2B:3C:4D:7A",
    netbiosName: "",
    operatingSystem: "Ubuntu 22.04 LTS",
    ips: "192.168.1.30",
    recastRiskRuleComment: "Accepted per legacy system policy",
    acceptRiskRuleComment: "N/A",
    hostUniqueness: "repositoryID,hostUUID",
    hostUUID: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    acrScore: "7.0",
    assetExposureScore: "427",
    family: { id: "1", name: "General", type: "active" },
    repository: { id: "287", name: "Main Repository", description: "", dataFormat: "universal" },
    pluginInfo: "99002 (0/6) TLS Version 1.0 Protocol Detection",
  },
];

const mockSeveritySummary = [
  { severity: { id: "4", name: "Critical" }, count: "12" },
  { severity: { id: "3", name: "High" }, count: "34" },
  { severity: { id: "2", name: "Medium" }, count: "89" },
  { severity: { id: "1", name: "Low" }, count: "156" },
  { severity: { id: "0", name: "Info" }, count: "423" },
];

const mockFamilySummary = [
  { family: { name: "Web Servers" }, count: "45" },
  { family: { name: "Windows" }, count: "38" },
  { family: { name: "General" }, count: "112" },
  { family: { name: "CGI abuses" }, count: "23" },
  { family: { name: "Databases" }, count: "17" },
  { family: { name: "SMTP problems" }, count: "8" },
  { family: { name: "Misc." }, count: "31" },
  { family: { name: "Code Execution" }, count: "14" },
  { family: { name: "SNMP" }, count: "9" },
];

const mockIpSummary = [
  { ip: "192.168.1.10", count: "18", severityCritical: "3", severityHigh: "5", severityMedium: "6", severityLow: "4" },
  { ip: "192.168.1.20", count: "12", severityCritical: "1", severityHigh: "4", severityMedium: "5", severityLow: "2" },
  { ip: "192.168.1.30", count: "14", severityCritical: "0", severityHigh: "3", severityMedium: "7", severityLow: "4" },
  { ip: "192.168.1.40", count: "24", severityCritical: "6", severityHigh: "8", severityMedium: "7", severityLow: "3" },
  { ip: "192.168.1.50", count: "5", severityCritical: "0", severityHigh: "0", severityMedium: "1", severityLow: "4" },
  { ip: "192.168.1.60", count: "9", severityCritical: "1", severityHigh: "4", severityMedium: "3", severityLow: "1" },
  { ip: "192.168.1.70", count: "7", severityCritical: "0", severityHigh: "2", severityMedium: "3", severityLow: "2" },
  { ip: "192.168.1.80", count: "15", severityCritical: "4", severityHigh: "5", severityMedium: "4", severityLow: "2" },
  { ip: "192.168.1.90", count: "3", severityCritical: "0", severityHigh: "0", severityMedium: "0", severityLow: "3" },
  { ip: "10.0.0.15", count: "9", severityCritical: "2", severityHigh: "3", severityMedium: "2", severityLow: "2" },
  { ip: "10.0.0.25", count: "6", severityCritical: "0", severityHigh: "1", severityMedium: "3", severityLow: "2" },
];

const mockPortSummary = [
  { port: "443", count: "89", protocol: "TCP" },
  { port: "80", count: "67", protocol: "TCP" },
  { port: "22", count: "45", protocol: "TCP" },
  { port: "3389", count: "34", protocol: "TCP" },
  { port: "8080", count: "28", protocol: "TCP" },
  { port: "25", count: "15", protocol: "TCP" },
  { port: "5432", count: "12", protocol: "TCP" },
  { port: "161", count: "12", protocol: "UDP" },
  { port: "53", count: "9", protocol: "UDP" },
  { port: "0", count: "45", protocol: "TCP" },
];

const mockProtocolSummary = [
  { protocol: "TCP", count: "312" },
  { protocol: "UDP", count: "56" },
  { protocol: "ICMP", count: "18" },
];

const mockOsList = [
  { operatingSystem: "Windows Server 2019", count: "24" },
  { operatingSystem: "Ubuntu 22.04 LTS", count: "18" },
  { operatingSystem: "CentOS 7", count: "15" },
  { operatingSystem: "Red Hat Enterprise Linux 8", count: "12" },
  { operatingSystem: "Debian 11", count: "7" },
  { operatingSystem: "Windows Server 2016", count: "4" },
  { operatingSystem: "Cisco IOS 15.2", count: "3" },
  { operatingSystem: "HP LaserJet Printer", count: "2" },
];

const mockServicesList = [
  { name: "HTTPS", port: "443", protocol: "TCP", count: "42" },
  { name: "HTTP", port: "80", protocol: "TCP", count: "38" },
  { name: "SSH", port: "22", protocol: "TCP", count: "31" },
  { name: "RDP", port: "3389", protocol: "TCP", count: "18" },
  { name: "DNS", port: "53", protocol: "UDP", count: "12" },
  { name: "SMTP", port: "25", protocol: "TCP", count: "8" },
  { name: "PostgreSQL", port: "5432", protocol: "TCP", count: "6" },
  { name: "SNMP", port: "161", protocol: "UDP", count: "5" },
];

const mockSoftwareList = [
  { name: "OpenSSL 1.1.1", count: "34", softwareCPE: "cpe:/a:openssl:openssl:1.1.1" },
  { name: "Apache 2.4.52", count: "22", softwareCPE: "cpe:/a:apache:http_server:2.4.52" },
  { name: "nginx 1.24", count: "18", softwareCPE: "cpe:/a:nginx:nginx:1.24" },
  { name: "PostgreSQL 15.4", count: "12", softwareCPE: "cpe:/a:postgresql:postgresql:15.4" },
  { name: "OpenSSH 8.9", count: "28", softwareCPE: "cpe:/a:openbsd:openssh:8.9" },
  { name: "PHP 8.2", count: "9", softwareCPE: "cpe:/a:php:php:8.2" },
  { name: "Jenkins 2.401", count: "3", softwareCPE: "cpe:/a:jenkins:jenkins:2.401" },
  { name: "Log4j 2.14.1", count: "4", softwareCPE: "cpe:/a:apache:log4j:2.14.1" },
];

const mockCveSummary = [
  { cveID: "CVE-2021-44228", count: "8", severity: { name: "Critical" } },
  { cveID: "CVE-2023-44487", count: "12", severity: { name: "High" } },
  { cveID: "CVE-2023-38408", count: "6", severity: { name: "High" } },
  { cveID: "CVE-2019-0708", count: "5", severity: { name: "Critical" } },
  { cveID: "CVE-2024-23897", count: "3", severity: { name: "High" } },
  { cveID: "CVE-2023-5868", count: "7", severity: { name: "Medium" } },
  { cveID: "CVE-2021-45046", count: "4", severity: { name: "Critical" } },
  { cveID: "CVE-2023-45802", count: "9", severity: { name: "Medium" } },
];

const mockPluginSummary = [
  { pluginID: "98120", pluginName: "Code Injection", count: "18", severity: { name: "Critical" }, family: { name: "Code Execution" } },
  { pluginID: "34477", pluginName: "OpenSSH < 9.0 Multiple Vulnerabilities", count: "12", severity: { name: "High" }, family: { name: "Misc." } },
  { pluginID: "11219", pluginName: "Apache HTTP Server < 2.4.58", count: "22", severity: { name: "Medium" }, family: { name: "Web Servers" } },
  { pluginID: "56984", pluginName: "Microsoft RDP BlueKeep", count: "5", severity: { name: "Critical" }, family: { name: "Windows" } },
  { pluginID: "45123", pluginName: "Jenkins < 2.426 RCE", count: "3", severity: { name: "High" }, family: { name: "CGI abuses" } },
  { pluginID: "23456", pluginName: "Apache Log4j < 2.17.0 RCE", count: "4", severity: { name: "Critical" }, family: { name: "Web Servers" } },
  { pluginID: "89012", pluginName: "OS Identification", count: "45", severity: { name: "Info" }, family: { name: "General" } },
];

const mockRemediationSummary = [
  { solution: "Upgrade OpenSSH to version 9.0 or later", hostTotal: "28", vulnTotal: "35" },
  { solution: "Upgrade to Apache version 2.4.58 or later", hostTotal: "22", vulnTotal: "28" },
  { solution: "Apply Microsoft security update for CVE-2019-0708", hostTotal: "15", vulnTotal: "24" },
  { solution: "Upgrade to Apache Log4j 2.17.0 or later", hostTotal: "8", vulnTotal: "12" },
  { solution: "Upgrade to PostgreSQL 16.1 or later", hostTotal: "12", vulnTotal: "14" },
  { solution: "Enable TLS 1.2+ and disable TLS 1.0", hostTotal: "18", vulnTotal: "22" },
  { solution: "Upgrade Jenkins to version 2.426 or later", hostTotal: "3", vulnTotal: "3" },
];

const mockDnsSummary = [
  { dnsName: "web01.internal", count: "24" },
  { dnsName: "db01.internal", count: "18" },
  { dnsName: "app01.internal", count: "15" },
  { dnsName: "ci01.internal", count: "12" },
  { dnsName: "mail01.internal", count: "9" },
  { dnsName: "api01.internal", count: "21" },
  { dnsName: "win01.internal", count: "8" },
  { dnsName: "db02.internal", count: "7" },
  { dnsName: "vpn01.internal", count: "6" },
  { dnsName: "printer01.internal", count: "3" },
  { dnsName: "switch01.internal", count: "5" },
];

// Generate static trend mock data relative to current date for stability
const mockTrend = (() => {
  const now = new Date();
  const months: Record<string, any>[] = [];
  // Use a fixed seed-like approach for stable random-ish values
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const base = 250 + (i * 15);
    const crit = 5 + (i % 3);
    const high = 20 + (i % 5);
    const med = 60 + (i % 7);
    months.push({ date: label, count: String(base), critical: String(crit), high: String(high), medium: String(med) });
  }
  return months;
})();

// Mock data for demo mode (when backend is not available)
export function getMockData(tool: string): Record<string, any>[] {
  switch (tool) {
    case "sumseverity": return mockSeveritySummary;
    case "sumfamily": return mockFamilySummary;
    case "sumip": return mockIpSummary;
    case "sumport": return mockPortSummary;
    case "sumprotocol": return mockProtocolSummary;
    case "listos": return mockOsList;
    case "listservices": return mockServicesList;
    case "listsoftware": return mockSoftwareList;
    case "sumcve": return mockCveSummary;
    case "sumid": return mockPluginSummary;
    case "sumremediation": return mockRemediationSummary;
    case "sumdnsname": return mockDnsSummary;
    case "trend": return mockTrend;
    default: return MOCK_LISTVULN;
  }
}
