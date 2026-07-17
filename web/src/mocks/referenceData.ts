export type NavItem = {
  label: string;
  path: string;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export type Metric = {
  value: string;
  label: string;
  meta?: string;
  tone?: "red" | "amber" | "green" | "blue";
};

export type TableData = {
  headers: string[];
  rows: string[][];
  footer?: string;
};

export type CampaignCard = {
  title: string;
  status: string;
  tone: "green" | "gray";
  messages: string;
  domains: string;
  since: string;
  tags: string[];
};

export const publicNav: NavItem[] = [
  { label: "How It Works", path: "#" },
  { label: "About", path: "#" },
  { label: "Research", path: "#" },
];

export const publicMetrics: Metric[] = [
  { value: "14,892+", label: "Messages Analyzed" },
  { value: "1,247+", label: "Smishing Detected" },
  { value: "31", label: "Active Campaign Clusters" },
];

export const workflowSteps = [
  "Submission",
  "Verification",
  "Proposal",
  "Payment",
  "Activation",
];

export const clientSidebar: NavSection[] = [
  {
    items: [
      { label: "Overview", path: "/client/overview" },
      { label: "Messages", path: "/client/messages" },
      { label: "Campaigns", path: "/client/campaigns" },
      { label: "Analytics", path: "/client/analytics" },
      { label: "Export Reports", path: "/client/export" },
      { label: "Help", path: "/client/help" },
      { label: "Account Settings", path: "/client/settings" },
    ],
  },
];

export const adminSidebar: NavSection[] = [
  { items: [{ label: "Overview", path: "/admin/overview" }] },
  { title: "USER REPORTS", items: [{ label: "User Reports", path: "/admin/reports" }] },
  {
    title: "MODEL",
    items: [
      { label: "Model Performance", path: "/admin/model" },
      { label: "Concept Drift", path: "/admin/concept-drift" },
      { label: "Dataset Mgmt", path: "/admin/dataset" },
    ],
  },
  {
    title: "CLASSIFICATION",
    items: [
      { label: "Classification Log", path: "/admin/classification" },
      { label: "FP / FN Review", path: "/admin/fpfn" },
    ],
  },
  {
    title: "CAMPAIGNS",
    items: [
      { label: "All Campaigns", path: "/admin/campaigns" },
      { label: "Campaign Timeline", path: "/admin/timeline" },
    ],
  },
  { title: "CLIENTS", items: [{ label: "Registered Users", path: "/admin/users" }] },
  { title: "EXPORTS", items: [{ label: "Export Hub", path: "/admin/export" }] },
  {
    title: "SYSTEM",
    items: [
      { label: "Server Monitoring", path: "/admin/server" },
      { label: "API Logs", path: "/admin/api-logs" },
      { label: "DB Storage", path: "/admin/db-storage" },
    ],
  },
  { title: "CONTENT", items: [{ label: "Scam Tips", path: "/admin/tips" }] },
];

export const clientOverviewMetrics: Metric[] = [
  { value: "14,892", label: "Reports Received", meta: "+372 today" },
  { value: "1,247", label: "Likely Smishing", meta: "+23 today", tone: "red" },
  { value: "389", label: "Suspicious", meta: "+8 today", tone: "amber" },
  { value: "203", label: "Confirmed Blocked", tone: "green" },
];

export const weeklyBars = [
  { label: "Mon", value: 20 },
  { label: "Tue", value: 38 },
  { label: "Wed", value: 56 },
  { label: "Thu", value: 82 },
  { label: "Fri", value: 96, tone: "red" as const },
  { label: "Sat", value: 72 },
  { label: "Sun", value: 0 },
];

export const threatFeed = [
  ["Operation GCash Clon...", "Critical"],
  ["BDO OTP Harvester W...", "Critical"],
  ["LBC Parcel Delivery S...", "Suspicious"],
  ["Shopee Prize Lure #11", "Suspicious"],
  ["PLDT Bill Impersonati...", "Critical"],
];

export const campaigns: CampaignCard[] = [
  {
    title: "Operation GCash Clone #17",
    status: "Active",
    tone: "green",
    messages: "382",
    domains: "4",
    since: "May 11",
    tags: ["Prize Lure", "Fake Domain", "Taglish Wording"],
  },
  {
    title: "BDO Fake Support Wave #5",
    status: "Active",
    tone: "green",
    messages: "148",
    domains: "2",
    since: "May 9",
    tags: ["Urgency Tactics", "OTP Harvesting", "Brand Impersonation"],
  },
  {
    title: "LBC Parcel Delivery Scam #8",
    status: "Active",
    tone: "green",
    messages: "97",
    domains: "3",
    since: "May 8",
    tags: ["Fake Domain", "Shortened URL", "Urgency Tactics"],
  },
];

export const clientMessages: TableData = {
  headers: ["MSG ID", "SENDER", "PREVIEW", "CAMPAIGN", "CONFIDENCE", "STATUS", "TIMESTAMP", ""],
  rows: [
    ["#MSG-4821", "+63 908 000 1234", "Your GCash account has been flagged. Verify now at gcash-ph-support.net/...", "Op. GCash Clone #17", "94%", "Smishing", "May 13, 9:01 AM", "View ---"],
    ["#MSG-4820", "+63 917 231 5500", "Congratulations! You've been selected for a P5,000 GCash reward. Claim at...", "Op. GCash Clone #17", "91%", "Smishing", "May 13, 8:47 AM", "View ---"],
    ["#MSG-4819", "+63 2 8631 8000", "You have a pending transaction of P12,500. Tap to review and confirm.", "BDO Fake Support #5", "68%", "Suspicious", "May 13, 8:33 AM", "View ---"],
    ["#MSG-4818", "+63 919 100 4567", "Ang inyong BDO account ay nangangailangan ng verification. Mag-click dto...", "BDO Fake Support #5", "89%", "Smishing", "May 13, 8:20 AM", "View ---"],
    ["#MSG-4817", "+63 927 888 3210", "URGENT: Your LBC parcel #PH8812 is held at customs. Pay release fee at...", "LBC Parcel Scam #8", "96%", "Smishing", "May 13, 7:58 AM", "View ---"],
    ["#MSG-4816", "+63 908 111 2222", "Your PLDT bill of P1,899 is overdue. Avoid disconnection --- pay now at...", "PLDT Impersonation #4", "82%", "Smishing", "May 13, 7:44 AM", "View ---"],
    ["#MSG-4815", "+63 955 321 0099", "SHOPEE NOTICE: Your prize of P10,000 is waiting! Claim within 24 hours.", "Shopee Prize Lure #11", "88%", "Smishing", "May 13, 7:12 AM", "View ---"],
    ["#MSG-4814", "+63 917 000 5544", "Meralco disconnection notice: Your account balance is overdue.", "Meralco Threat #2", "71%", "Suspicious", "May 13, 6:30 AM", "View ---"],
    ["#MSG-4812", "+63 908 777 3321", "Congratulations! You won a P5,000 Shopee voucher. Tap link to claim.", "Shopee Prize Lure #11", "85%", "Smishing", "May 13, 5:58 AM", "View ---"],
    ["#MSG-4812", "+63 932 441 8000", "GCash Security Alert: Unusual login from new device. Verify immediately.", "Op. GCash Clone #17", "93%", "Smishing", "May 13, 5:21 AM", "View ---"],
  ],
  footer: "Showing 1-10 of 14,892 results",
};

export const clientCampaignColumns = {
  active: [
    { ...campaigns[0], messages: "142,847" },
    { ...campaigns[1], messages: "84,291" },
    { ...campaigns[2], messages: "67,128" },
    {
      title: "PLDT Bill Impersonation #4",
      status: "Active",
      tone: "green" as const,
      messages: "43,912",
      domains: "1",
      since: "May 7",
      tags: ["Account Notice"],
    },
  ],
  inactive: [
    {
      title: "BDO OTP Harvester Wave #3",
      status: "Inactive",
      tone: "gray" as const,
      messages: "18,920",
      domains: "2",
      since: "Apr 22",
      tags: ["OTP Harvesting"],
    },
    {
      title: "Piso Fare Lure #6",
      status: "Inactive",
      tone: "gray" as const,
      messages: "12,456",
      domains: "1",
      since: "Apr 15",
      tags: ["Prize Lure"],
    },
    {
      title: "Shopee Flash Sale Scam #9",
      status: "Inactive",
      tone: "gray" as const,
      messages: "9,843",
      domains: "2",
      since: "Apr 10",
      tags: ["Fake Domain"],
    },
    {
      title: "Landline OTP Intercept #1",
      status: "Inactive",
      tone: "gray" as const,
      messages: "7,231",
      domains: "2",
      since: "Apr 8",
      tags: ["OTP Harvesting"],
    },
  ],
};

export const analyticsBreakdown = [
  ["Suspicious Shortened URLs", "90%", "red"],
  ["Fake Domain Usage", "84%", "red"],
  ["Brand Impersonation (GCash)", "79%", "red"],
  ["Prize / Reward Lure Language", "71%", "amber"],
  ["Urgency Pressure Wording", "65%", "amber"],
  ["Taglish Code-Switching", "57%", "amber"],
  ["Unknown Sender Number", "48%", "amber"],
] as const;

export const analyticsVariants = [
  ["Variant A", "Your GCash account has been flagged for suspicious activity...", "97.4%", "red"],
  ["Variant B", "\"GCASH NOTICE: Unusual login detected. Secure your account...\"", "89.1%", "red"],
  ["Variant C", "\"Congratulations! Your GCash wallet has been selected for...\"", "81.7%", "amber"],
] as const;

export const exportReports: TableData = {
  headers: ["FILENAME", "TYPE", "DATE", "RECORDS", "SIZE", "STATUS", ""],
  rows: [
    ["classification-log-may13.csv", "Full Log", "May 13, 2026", "12,847 records", "2.4 MB", "Complete", "dl"],
    ["campaign-report-may10.csv", "Campaign", "May 10, 2026", "1,247 records", "340 KB", "Complete", "dl"],
    ["custom-export-may8.csv", "Custom Range", "May 8, 2026", "3,420 records", "880 KB", "Complete", "dl"],
    ["weekly-report-may5.pdf", "Summary PDF", "May 5, 2026", "1 report", "1.1 MB", "Complete", "dl"],
    ["full-dataset-apr30.csv", "Dataset", "Apr 30, 2026", "18,001 records", "4.8 MB", "Complete", "dl"],
  ],
};

export const helpFaqs = [
  ["What does the Confidence score mean?", "The confidence score (0-100%) reflects the model's certainty that a message is smishing. Scores above 80% are flagged as Likely Smishing; 50-79% are Suspicious. Scores below 50% are generally treated as Unknown / Safe."],
  ["What is a Campaign?", "A campaign is a coordinated cluster of smishing messages that share similar patterns --- same fake domain, brand, or phrasing. BantAI groups related messages into named campaigns so you can track them over time."],
  ["Can I export my data?", "Yes. Go to Export Reports to download your classification log as CSV. Exports are scoped to your organization and do not include raw sender numbers."],
  ["How do I interpret the Analytics page?", "The analytics page shows pattern breakdowns per campaign. Use the campaign selector to switch context. The progress bars show how frequently each evasion tactic appears in that cluster's messages."],
  ["Why do some messages show \"Suspicious\" instead of \"Smishing\"?", "Suspicious messages contain some smishing indicators but not enough for a high-confidence classification. They are included in your log so your team can manually review borderline cases."],
  ["How often is the data updated?", "Classifications are processed in near real-time as BantAI app users submit reports. Campaign clusters are updated daily. Your dashboard refreshes data as alerts are pushed."],
];

export const notifications = [
  ["New Campaign Detected", "\"Operation Maya Wallet Clone #3\" --- 47 messages flagged targeting your subscribers", "2m ago", "red"],
  ["Campaign Reactivated", "\"BDO OTP Harvester Wave #2\" has resurfaced after 18 days of inactivity", "38m ago", "amber"],
  ["Daily Report --- May 13", "312 reports processed today - 23 confirmed smishing - 8 suspicious flagged", "6h ago", "blue"],
  ["Weekly Report Ready", "Your threat intelligence summary for May 7-13 is ready for download", "1d ago", "blue"],
] as const;

export const adminOverviewMetrics: Metric[] = [
  { value: "14,892", label: "Reports Received", meta: "+372 today" },
  { value: "1,247", label: "Likely Smishing", tone: "red" },
  { value: "312", label: "Pending Reports", tone: "amber" },
  { value: "8,421", label: "Registered Users", tone: "green" },
];

export const adminReports: TableData = {
  headers: ["REPORT ID", "USER", "PREVIEW", "CAMPAIGN", "CATEGORY", "SUBMITTED AT", "STATUS", ""],
  rows: [
    ["#RPT-0912", "user_4821", "Your GCash account has been flagged. Verify now at gcash-ph...", "Op. GCash Clone #17", "Smishing / Fake Domain", "May 13 9:01 AM", "Pending", "Review"],
    ["#RPT-0911", "user_3340", "Congratulations! You've won a P5,000 GCash reward. Claim at...", "Op. GCash Clone #17", "Smishing / Prize Lure", "May 13 8:47 AM", "Pending", "Review"],
    ["#RPT-0910", "user_7102", "Your PLDT bill is overdue. Pay now to avoid disconnection.", "PLDT Impersonation #4", "Smishing / Urgency", "May 13 8:30 AM", "Validated", "View ---"],
    ["#RPT-0909", "user_2211", "Ang inyong BDO account ay nangangailangan ng verification.", "BDO Fake Support #5", "Smishing / Brand Impersonation", "May 13 7:55 AM", "Validated", "View ---"],
    ["#RPT-0908", "user_8830", "URGENT: LBC parcel held at customs. Pay release fee.", "LBC Parcel Scam #8", "Smishing / Fake Domain", "May 13 7:40 AM", "Pending", "Review"],
    ["#RPT-0907", "user_4401", "Meralco disconnection notice for your account.", "Meralco Threat #2", "Suspicious / Urgency", "May 13 6:50 AM", "Rejected", "View ---"],
    ["#RPT-0906", "user_9912", "SHOPEE: Your P10,000 prize is waiting. Claim within 24h.", "Shopee Prize Lure #11", "Smishing / Prize Lure", "May 13 6:20 AM", "Pending", "Review"],
  ],
  footer: "Showing 1-7 of 847 results",
};

export const classificationLog: TableData = {
  headers: ["LOG ID", "DEVICE", "SENDER", "LANG", "PREVIEW", "CLASSIFICATION", "CONFIDENCE", "CAMPAIGN", "FLAG", "REVIEWER", "TIMESTAMP", ""],
  rows: [
    ["#LOG-4821", "device_7f3a", "+63 908 000 1234", "Taglish", "Your GCash account has been flagged...", "Smishing", "94%", "Op. GCash Clone #17", "---", "admin_gio", "May 13 09:01", "Inspect"],
    ["#LOG-4820", "device_3b21", "+63 917 231 5500", "Taglish", "You've been selected for a P5,000 reward...", "Smishing", "91%", "Op. GCash Clone #17", "---", "---", "May 13 08:47", "Inspect"],
    ["#LOG-4819", "device_c99a", "+63 2 8631 8000", "English", "You have a pending transaction of P12,500...", "Suspicious", "68%", "BDO Fake Support #5", "---", "---", "May 13 08:33", "Inspect"],
    ["#LOG-4818", "device_d4f1", "+63 919 100 4567", "Filipino", "Ang inyong BDO account ay...", "Smishing", "89%", "BDO Fake Support #5", "---", "---", "May 13 08:20", "Inspect"],
    ["#LOG-4817", "device_8e44", "+63 927 888 3210", "English", "URGENT: Your LBC parcel is held...", "Smishing", "96%", "LBC Parcel Scam #8", "---", "---", "May 13 07:58", "Inspect"],
    ["#LOG-4816", "device_2f77", "PLDT Home", "English", "Your PLDT bill payment is due...", "FP", "71%", "---", "FP", "admin_gio", "May 13 07:40", "Inspect"],
    ["#LOG-4815", "device_3b24", "GCash", "English", "You have successfully loaded P100...", "FP", "55%", "---", "FP", "admin_gio", "May 13 07:03", "Inspect"],
  ],
  footer: "Showing 1-7 of 14,892 results",
};

export const fpfnReview: TableData = {
  headers: ["ID", "SENDER", "MESSAGE PREVIEW", "CLASSIFICATION", "CONFIDENCE", "REPORTED BY", "DATE", "STATUS", ""],
  rows: [
    ["FP-041", "PLDT Home", "\"Your GoSURF50 promo is about to expire. Renew now to continue browsing.\"", "Smishing", "71%", "user_3421", "May 12", "Pending", "Review ---"],
    ["FP-040", "GCash", "\"You have successfully sent P100 to Juan dela Cruz.\"", "Smishing", "55%", "user_7891", "May 11", "Pending", "Review ---"],
    ["FP-039", "BPI Direct", "\"Your BPI savings account statement is now available.\"", "Suspicious", "62%", "user_2201", "May 10", "Resolved", "View ---"],
  ],
};

export const exportHubHistory: TableData = {
  headers: ["FILENAME", "TYPE", "DATE GENERATED", "RECORDS", "SIZE", "STATUS", ""],
  rows: [
    ["classification-log-may13.csv", "Full Log", "May 13, 2026", "12,847 records", "2.4 MB", "Complete", "dl"],
    ["globe-export-may10.csv", "Client Export (Globe)", "May 10, 2026", "1,247 records", "340 KB", "Complete", "dl"],
    ["full-dataset-may8.csv", "Training Dataset", "May 8, 2026", "18,420 records", "4.8 MB", "Complete", "dl"],
    ["audit-log-may5.csv", "Audit Log", "May 5, 2026", "892 entries", "1.1 MB", "Complete", "dl"],
  ],
};

export const usersTable: TableData = {
  headers: ["USER ID", "REGION", "JOINED", "LAST ACTIVE", "REPORTS", "SCANNED", "STATUS"],
  rows: [
    ["user_4821", "Metro Manila", "Mar 12, 2026", "May 13", "14 reports", "2,847 scanned", "Active"],
    ["user_3340", "Cebu", "Apr 2, 2026", "May 12", "7 reports", "1,204 scanned", "Active"],
    ["user_7102", "Davao", "Jan 8, 2026", "May 10", "2 reports", "893 scanned", "Active"],
    ["user_1029", "Metro Manila", "Feb 20, 2026", "Apr 30", "0 reports", "1,547 scanned", "Inactive"],
    ["user_5512", "Laguna", "Mar 5, 2026", "May 11", "3 reports", "412 scanned", "Active"],
    ["user_9901", "Quezon City", "Apr 18, 2026", "May 13", "1 report", "234 scanned", "Active"],
  ],
  footer: "Showing 1-6 of 8,421 results",
};

export const apiLogs: TableData = {
  headers: ["TIMESTAMP", "ENDPOINT", "STATUS", "LATENCY", "CLIENT"],
  rows: [
    ["May 14 08:12", "POST /api/v1/classify", "200 OK", "142ms", "Globe Telecom"],
    ["May 14 08:11", "GET /api/v1/campaigns", "200 OK", "86ms", "Smart Comms"],
  ],
};

export const dbStorage: TableData = {
  headers: ["TABLE NAME", "ROW COUNT", "SIZE", "INDEXES", "LAST WRITE"],
  rows: [
    ["messages", "18,420", "4.2 GB", "6", "14s ago"],
    ["campaigns", "31", "840 KB", "3", "4m ago"],
    ["users", "2,847", "92 MB", "4", "9m ago"],
    ["reports", "312", "18 MB", "2", "2m ago"],
  ],
};

export const scamTips: TableData = {
  headers: ["#", "TITLE", "CATEGORY", "LANGUAGE", "STATUS", "LAST EDITED", "ACTIONS"],
  rows: [
    ["1", "Never share your OTP with anyone", "OTP Safety", "English", "Published", "May 10", "Edit Delete"],
    ["2", "Huwag i-click ang mga link mula sa hindi kilalang number", "Link Safety", "Tagalog", "Published", "May 9", "Edit Delete"],
    ["3", "How to identify fake GCash domains", "Fake Domains", "English", "Published", "May 8", "Edit Delete"],
    ["4", "Recognizing urgency pressure tactics in scam messages", "General", "English", "Published", "May 7", "Edit Delete"],
    ["5", "Taglish scam detection guide", "General", "Taglish", "Draft", "May 13", "Edit Publish Delete"],
  ],
};
