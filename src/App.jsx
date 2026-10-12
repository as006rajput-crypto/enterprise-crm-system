
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/leads";

const statuses = ["New", "Contacted", "Qualified", "Won", "Lost"];

const navItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Leads", icon: "♙" },
  { name: "Customers", icon: "♧" },
  { name: "Deals", icon: "◇" },
  { name: "Analytics", icon: "▥" },
];

function normalizeLead(lead) {
  return {
    ...lead,
    id: lead._id || lead.id,
  };
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    status: "New",
  });

  // Load leads from MongoDB through the backend API.
  useEffect(() => {
    let cancelled = false;

    async function fetchLeads() {
      try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load leads.");
        }

        if (!cancelled) {
          setLeads((result.data || []).map(normalizeLead));
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            `Could not load leads: ${error.message}. Check that the backend is running.`
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLeads();

    return () => {
      cancelled = true;
    };
  }, []);

  function openAddForm() {
    setEditingId(null);
    setForm({
      name: "",
      company: "",
      email: "",
      status: "New",
    });
    setShowForm(true);
    setNotice("");
  }

  function openEditForm(lead) {
    setEditingId(lead.id);
    setForm({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      status: lead.status,
    });
    setShowForm(true);
    setNotice("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: "",
      company: "",
      email: "",
      status: "New",
    });
  }

  // Create a lead or update an existing lead in MongoDB.
  async function saveLead(event) {
    event.preventDefault();

    const cleanLead = {
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      status: form.status,
    };

    if (!cleanLead.name || !cleanLead.company || !cleanLead.email) {
      setNotice("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);

      const isEditing = editingId !== null;
      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cleanLead),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save lead.");
      }

      const savedLead = normalizeLead(result.data);

      if (isEditing) {
        setLeads((previous) =>
          previous.map((lead) =>
            lead.id === savedLead.id ? savedLead : lead
          )
        );
        setNotice("Lead updated successfully in MongoDB.");
      } else {
        setLeads((previous) => [savedLead, ...previous]);
        setNotice("Lead added successfully to MongoDB.");
      }

      closeForm();
      setActivePage("Leads");
      setSearch("");
    } catch (error) {
      setNotice(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Delete a lead from MongoDB.
  async function deleteLead(id) {
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;

    if (
      !window.confirm(
        `Delete lead "${lead.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not delete lead.");
      }

      setLeads((previous) =>
        previous.filter((item) => item.id !== id)
      );

      setNotice("Lead deleted successfully from MongoDB.");
    } catch (error) {
      setNotice(`Delete failed: ${error.message}`);
    }
  }

  // Save status changes to MongoDB.
  async function updateStatus(id, status) {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update status.");
      }

      const updatedLead = normalizeLead(result.data);

      setLeads((previous) =>
        previous.map((lead) =>
          lead.id === updatedLead.id ? updatedLead : lead
        )
      );

      setNotice("Lead status updated successfully in MongoDB.");
    } catch (error) {
      setNotice(`Status update failed: ${error.message}`);
    }
  }

  const filteredLeads = leads.filter((lead) =>
    `${lead.name} ${lead.company} ${lead.email} ${lead.status}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const displayedLeads = filteredLeads.filter((lead) => {
    if (activePage === "Customers") return lead.status === "Won";
    if (activePage === "Deals") {
      return !["Won", "Lost"].includes(lead.status);
    }
    return true;
  });

  const customers = leads.filter((lead) => lead.status === "Won");
  const openDeals = leads.filter(
    (lead) => !["Won", "Lost"].includes(lead.status)
  );
  const wonCount = customers.length;
  const conversionRate = leads.length
    ? Math.round((wonCount / leads.length) * 100)
    : 0;

  const stats = [
    {
      label: "Total Leads",
      value: leads.length,
      icon: "♙",
      change: "All recorded leads",
      color: "blue",
    },
    {
      label: "Customers",
      value: customers.length,
      icon: "♧",
      change: "Converted leads",
      color: "green",
    },
    {
      label: "Open Deals",
      value: openDeals.length,
      icon: "◇",
      change: "Active pipeline",
      color: "purple",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: "%",
      change: "Won leads / total leads",
      color: "orange",
    },
  ];

  return (
    <div className="crm-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">E</div>
          <div>
            <h2>Enterprise CRM</h2>
            <span>BUSINESS MANAGER</span>
          </div>
        </div>

        <p className="menu-label">WORKSPACE</p>

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
                setShowForm(false);
                setSearch("");
                setNotice("");
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>CRM Workspace</strong>
            <p>Manage your leads and grow your business.</p>
          </div>

          <div className="profile">
            <div className="avatar">AR</div>
            <div className="profile-info">
              <strong>Aryan Raj</strong>
              <span>Workspace Admin</span>
            </div>
            <span>⋯</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="top-actions">
            <span className="live-status">
              <i /> MongoDB connected through API
            </span>
            <button
              type="button"
              className="notification"
              aria-label="Notifications"
              title="No new notifications"
            >
              ♧
            </button>
            <div className="top-avatar">AR</div>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
              <h1>
                {activePage === "Dashboard"
                  ? "Welcome back, Aryan 👋"
                  : activePage}
              </h1>
              <p className="subtitle">
                {activePage === "Dashboard"
                  ? "Here’s what’s happening with your business today."
                  : `Manage and track your ${activePage.toLowerCase()} in one place.`}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={openAddForm}
            >
              <span>＋</span> Add New Lead
            </button>
          </div>

          {notice && (
            <div
              role="status"
              style={{
                padding: "10px 14px",
                marginBottom: 16,
                borderRadius: 8,
                background: "#eef5ff",
                color: "#244a8f",
              }}
            >
              {notice}
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
                style={{
                  float: "right",
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {showForm && (
            <form className="lead-form" onSubmit={saveLead}>
              <div className="form-heading">
                <div>
                  <h3>
                    {editingId !== null ? "Edit lead" : "Add a new lead"}
                  </h3>
                  <p>Enter the contact details below.</p>
                </div>
                <button
                  type="button"
                  className="close-button"
                  onClick={closeForm}
                  aria-label="Close form"
                >
                  ✕
                </button>
              </div>

              <div className="form-fields">
                <input
                  placeholder="Full name"
                  aria-label="Full name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />

                <input
                  placeholder="Company"
                  aria-label="Company"
                  value={form.company}
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value })
                  }
                  required
                />

                <input
                  type="email"
                  placeholder="Email address"
                  aria-label="Email address"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  required
                />

                <select
                  aria-label="Lead status"
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Update Lead"
                      : "Save Lead"}
                </button>

                <button
                  className="close-button"
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className="panel" style={{ padding: 20 }}>
              Loading leads from MongoDB...
            </div>
          )}

          {!loading && activePage === "Dashboard" && (
            <>
              <div className="stats-grid">
                {stats.map((stat) => (
                  <div className="stat-card" key={stat.label}>
                    <div className="stat-top">
                      <span>{stat.label}</span>
                      <div className={`stat-icon ${stat.color}`}>
                        {stat.icon}
                      </div>
                    </div>
                    <h2>{stat.value}</h2>
                    <p>
                      <span className="trend">↗</span> {stat.change}
                    </p>
                  </div>
                ))}
              </div>

              <div className="dashboard-grid">
                <section className="panel performance-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Sales Performance</h3>
                      <p>Illustrative monthly activity</p>
                    </div>
                    <span className="period-tag">Last 6 months</span>
                  </div>

                  <div className="chart">
                    <div className="chart-y-labels">
                      <span>100</span>
                      <span>75</span>
                      <span>50</span>
                      <span>25</span>
                      <span>0</span>
                    </div>
                    <div className="chart-area">
                      {[100, 75, 50, 25, 0].map((n) => (
                        <div
                          className="chart-gridline"
                          key={n}
                          style={{ bottom: `${n}%` }}
                        />
                      ))}
                      <svg
                        viewBox="0 0 600 220"
                        preserveAspectRatio="none"
                        className="chart-svg"
                        role="img"
                        aria-label="Illustrative sales activity chart"
                      >
                        <defs>
                          <linearGradient
                            id="chartFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#5578f7"
                              stopOpacity=".24"
                            />
                            <stop
                              offset="100%"
                              stopColor="#5578f7"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,170 C50,155 65,120 120,135 S200,175 240,110 S310,120 360,75 S430,105 480,50 S550,70 600,20 L600,220 L0,220 Z"
                          fill="url(#chartFill)"
                        />
                        <path
                          d="M0,170 C50,155 65,120 120,135 S200,175 240,110 S310,120 360,75 S430,105 480,50 S550,70 600,20"
                          fill="none"
                          stroke="#5578f7"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                    <div className="chart-months">
                      <span>May</span>
                      <span>Jun</span>
                      <span>Jul</span>
                      <span>Aug</span>
                      <span>Sep</span>
                      <span>Oct</span>
                    </div>
                  </div>
                </section>

                <section className="panel source-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Lead Overview</h3>
                      <p>Current lead statuses</p>
                    </div>
                  </div>

                  <div className="overview-number">
                    {leads.length}
                    <span> total leads</span>
                  </div>

                  {statuses.map((status, index) => {
                    const count = leads.filter(
                      (lead) => lead.status === status
                    ).length;

                    const colors = [
                      "bar-blue",
                      "bar-purple",
                      "bar-orange",
                      "bar-green",
                      "bar-orange",
                    ];

                    return (
                      <div className="source-row" key={status}>
                        <div className="source-label">
                          <span>{status}</span>
                          <strong>{count}</strong>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${colors[index]}`}
                            style={{
                              width: `${
                                leads.length
                                  ? (count / leads.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </section>
              </div>
            </>
          )}

          {!loading &&
            (activePage === "Leads" ||
              activePage === "Customers" ||
              activePage === "Deals") && (
              <section className="panel leads-panel">
                <div className="panel-heading leads-heading">
                  <div>
                    <h3>
                      {activePage === "Leads"
                        ? "All Leads"
                        : activePage === "Customers"
                          ? "Converted Customers"
                          : "Sales Pipeline"}
                    </h3>
                    <p>
                      {activePage === "Customers"
                        ? "Contacts whose lead status is Won."
                        : activePage === "Deals"
                          ? "Update statuses as sales opportunities progress."
                          : "Add, search, edit and manage your leads."}
                    </p>
                  </div>

                  <input
                    className="search-input"
                    placeholder="Search name, company, email or status..."
                    aria-label="Search leads"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>CONTACT</th>
                        <th>COMPANY</th>
                        <th>EMAIL</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {displayedLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td>
                            <div className="contact-cell">
                              <div className="mini-avatar">
                                {lead.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <strong>{lead.name}</strong>
                            </div>
                          </td>

                          <td>{lead.company}</td>
                          <td>{lead.email}</td>

                          <td>
                            <select
                              aria-label={`Status for ${lead.name}`}
                              value={lead.status}
                              onChange={(event) =>
                                updateStatus(lead.id, event.target.value)
                              }
                              style={{
                                maxWidth: 130,
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: "1px solid #d9deea",
                                background: "#fff",
                              }}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openEditForm(lead)}
                                aria-label={`Edit ${lead.name}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 7,
                                  border: "1px solid #ccd7f5",
                                  background: "#eef3ff",
                                  color: "#244a9b",
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteLead(lead.id)}
                                aria-label={`Delete ${lead.name}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 7,
                                  border: "1px solid #f1caca",
                                  background: "#fff0f0",
                                  color: "#a12626",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {displayedLeads.length === 0 && (
                    <p className="empty-state">
                      No matching records found.
                    </p>
                  )}

                  <p
                    style={{
                      padding: "12px 4px",
                      color: "#70798c",
                      fontSize: 13,
                    }}
                  >
                    Showing {displayedLeads.length} of {leads.length} total
                    leads.
                  </p>
                </div>
              </section>
            )}

          {!loading && activePage === "Analytics" && (
            <section className="panel analytics-panel">
              <h3>Business Analytics</h3>
              <p>
                Total leads: <strong>{leads.length}</strong>
              </p>
              <p>
                Converted customers: <strong>{wonCount}</strong>
              </p>
              <p>
                Open deals: <strong>{openDeals.length}</strong>
              </p>
              <p>
                Lost leads:{" "}
                <strong>
                  {leads.filter((lead) => lead.status === "Lost").length}
                </strong>
              </p>
              <p>
                Conversion rate: <strong>{conversionRate}%</strong>
              </p>
              <p className="subtitle">
                Sales chart and revenue are demo-only. Connect real deal
                values to calculate actual business revenue.
              </p>
            </section>
          )}

          <footer className="footer">
            <span>© 2026 Enterprise CRM System</span>
            <span>Built for smarter business management ✦</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;