export const dashboardSeries = [
  { month: "Jan", revenue: 32000, projects: 8 },
  { month: "Feb", revenue: 45000, projects: 10 },
  { month: "Mar", revenue: 52000, projects: 12 },
  { month: "Apr", revenue: 48000, projects: 11 },
  { month: "May", revenue: 61000, projects: 15 },
  { month: "Jun", revenue: 67000, projects: 16 },
];

export const activityFeed = [
  { id: "1", actor: "Aom", action: "approved invoice INV-1029", at: "2026-03-17T09:24:00.000Z" },
  { id: "2", actor: "Nop", action: "uploaded contract PDF", at: "2026-03-17T08:47:00.000Z" },
  { id: "3", actor: "Ploy", action: "updated project Solar Alpha", at: "2026-03-17T08:20:00.000Z" },
  { id: "4", actor: "IT Ops", action: "enabled Billing module", at: "2026-03-17T07:59:00.000Z" },
];

export const customers = [
  { id: "C-001", name: "Bangkok Medical Group", email: "procurement@bmg.co.th", phone: "+66-2-100-1000", status: "active" },
  { id: "C-002", name: "SmartLogix", email: "ops@smartlogix.io", phone: "+66-2-200-2000", status: "active" },
  { id: "C-003", name: "Nova Retail", email: "admin@novaretail.com", phone: "+66-2-300-3000", status: "prospect" },
];

export const projectBoard = {
  todo: [
    { id: "P-100", name: "ERP rollout", owner: "Team A", due: "2026-04-01" },
    { id: "P-101", name: "Warehouse IoT", owner: "Team B", due: "2026-04-15" },
  ],
  doing: [{ id: "P-102", name: "CRM migration", owner: "Team C", due: "2026-03-28" }],
  done: [{ id: "P-090", name: "Security audit", owner: "IT", due: "2026-03-10" }],
};

export const jobs = [
  { id: "J-001", title: "Prepare invoice package", assignee: "Mint", priority: "High", status: "In Progress" },
  { id: "J-002", title: "Call vendor for PO", assignee: "Pim", priority: "Medium", status: "Todo" },
  { id: "J-003", title: "Review policy draft", assignee: "Korn", priority: "Low", status: "Done" },
];

export const invoices = [
  { id: "INV-1029", customer: "Bangkok Medical Group", amount: 1450000, status: "Pending" },
  { id: "INV-1030", customer: "SmartLogix", amount: 840000, status: "Paid" },
];

export const purchaseOrders = [
  { id: "PO-401", vendor: "Cloud Infra Co.", amount: 350000, status: "Awaiting Approval" },
  { id: "PO-402", vendor: "Hardware Direct", amount: 920000, status: "Approved" },
];

export const approvals = [
  {
    id: "AP-001",
    entity: "Purchase Order PO-401",
    level: 2,
    requester: "Pim",
    approver: "Manager Tan",
    status: "Pending",
    history: ["Level 1 approved by Head Nida", "Level 2 waiting Manager Tan"],
  },
  {
    id: "AP-002",
    entity: "Invoice Discount INV-1029",
    level: 3,
    requester: "Mint",
    approver: "CEO",
    status: "Pending",
    history: ["Level 1 approved", "Level 2 approved", "Level 3 waiting CEO"],
  },
];

export const users = [
  { id: "U-001", name: "CEO Somchai", email: "ceo@sstinnovation.co.th", role: "CEO", department: "Executive" },
  { id: "U-002", name: "Tan", email: "tan@sstinnovation.co.th", role: "MANAGER", department: "Operations" },
  { id: "U-003", name: "Nida", email: "nida@sstinnovation.co.th", role: "HEAD", department: "Finance" },
  { id: "U-004", name: "Mint", email: "mint@sstinnovation.co.th", role: "STAFF", department: "Sales" },
  { id: "U-005", name: "IT Ops", email: "it@sstinnovation.co.th", role: "IT", department: "Technology" },
];

export const documents = [
  { id: "D-001", title: "Master Service Agreement", type: "application/pdf", signed: true, uploader: "Nida" },
  { id: "D-002", title: "Purchase Contract 2026", type: "application/pdf", signed: false, uploader: "Mint" },
];

export const defaultFeatureFlags = [
  { id: "8f1f2a51-8b26-4f75-8d3a-3a2f6ea2b8d1", key: "dashboard", module: "dashboard", enabled: true, description: "Main KPI dashboard" },
  { id: "84ebed5d-5683-4be3-a849-ddd95f5938b4", key: "crm", module: "crm", enabled: true, description: "Customer management" },
  { id: "9fcd852f-e7ff-4950-9fc2-52563f7eaf43", key: "projects", module: "projects", enabled: true, description: "Projects module" },
  { id: "d3347348-37fa-4a4b-ad74-f5304af35fd2", key: "jobs", module: "jobs", enabled: true, description: "Task tracking" },
  { id: "8f4f9e9d-c04e-43dd-8c8d-3aff342a2e2d", key: "billing", module: "billing", enabled: true, description: "Billing and PO" },
  { id: "7a9e58cb-df17-46e6-abca-31e241d815c3", key: "documents", module: "documents", enabled: true, description: "Document center" },
  { id: "a8ed22f9-f042-4b75-8603-529f05038688", key: "approvals", module: "approvals", enabled: true, description: "Approval workflow" },
  { id: "92d8e90f-f6f4-4089-90f1-8490f6ac8ad3", key: "admin", module: "admin", enabled: true, description: "User administration" },
  { id: "ca7e0096-3f24-411f-9f27-ea8e97cc59f5", key: "it-panel", module: "it-panel", enabled: true, description: "IT control panel" },
];

export const apiConfigs = [
  {
    id: "API-001",
    name: "ERP Gateway",
    base_url: "https://api.example-erp.com",
    is_active: true,
    headers: { "X-Client": "sst" },
  },
];
