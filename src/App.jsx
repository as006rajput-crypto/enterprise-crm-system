import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/leads";
const HEALTH_URL = "http://localhost:5000/api/health";

const statuses = ["New", "Contacted", "Qualified", "Won", "Lost"];

const navItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Leads", icon: "♙" },
  { name: "Customers", icon: "♧" },
  { name: "Deals", icon: "◇" },
  { name: "Analytics", icon: "▥" },
];

const emptyForm = {
  name: "",
  company: "",
  email: "",
  status: "New",
  followUpAt: "",
  followUpNotes: "",
  dealValue: "0",
};

function normalizeLead(lead) {
  return {
    ...lead,
    id: lead._id || lead.id,
    name: lead.name || "",
    company: lead.company || "",
    email: lead.email || "",
    status: statuses.includes(lead.status) ? lead.status : "New",
    followUpAt: lead.followUpAt || "",
    followUpNotes: lead.followUpNotes || "",
    dealValue: Number(lead.dealValue) || 0,
  };
}

function getLeadList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.leads)) return payload.leads;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getInitials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getErrorMessage(payload, fallback) {
  return payload?.message || payload?.error || fallback;
}

function getFollowUpState(value) {
  if (!value) return "unscheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unscheduled";

  return date.getTime() < Date.now() ? "overdue" : "upcoming";
}

/* MONTHLY LEAD ACTIVITY CHART */

function MonthlyLeadChart({ monthlyData }) {
  const width = 600;
  const height = 220;
  const paddingX = 12;
  const paddingTop = 16;
  const paddingBottom = 28;

  const maxValue = Math.max(
    4,
    ...monthlyData.map((item) => item.count)
  );

  const scaleMax = Math.ceil(maxValue / 4) * 4;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = monthlyData.map((item, index) => {
    const x =
      monthlyData.length <= 1
        ? width / 2
        : paddingX +
          (index * (width - paddingX * 2)) /
            (monthlyData.length - 1);

    const y =
      paddingTop +
      chartHeight -
      (item.count / scaleMax) * chartHeight;

    return { x, y, ...item };
  });

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${
        height - paddingBottom
      } L ${points[0].x} ${height - paddingBottom} Z`
    : "";

  const gridLevels = [4, 3, 2, 1, 0].map(
    (level) => (scaleMax * level) / 4
  );

  return (
    <div className="chart">
      <div className="chart-y-labels">
        {gridLevels.map((level, index) => (
          <span key={`${level}-${index}`}>{Math.round(level)}</span>
        ))}
      </div>

      <div className="chart-area">
        {gridLevels.map((level, index) => (
          <div
            className="chart-gridline"
            key={`${level}-${index}`}
            style={{ top: `${index * 25}%` }}
          />
        ))}

        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Monthly lead creation chart"
        >
          <defs>
            <linearGradient
              id="leadChartGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#6478ff"
                stopOpacity="0.32"
              />
              <stop
                offset="100%"
                stopColor="#6478ff"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {areaPath && (
            <path d={areaPath} fill="url(#leadChartGradient)" />
          )}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#6478ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {points.map((point) => (
            <circle
              key={point.key}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#6478ff"
              stroke="white"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {point.fullLabel}: {point.count} new leads
              </title>
            </circle>
          ))}
        </svg>

        <div className="chart-months">
          {monthlyData.map((item) => (
            <span key={item.key} title={`${item.count} new leads`}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* LEAD STATUS ANALYTICS */

function LeadStatusAnalytics({ statusCounts, totalLeads }) {
  const statusColors = {
    New: "#3b82f6",
    Contacted: "#f59e0b",
    Qualified: "#8b5cf6",
    Won: "#10b981",
    Lost: "#ef4444",
  };

  return (
    <section className="panel lead-status-analytics">
      <div className="panel-heading">
        <div>
          <h2>Lead Status Analytics</h2>
          <p className="subtitle">
            Live distribution across your sales pipeline
          </p>
        </div>

        <span className="period-tag">{totalLeads} Total Leads</span>
      </div>

      {totalLeads === 0 ? (
        <div className="empty-state compact-empty">
          <strong>No lead data available</strong>
          <p>Add your first lead to start tracking your sales pipeline.</p>
        </div>
      ) : (
        <div className="status-analytics-grid">
          {statusCounts.map(({ status, count }) => {
            const percentage = Math.round((count / totalLeads) * 100);

            return (
              <div className="status-analytics-card" key={status}>
                <div className="status-analytics-top">
                  <span
                    className="status-analytics-dot"
                    style={{ backgroundColor: statusColors[status] }}
                  />
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>

                <div
                  className="status-analytics-track"
                  role="progressbar"
                  aria-label={`${status} leads`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                >
                  <div
                    className="status-analytics-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: statusColors[status],
                    }}
                  />
                </div>

                <div className="status-analytics-bottom">
                  <span>{percentage}% of total leads</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [followUpFilter, setFollowUpFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiConnected, setApiConnected] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadLeads() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(API_URL);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Could not load leads from the server.")
        );
      }

      setLeads(getLeadList(payload).map(normalizeLead));
      setApiConnected(true);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Backend unavailable. Please start the backend server."
      );
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function checkBackendHealth() {
    try {
      const response = await fetch(HEALTH_URL);
      const payload = await response.json().catch(() => ({}));

      setApiConnected(
        response.ok && payload.database === "connected"
      );
    } catch {
      setApiConnected(false);
    }
  }

  useEffect(() => {
    loadLeads();
    checkBackendHealth();
  }, []);

  /* BUSINESS METRICS */

  const totalLeads = leads.length;

  const wonLeads = leads.filter((lead) => lead.status === "Won");
  const lostLeads = leads.filter((lead) => lead.status === "Lost");

  const openDeals = leads.filter(
    (lead) => !["Won", "Lost"].includes(lead.status)
  );

  const contactedLeads = leads.filter((lead) =>
    ["Contacted", "Qualified", "Won"].includes(lead.status)
  );

  const conversionRate = totalLeads
    ? Math.round((wonLeads.length / totalLeads) * 100)
    : 0;

  const wonRevenue = wonLeads.reduce(
    (sum, lead) => sum + lead.dealValue,
    0
  );

  const pipelineValue = openDeals.reduce(
    (sum, lead) => sum + lead.dealValue,
    0
  );

  const totalDealValue = leads.reduce(
    (sum, lead) => sum + lead.dealValue,
    0
  );

  const lostDealValue = lostLeads.reduce(
    (sum, lead) => sum + lead.dealValue,
    0
  );

  const statusCounts = statuses.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length,
  }));

  /* MONTHLY ANALYTICS: LAST SIX MONTHS */

  const monthlyData = useMemo(() => {
    const now = new Date();

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - 5 + index,
        1
      );

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        fullLabel: date.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        }),
        count: 0,
      };
    });

    leads.forEach((lead) => {
      if (!lead.createdAt) return;

      const date = new Date(lead.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const bucket = months.find(
        (month) =>
          month.year === date.getFullYear() &&
          month.month === date.getMonth()
      );

      if (bucket) bucket.count += 1;
    });

    return months;
  }, [leads]);

  const currentMonthCount =
    monthlyData[monthlyData.length - 1]?.count || 0;

  const previousMonthCount =
    monthlyData[monthlyData.length - 2]?.count || 0;

  const monthlyChange = currentMonthCount - previousMonthCount;

  /* FOLLOW-UP REMINDERS */

  const reminders = useMemo(() => {
    return leads
      .filter(
        (lead) =>
          lead.followUpAt &&
          !["Won", "Lost"].includes(lead.status)
      )
      .sort(
        (a, b) =>
          new Date(a.followUpAt).getTime() -
          new Date(b.followUpAt).getTime()
      );
  }, [leads]);

  const overdueReminders = reminders.filter(
    (lead) => getFollowUpState(lead.followUpAt) === "overdue"
  );

  const upcomingReminders = reminders.filter(
    (lead) => getFollowUpState(lead.followUpAt) === "upcoming"
  );

  /* SEARCH AND FILTERS */

  const filteredLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        [
          lead.name,
          lead.company,
          lead.email,
          lead.status,
          lead.followUpNotes,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "All" || lead.status === statusFilter;

      const followUpState = getFollowUpState(lead.followUpAt);

      const matchesFollowUp =
        followUpFilter === "All" ||
        followUpState === followUpFilter;

      let matchesPage = true;

      if (activePage === "Customers") {
        matchesPage = lead.status === "Won";
      } else if (activePage === "Deals") {
        matchesPage = !["Won", "Lost"].includes(lead.status);
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFollowUp &&
        matchesPage
      );
    });
  }, [
    leads,
    searchTerm,
    statusFilter,
    followUpFilter,
    activePage,
  ]);

  /* CREATE AND EDIT */

  function openCreateForm() {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(lead) {
    setEditingId(lead.id);

    setFormData({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      status: lead.status,
      followUpAt: toLocalDateTimeInput(lead.followUpAt),
      followUpNotes: lead.followUpNotes || "",
      dealValue: String(lead.dealValue ?? 0),
    });

    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const isEditing = Boolean(editingId);

      const url = isEditing
        ? `${API_URL}/${encodeURIComponent(editingId)}`
        : API_URL;

      const numericDealValue = Number(formData.dealValue);

      if (
        !Number.isFinite(numericDealValue) ||
        numericDealValue < 0
      ) {
        throw new Error(
          "Deal value must be a valid non-negative amount."
        );
      }

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          company: formData.company.trim(),
          email: formData.email.trim(),
          status: formData.status,
          followUpAt: formData.followUpAt
            ? new Date(formData.followUpAt).toISOString()
            : null,
          followUpNotes: formData.followUpNotes.trim(),
          dealValue: numericDealValue,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            isEditing
              ? "Could not update the lead."
              : "Could not create the lead."
          )
        );
      }

      await loadLeads();
      closeForm();

      setSuccessMessage(
        isEditing
          ? "Lead updated successfully."
          : "New lead added successfully."
      );
    } catch (error) {
      setErrorMessage(
        error.message || "Something went wrong while saving the lead."
      );
    } finally {
      setSaving(false);
    }
  }

  /* UPDATE STATUS */

  async function updateLeadStatus(lead, nextStatus) {
    if (lead.status === nextStatus) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(lead.id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: lead.name,
            company: lead.company,
            email: lead.email,
            status: nextStatus,
            followUpAt: lead.followUpAt || null,
            followUpNotes: lead.followUpNotes || "",
            dealValue: lead.dealValue,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Could not update lead status.")
        );
      }

      setLeads((previous) =>
        previous.map((item) =>
          item.id === lead.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      setSuccessMessage(`Lead status changed to ${nextStatus}.`);
    } catch (error) {
      setErrorMessage(error.message || "Status update failed.");
      await loadLeads();
    }
  }

  /* DELETE LEAD */

  async function deleteLead(lead) {
    if (
      !window.confirm(
        `Are you sure you want to delete ${lead.name || "this lead"}?`
      )
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(lead.id)}`,
        { method: "DELETE" }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Could not delete the lead.")
        );
      }

      setLeads((previous) =>
        previous.filter((item) => item.id !== lead.id)
      );

      setSuccessMessage("Lead deleted successfully.");
    } catch (error) {
      setErrorMessage(error.message || "Delete failed.");
    }
  }

  /* EXPORT CSV */

  function exportCSV() {
    const headers = [
      "Name",
      "Company",
      "Email",
      "Status",
      "Deal Value INR",
      "Follow-up Date",
      "Follow-up Notes",
      "Created At",
    ];

    const rows = leads.map((lead) => [
      lead.name,
      lead.company,
      lead.email,
      lead.status,
      lead.dealValue,
      lead.followUpAt
        ? new Date(lead.followUpAt).toISOString()
        : "",
      lead.followUpNotes,
      lead.createdAt
        ? new Date(lead.createdAt).toISOString()
        : "",
    ]);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `enterprise-crm-leads-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setSuccessMessage(
      `${leads.length} lead record(s) exported to CSV.`
    );
  }

  const pageTitle = {
    Dashboard: "Dashboard",
    Leads: "Lead Management",
    Customers: "Customers",
    Deals: "Open Deals",
    Analytics: "Analytics & Reports",
  }[activePage];

  /* REMINDER PANEL */

  function renderReminderPanel() {
    const items = [
      ...overdueReminders,
      ...upcomingReminders,
    ].slice(0, 6);

    return (
      <section className="panel source-panel reminder-panel">
        <div className="panel-heading">
          <div>
            <h2>Follow-up Reminders</h2>
            <p className="subtitle">
              Scheduled follow-ups for open leads
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActivePage("Leads");
              setStatusFilter("All");
              setFollowUpFilter("All");
              setSearchTerm("");
            }}
          >
            View leads →
          </button>
        </div>

        <div className="reminder-summary">
          <div>
            <strong className="reminder-overdue">
              {overdueReminders.length}
            </strong>
            <span>Overdue</span>
          </div>

          <div>
            <strong className="reminder-upcoming">
              {upcomingReminders.length}
            </strong>
            <span>Upcoming</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state compact-empty">
            <strong>No follow-ups scheduled</strong>
            <p>
              Add a follow-up date when creating or editing a lead.
            </p>
          </div>
        ) : (
          <div className="reminder-list">
            {items.map((lead) => {
              const state = getFollowUpState(lead.followUpAt);

              return (
                <div className="reminder-item" key={lead.id}>
                  <div className="mini-avatar">
                    {getInitials(lead.name)}
                  </div>

                  <div className="reminder-details">
                    <strong>{lead.name}</strong>
                    <span>{formatDateTime(lead.followUpAt)}</span>

                    {lead.followUpNotes && (
                      <p>{lead.followUpNotes}</p>
                    )}
                  </div>

                  <span className={`reminder-badge ${state}`}>
                    {state === "overdue" ? "Overdue" : "Upcoming"}
                  </span>

                  <button
                    type="button"
                    onClick={() => openEditForm(lead)}
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  /* LEADS TABLE */

  function renderLeadTable() {
    if (loading) {
      return (
        <div className="empty-state">
          Loading leads from database...
        </div>
      );
    }

    if (filteredLeads.length === 0) {
      return (
        <div className="empty-state">
          <div style={{ fontSize: 30, marginBottom: 10 }}>♧</div>
          <strong>No leads found</strong>
          <p>
            {leads.length === 0
              ? "Add your first lead to start tracking your CRM activity."
              : "Try changing your search term or filters."}
          </p>

          {activePage !== "Customers" && (
            <button
              type="button"
              className="primary-button"
              onClick={openCreateForm}
            >
              + Add New Lead
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        className="table-wrap"
        style={{
          width: "100%",
          overflowX: "auto",
          display: "block",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 900,
            borderCollapse: "collapse",
            tableLayout: "auto",
            display: "table",
          }}
        >
          <thead>
            <tr style={{ display: "table-row" }}>
              {[
                "Contact",
                "Company",
                "Status",
                "Deal Value",
                "Follow-up",
                "Created",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  style={{
                    display: "table-cell",
                    textAlign: "left",
                    padding: "12px 14px",
                    whiteSpace: "nowrap",
                    verticalAlign: "middle",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredLeads.map((lead) => {
              const followUpState = getFollowUpState(
                lead.followUpAt
              );

              return (
                <tr
                  key={lead.id}
                  style={{ display: "table-row" }}
                >
                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                    }}
                  >
                    <div className="contact-cell">
                      <div className="mini-avatar">
                        {getInitials(lead.name)}
                      </div>

                      <div>
                        <strong>{lead.name || "Unnamed lead"}</strong>
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {lead.email || "No email"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                    }}
                  >
                    {lead.company || "—"}
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                    }}
                  >
                    <select
                      aria-label={`Status for ${lead.name}`}
                      value={lead.status}
                      onChange={(event) =>
                        updateLeadStatus(lead, event.target.value)
                      }
                      style={{
                        display: "inline-block",
                        width: "auto",
                        maxWidth: 140,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #dfe3eb",
                        background: "white",
                        color: "#1f2937",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statuses.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>{formatCurrency(lead.dealValue)}</strong>
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                    }}
                  >
                    {lead.followUpAt ? (
                      <div className="table-followup">
                        <span>{formatDate(lead.followUpAt)}</span>
                        <span
                          className={`reminder-badge ${followUpState}`}
                        >
                          {followUpState === "overdue"
                            ? "Overdue"
                            : "Upcoming"}
                        </span>
                      </div>
                    ) : (
                      <span className="muted-text">
                        Not scheduled
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(lead.createdAt)}
                  </td>

                  <td
                    style={{
                      display: "table-cell",
                      padding: "12px 14px",
                      verticalAlign: "middle",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openEditForm(lead)}
                        aria-label={`Edit ${lead.name}`}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteLead(lead)}
                        aria-label={`Delete ${lead.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /* LEAD LIST PANEL */

  function renderLeadListPanel(title = "Recent Leads") {
    return (
      <section className="panel leads-panel">
        <div className="leads-heading">
          <div>
            <h2>{title}</h2>
            <p className="subtitle">
              {filteredLeads.length} record
              {filteredLeads.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <div className="lead-toolbar">
            <input
              className="search-input"
              type="search"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search leads"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter leads by status"
            >
              <option value="All">All statuses</option>
              {statuses.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={followUpFilter}
              onChange={(event) =>
                setFollowUpFilter(event.target.value)
              }
              aria-label="Filter by follow-up"
            >
              <option value="All">All follow-ups</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
              <option value="unscheduled">Not scheduled</option>
            </select>

            <button type="button" onClick={exportCSV}>
              Export CSV ↓
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={openCreateForm}
            >
              + Add Lead
            </button>
          </div>
        </div>

        {renderLeadTable()}
      </section>
    );
  }

  /* DASHBOARD */

  function renderDashboard() {
    return (
      <>
        <div className="welcome-row">
          <div>
            <div className="eyebrow">OVERVIEW</div>
            <h1>Welcome to your CRM</h1>
            <p className="subtitle">
              Track your leads, customers and sales pipeline in one place.
            </p>
          </div>

          <div className="welcome-actions">
            <button type="button" onClick={exportCSV}>
              Export CSV ↓
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={openCreateForm}
            >
              + Add New Lead
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>Total Leads</span>
              <span className="stat-icon">♙</span>
            </div>
            <h2>{totalLeads}</h2>
            <p className="subtitle">All saved lead records</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Customers Won</span>
              <span className="stat-icon">♧</span>
            </div>
            <h2>{wonLeads.length}</h2>
            <p className="subtitle">Leads marked Won</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Open Deals</span>
              <span className="stat-icon">◇</span>
            </div>
            <h2>{openDeals.length}</h2>
            <p className="subtitle">
              {formatCurrency(pipelineValue)} pipeline value
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Conversion Rate</span>
              <span className="stat-icon">↗</span>
            </div>
            <h2>{conversionRate}%</h2>
            <p className="subtitle">Won leads ÷ total leads</p>
          </div>
        </div>

        <div className="stats-grid financial-stats">
          <div className="stat-card">
            <div className="stat-top">
              <span>Won Revenue</span>
              <span className="stat-icon">₹</span>
            </div>
            <h2>{formatCurrency(wonRevenue)}</h2>
            <p className="subtitle">Total value of Won deals</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Total Deal Value</span>
              <span className="stat-icon">◈</span>
            </div>
            <h2>{formatCurrency(totalDealValue)}</h2>
            <p className="subtitle">All recorded deal values</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Overdue Follow-ups</span>
              <span className="stat-icon">!</span>
            </div>
            <h2>{overdueReminders.length}</h2>
            <p className="subtitle">Open leads needing attention</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Upcoming Follow-ups</span>
              <span className="stat-icon">◷</span>
            </div>
            <h2>{upcomingReminders.length}</h2>
            <p className="subtitle">Scheduled next steps</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="panel performance-panel">
            <div className="panel-heading">
              <div>
                <h2>Lead Activity</h2>
                <p className="subtitle">
                  New leads created per month
                </p>
              </div>
              <span className="period-tag">Last 6 months</span>
            </div>

            <MonthlyLeadChart monthlyData={monthlyData} />

            <p className="subtitle" style={{ fontSize: 12 }}>
              Current month: {currentMonthCount} new lead
              {currentMonthCount === 1 ? "" : "s"}
              {monthlyChange !== 0 &&
                ` · ${monthlyChange > 0 ? "+" : ""}${monthlyChange} vs previous month`}
            </p>
          </section>

          <section className="panel source-panel">
            <div className="panel-heading">
              <div>
                <h2>Lead Status</h2>
                <p className="subtitle">
                  Current database distribution
                </p>
              </div>
            </div>

            <div className="overview-number">{totalLeads}</div>
            <p className="subtitle">Total records</p>

            {statusCounts.map((item) => {
              const percentage = totalLeads
                ? Math.round((item.count / totalLeads) * 100)
                : 0;

              return (
                <div className="source-row" key={item.status}>
                  <div className="source-label">
                    <span>{item.status}</span>
                    <span>
                      {item.count} ({percentage}%)
                    </span>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        <LeadStatusAnalytics
          statusCounts={statusCounts}
          totalLeads={totalLeads}
        />

        {renderReminderPanel()}
        {renderLeadListPanel("Recent Leads")}
      </>
    );
  }

  /* ANALYTICS AND REPORTS */

  function renderAnalytics() {
    return (
      <>
        <div className="welcome-row">
          <div>
            <div className="eyebrow">REPORTING</div>
            <h1>Analytics & Reports</h1>
            <p className="subtitle">
              Business metrics calculated from your saved CRM records.
            </p>
          </div>

          <button type="button" onClick={exportCSV}>
            Export CSV ↓
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>Total Leads</span>
              <span className="stat-icon">♙</span>
            </div>
            <h2>{totalLeads}</h2>
            <p className="subtitle">All lead records</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Won Revenue</span>
              <span className="stat-icon">₹</span>
            </div>
            <h2>{formatCurrency(wonRevenue)}</h2>
            <p className="subtitle">Value of Won deals</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Open Pipeline</span>
              <span className="stat-icon">◇</span>
            </div>
            <h2>{formatCurrency(pipelineValue)}</h2>
            <p className="subtitle">Potential open deal value</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Conversion Rate</span>
              <span className="stat-icon">%</span>
            </div>
            <h2>{conversionRate}%</h2>
            <p className="subtitle">Won leads ÷ total leads</p>
          </div>
        </div>

        <section className="panel performance-panel">
          <div className="panel-heading">
            <div>
              <h2>Monthly Lead Activity</h2>
              <p className="subtitle">
                Number of leads created during each month
              </p>
            </div>
            <span className="period-tag">Last 6 months</span>
          </div>

          <MonthlyLeadChart monthlyData={monthlyData} />

          <p className="subtitle" style={{ fontSize: 12 }}>
            This month: {currentMonthCount} new lead
            {currentMonthCount === 1 ? "" : "s"}
            {monthlyChange !== 0 &&
              ` · ${monthlyChange > 0 ? "+" : ""}${monthlyChange} compared with last month`}
          </p>
        </section>

        <LeadStatusAnalytics
          statusCounts={statusCounts}
          totalLeads={totalLeads}
        />

        <section className="panel source-panel analytics-revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue & Pipeline</h2>
              <p className="subtitle">
                Amounts calculated from each lead's deal value.
              </p>
            </div>
          </div>

          <div className="revenue-breakdown">
            <div>
              <span>Won revenue</span>
              <strong>{formatCurrency(wonRevenue)}</strong>
              <p className="subtitle">{wonLeads.length} won deal(s)</p>
            </div>

            <div>
              <span>Open pipeline</span>
              <strong>{formatCurrency(pipelineValue)}</strong>
              <p className="subtitle">{openDeals.length} open deal(s)</p>
            </div>

            <div>
              <span>Lost deal value</span>
              <strong>{formatCurrency(lostDealValue)}</strong>
              <p className="subtitle">{lostLeads.length} lost lead(s)</p>
            </div>
          </div>

          <p className="subtitle" style={{ marginTop: 16 }}>
            Note: Won revenue represents the recorded value of deals
            marked Won; it is not proof of payment received.
          </p>
        </section>

        <section
          className="panel source-panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-heading">
            <div>
              <h2>Pipeline Summary</h2>
              <p className="subtitle">
                Live counts from the leads collection
              </p>
            </div>
          </div>

          {statusCounts.map((item) => (
            <div className="source-row" key={item.status}>
              <div className="source-label">
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      totalLeads
                        ? (item.count / totalLeads) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>

        {renderReminderPanel()}
      </>
    );
  }

  /* MAIN LAYOUT */

  return (
    <div className="crm-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>Enterprise CRM</strong>
            <div className="subtitle">Management Suite</div>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav>
          {navItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(item.name);
                setSearchTerm("");
                setStatusFilter("All");
                setFollowUpFilter("All");
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>

              {item.name === "Leads" && (
                <span className="nav-count">{totalLeads}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <strong>Need help?</strong>
            <p className="subtitle">
              Manage leads, schedule follow-ups and track your sales pipeline.
            </p>

            <button
              type="button"
              onClick={() =>
                window.alert(
                  "Tip: Add a follow-up date and deal value when creating or editing a lead. Export your leads from the CSV button."
                )
              }
            >
              Quick tip →
            </button>
          </div>

          <div className="profile">
            <div className="mini-avatar">AR</div>
            <div>
              <strong>CRM Admin</strong>
              <div className="subtitle">Workspace</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{pageTitle}</strong>
          </div>

          <div className="top-actions">
            <span className="live-status">
              <span
                className="status-dot"
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  marginRight: 7,
                  background:
                    apiConnected === true
                      ? "#16a34a"
                      : apiConnected === false
                        ? "#dc2626"
                        : "#d97706",
                }}
              />

              {apiConnected === true
                ? "MongoDB connected"
                : apiConnected === false
                  ? "Backend unavailable"
                  : "Checking connection..."}
            </span>

            <button
              type="button"
              className="notification"
              title="Refresh data"
              aria-label="Refresh CRM data"
              onClick={() => {
                loadLeads();
                checkBackendHealth();
              }}
            >
              ↻
            </button>
          </div>
        </header>

        <div className="page-content">
          {errorMessage && (
            <div role="alert" className="app-message error-message">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div role="status" className="app-message success-message">
              {successMessage}
            </div>
          )}

          {activePage === "Dashboard" && renderDashboard()}

          {activePage === "Leads" && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">CRM WORKSPACE</div>
                  <h1>Lead Management</h1>
                  <p className="subtitle">
                    Create, search, update and manage your leads.
                  </p>
                </div>

                <button type="button" onClick={exportCSV}>
                  Export CSV ↓
                </button>
              </div>

              {renderLeadListPanel("All Leads")}
            </>
          )}

          {activePage === "Customers" && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">RELATIONSHIPS</div>
                  <h1>Customers</h1>
                  <p className="subtitle">
                    Leads whose current status is Won.
                  </p>
                </div>
              </div>

              {renderLeadListPanel("Converted Customers")}
            </>
          )}

          {activePage === "Deals" && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">SALES PIPELINE</div>
                  <h1>Open Deals</h1>
                  <p className="subtitle">
                    Leads not yet marked Won or Lost.
                  </p>
                </div>

                <div>
                  <strong>
                    Pipeline value: {formatCurrency(pipelineValue)}
                  </strong>
                </div>
              </div>

              {renderLeadListPanel("Active Pipeline")}
            </>
          )}

          {activePage === "Analytics" && renderAnalytics()}

          <footer className="footer">
            <span>Enterprise CRM System</span>
            <span>
              Live lead data · Follow-ups · Revenue analytics · CSV export
            </span>
          </footer>
        </div>
      </main>

      {/* ADD / EDIT LEAD MODAL */}

      {showForm && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeForm();
            }
          }}
          className="modal-overlay"
        >
          <section
            className="panel lead-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-form-title"
          >
            <div className="form-heading">
              <div>
                <h2 id="lead-form-title">
                  {editingId ? "Edit Lead" : "Add New Lead"}
                </h2>
                <p className="subtitle">
                  {editingId
                    ? "Update contact, deal and follow-up details."
                    : "Enter contact details, deal value and follow-up details."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="lead-form">
              <div className="form-fields">
                <label>
                  Full Name *
                  <input
                    name="name"
                    type="text"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                    maxLength={100}
                  />
                </label>

                <label>
                  Company *
                  <input
                    name="company"
                    type="text"
                    placeholder="Enter company name"
                    value={formData.company}
                    onChange={handleFormChange}
                    required
                    maxLength={150}
                  />
                </label>

                <label>
                  Email Address *
                  <input
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                    maxLength={254}
                  />
                </label>

                <label>
                  Lead Status
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Deal Value (₹)
                  <input
                    name="dealValue"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 25000"
                    value={formData.dealValue}
                    onChange={handleFormChange}
                  />
                </label>

                <label>
                  Follow-up Date & Time
                  <input
                    name="followUpAt"
                    type="datetime-local"
                    value={formData.followUpAt}
                    onChange={handleFormChange}
                  />
                </label>

                <label className="full-width-field">
                  Follow-up Notes
                  <textarea
                    name="followUpNotes"
                    rows="3"
                    maxLength={1000}
                    placeholder="What should you discuss with this client?"
                    value={formData.followUpNotes}
                    onChange={handleFormChange}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Lead"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;