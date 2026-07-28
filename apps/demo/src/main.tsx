import { createElement, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { MedyAssistant } from "@medy/assistant-react";
import { ApiClient, ReactRouterNavigationAdapter } from "@medy/assistant-core";
import {
  PortalRoutes,
  type DemoConfig,
  type EmployeeProfile,
} from "@medy/shared";
import "@medy/assistant-widget";
import "./styles.css";

const API =
  import.meta.env.VITE_API_URL ||
  `${location.protocol}//${location.hostname}:${location.port === "5281" ? "4281" : "4180"}/api`;
const SESSION = "stakeholder-demo";
type PortalData = {
  requests?: Array<{ id: string; type: string; status: string }>;
  training?: Array<{ title: string; status: string }>;
  license?: { type: string; expires: string };
  approvals?: Array<{ id: string; employee: string }>;
};
function PublicDemo() {
  const services = [
    [
      "01",
      "Command operations",
      "Coordinated security coverage built around your people and property.",
    ],
    [
      "02",
      "Roving patrol",
      "Visible patrol and responsive support for facilities and communities.",
    ],
    [
      "03",
      "Surveillance",
      "Purposeful monitoring that helps reduce risk and improve awareness.",
    ],
    [
      "04",
      "Risk management",
      "Practical assessments and plans for mission-critical operations.",
    ],
    [
      "05",
      "Access control",
      "Professional personnel and procedures at every point of entry.",
    ],
    [
      "06",
      "Alarm response",
      "Dependable response support when your organization needs it.",
    ],
  ];
  return (
    <div className="public">
      <header className="public-header">
        <a className="public-brand" href="#top" aria-label="SecureMedy home">
          <img src="/securemedy-logo.png" alt="SecureMedy Incorporated" />
        </a>
        <nav aria-label="Main navigation">
          <a href="#top">Welcome</a>
          <a href="#services">Services</a>
          <a href="#careers">Careers</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <Link className="employee-login" to="/employee/dashboard">
          Employee login <span aria-hidden="true">→</span>
        </Link>
      </header>
      <main id="top">
        <section className="public-hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-content">
            <span className="public-kicker">SECURITY THAT MOVES WITH YOU</span>
            <h1>Protection without compromise.</h1>
            <p>
              Experienced people, disciplined operations, and responsive
              security services—delivered where and when you need them.
            </p>
            <div className="hero-actions">
              <a className="public-button primary" href="#contact">
                Contact us now
              </a>
              <a className="public-button text" href="#services">
                Explore services <span>↘</span>
              </a>
            </div>
          </div>
          <aside className="hero-contact">
            <small>CORPORATE HEADQUARTERS</small>
            <p>
              8507 Oxon Hill Road, Suite 101
              <br />
              Fort Washington, MD 20744
            </p>
            <a href="tel:2404193125">(240) 419-3125</a>
          </aside>
          <div className="hero-statement">
            ESTABLISHED <strong>2009</strong>
          </div>
        </section>
        <section className="public-intro" id="about">
          <div>
            <span className="section-number">01 — ABOUT US</span>
            <h2>Superior security services at a competitive cost.</h2>
          </div>
          <div className="intro-copy">
            <p>
              SecureMedy was founded to establish a paradigm shift in the
              physical security and emergency management industry.
            </p>
            <p>
              We protect people, property, and information through thoughtful
              planning, experienced personnel, and dependable operations.
            </p>
          </div>
        </section>
        <section className="public-services" id="services">
          <header className="section-heading">
            <div>
              <span className="section-number light">02 — WHAT WE DO</span>
              <h2>Full-scale security services.</h2>
            </div>
            <p>
              Comprehensive support for critical facilities, organizations, and
              events.
            </p>
          </header>
          <div className="service-grid">
            {services.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <a href="#contact" aria-label={`Learn about ${title}`}>
                  Learn more →
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className="public-mission">
          <span className="section-number">03 — OUR MISSION</span>
          <blockquote>
            Our solutions help you protect your{" "}
            <em>people, property, and information</em> with minimal risk.
          </blockquote>
          <div className="mission-facts">
            <div>
              <strong>16</strong>
              <span>States licensed</span>
            </div>
            <div>
              <strong>20+</strong>
              <span>Years of expert experience</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Operational readiness</span>
            </div>
          </div>
        </section>
        <section className="public-industries" id="careers">
          <div>
            <span className="section-number light">04 — EXPERIENCE</span>
            <h2>Ready for complex environments.</h2>
            <p>
              Serving government, commercial, residential, financial, education,
              healthcare, retail, hospitality, construction, and emergency-event
              clients.
            </p>
          </div>
          <ul>
            <li>Uniformed protection</li>
            <li>Risk assessments</li>
            <li>Emergency management</li>
            <li>Executive protection</li>
            <li>Investigations &amp; surveillance</li>
            <li>Security consulting</li>
          </ul>
        </section>
        <section className="public-contact" id="contact">
          <span className="section-number">05 — START A CONVERSATION</span>
          <h2>Protect what’s important to you.</h2>
          <p>
            Tell us what you need. Our team will help determine the right
            security approach.
          </p>
          <div className="contact-actions">
            <a className="public-button dark" href="mailto:info@securemedy.com">
              info@securemedy.com
            </a>
            <a className="contact-phone" href="tel:2404193125">
              240-419-3125
            </a>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="public-brand footer-brand">
          <img src="/securemedy-logo.png" alt="SecureMedy Incorporated" />
        </div>
        <div>
          <strong>SecureMedy, Inc.</strong>
          <span>Physical security &amp; emergency management</span>
        </div>
        <div>
          <strong>Corporate headquarters</strong>
          <span>Fort Washington, Maryland</span>
        </div>
        <div className="footer-legal">
          <span>Privacy Policy</span>
          <span>Terms &amp; Conditions</span>
          <small>LOCAL PRODUCT DEMONSTRATION</small>
        </div>
      </footer>
      {createElement("medy-assistant", { "data-api-url": API })}
    </div>
  );
}
function EmployeeDemo() {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useMemo(() => new ApiClient(API, SESSION), []);
  const [user, setUser] = useState<EmployeeProfile>();
  const [data, setData] = useState<PortalData>({});
  useEffect(() => {
    Promise.all([
      client.employee(),
      client.get<NonNullable<PortalData["requests"]>>(
        "/demo/employee/requests",
      ),
      client.get<NonNullable<PortalData["training"]>>(
        "/demo/employee/training",
      ),
      client.get<NonNullable<PortalData["license"]>>("/demo/employee/license"),
      client.get<NonNullable<PortalData["approvals"]>>(
        "/demo/employee/approvals",
      ),
    ]).then(([profile, requests, training, license, approvals]) => {
      setUser(profile);
      setData({ requests, training, license, approvals });
    });
  }, [client]);
  const adapter = useMemo(
    () =>
      new ReactRouterNavigationAdapter((target) =>
        navigate(`/employee${target}`),
      ),
    [navigate],
  );
  const workspace = location.pathname === `/employee${PortalRoutes.assistant}`;
  if (!user)
    return <p className="loading">Loading fictional employee profile…</p>;
  const initials = `${user.firstName[0]}${user.lastName[0]}`;
  const navItems = [
    ["⌂", "Dashboard", PortalRoutes.dashboard],
    ["□", "Forms", PortalRoutes.forms],
    ["✓", "Approvals", PortalRoutes.approvals],
    ["◇", "Resources", PortalRoutes.resources],
    ["✦", "Medy Assistant", PortalRoutes.assistant],
  ].filter(
    ([, label]) =>
      label !== "Approvals" || user.permissions.includes("review_approvals"),
  );
  const roleQuickActions =
    user.roleKey === "manager"
      ? ["My Requests", "Approvals", "Payroll", "Training", "IT Support"]
      : user.roleKey === "hr_admin"
        ? ["My Requests", "HR Support", "Training", "Employee Resources"]
        : ["My Requests", "Payroll", "Uniforms", "Training", "IT Support"];
  return (
    <div className="portal">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <img src="/m3dyhub-logo.png" alt="M3dyHub" />
        </div>
        <small className="nav-label">WORKSPACE</small>
        <nav>
          {navItems.map(([icon, label, target]) => (
            <Link
              className={
                location.pathname === `/employee${target}` ? "active" : ""
              }
              key={label}
              to={`/employee${target}`}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="portal-profile">
          <span className="avatar">{initials}</span>
          <span>
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <small>{user.role}</small>
          </span>
        </div>
      </aside>
      <section className="portal-main">
        <header className="portal-header">
          <div>
            <small>Workspace</small>
            <strong>{workspace ? "Medy Assistant" : "Dashboard"}</strong>
          </div>
          <div className="header-actions">
            <button aria-label="Notifications">○</button>
            <span className="avatar small">{initials}</span>
          </div>
        </header>
        {workspace ? (
          <main className="workspace">
            <section className="workspace-intro">
              <span className="eyebrow">AI EMPLOYEE SUPPORT</span>
              <h1>How can I help, {user.firstName}?</h1>
              <p>
                Find trusted resources, review requests, and move around
                M3dyHub—all in one conversation.
              </p>
              <div className="trust-note">
                <strong>Secure workspace</strong>
                <span>
                  Responses use demonstration employee data and approved local
                  guidance.
                </span>
              </div>
            </section>
            <MedyAssistant
              mode="employee"
              apiUrl={API}
              sessionId={SESSION}
              user={user}
              navigation={adapter}
              variant="workspace"
              quickActions={roleQuickActions}
            />
          </main>
        ) : (
          <main className="dashboard">
            <section className="dashboard-welcome">
              <div>
                <span className="eyebrow">MONDAY OVERVIEW</span>
                <h1>Good morning, {user.firstName}.</h1>
                <p>
                  {user.role} · {user.department} · {user.site}
                </p>
              </div>
              <button
                className="assistant-cta"
                onClick={() => navigate(`/employee${PortalRoutes.assistant}`)}
              >
                ✦ Ask Medy Assistant
              </button>
            </section>
            <div className="metric-grid">
              <article>
                <span className="metric-icon blue">↗</span>
                <div>
                  <small>OPEN REQUESTS</small>
                  <strong>{data.requests?.length ?? 0}</strong>
                  <span>View your active cases</span>
                </div>
              </article>
              <article>
                <span className="metric-icon amber">!</span>
                <div>
                  <small>TRAINING ITEMS</small>
                  <strong>{data.training?.length ?? 0}</strong>
                  <span>One item needs attention</span>
                </div>
              </article>
              <article>
                <span className="metric-icon green">✓</span>
                <div>
                  <small>LICENSE STATUS</small>
                  <strong>Active</strong>
                  <span>Expires {data.license?.expires ?? "—"}</span>
                </div>
              </article>
              <article>
                <span className="metric-icon purple">◇</span>
                <div>
                  <small>APPROVALS</small>
                  <strong>{data.approvals?.length ?? 0}</strong>
                  <span>Awaiting your review</span>
                </div>
              </article>
            </div>
            <div className="dashboard-panels">
              <section className="panel">
                <header>
                  <div>
                    <h2>Recent requests</h2>
                    <p>Track your latest submissions</p>
                  </div>
                  <Link to={`/employee${PortalRoutes.forms}`}>View all</Link>
                </header>
                <div className="request-list">
                  {data.requests?.map((request) => (
                    <article key={request.id}>
                      <span className="request-icon">{request.type[0]}</span>
                      <div>
                        <strong>{request.type}</strong>
                        <small>{request.id}</small>
                      </div>
                      <span
                        className={`status ${request.status.toLowerCase()}`}
                      >
                        {request.status}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel quick-panel">
                <header>
                  <div>
                    <h2>Quick actions</h2>
                    <p>Common employee tasks</p>
                  </div>
                </header>
                <Link to={`/employee${PortalRoutes.assistant}`}>
                  ✦ Ask Medy Assistant <span>→</span>
                </Link>
                <Link to={`/employee${PortalRoutes.forms}`}>
                  □ Submit a form <span>→</span>
                </Link>
                <Link to={`/employee${PortalRoutes.resources}`}>
                  ◇ Browse resources <span>→</span>
                </Link>
              </section>
            </div>
          </main>
        )}
        {!workspace && (
          <MedyAssistant
            mode="employee"
            apiUrl={API}
            sessionId={SESSION}
            user={user}
            navigation={adapter}
            quickActions={roleQuickActions}
          />
        )}
        <Link className="controls-link" to="/control">
          Demo controls
        </Link>
      </section>
    </div>
  );
}
function Controls() {
  const client = useMemo(() => new ApiClient(API, SESSION), []);
  const [config, setConfig] = useState<DemoConfig>({
    role: "officer",
    provider: "mock",
    delay: false,
    providerError: false,
  });
  const [actions, setActions] = useState<unknown[]>([]);
  useEffect(() => {
    client.config().then(setConfig);
    client.get<unknown[]>("/demo/actions").then(setActions);
  }, [client]);
  async function update(patch: Partial<DemoConfig>) {
    const next = { ...config, ...patch };
    setConfig(await client.setConfig(next));
  }
  return (
    <main className="controls">
      <h1>Demo control panel</h1>
      <Link to="/">Public demo</Link> ·{" "}
      <Link to="/employee/dashboard">Employee demo</Link>
      <label>
        Mock employee role
        <select
          value={config.role}
          onChange={(e) =>
            void update({ role: e.target.value as DemoConfig["role"] })
          }
        >
          <option value="officer">Security Officer</option>
          <option value="manager">Operations Manager</option>
          <option value="hr_admin">HR Administrator</option>
        </select>
      </label>
      <label>
        Provider
        <select
          value={config.provider}
          onChange={(e) =>
            void update({ provider: e.target.value as DemoConfig["provider"] })
          }
        >
          <option value="mock">Deterministic local engine</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.delay}
          onChange={(e) => void update({ delay: e.target.checked })}
        />{" "}
        Simulated delay
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.providerError}
          onChange={(e) => void update({ providerError: e.target.checked })}
        />{" "}
        Provider error
      </label>
      <button
        onClick={async () => {
          await client.post("/demo/reset", {
            leads: true,
            actions: true,
            session: true,
          });
          setConfig({
            role: "officer",
            provider: "mock",
            delay: false,
            providerError: false,
          });
          setActions([]);
        }}
      >
        Reset persisted demo data
      </button>
      <h2>Actions</h2>
      <pre>{JSON.stringify(actions, null, 2)}</pre>
      <h2>Routes</h2>
      <pre>{JSON.stringify(PortalRoutes, null, 2)}</pre>
    </main>
  );
}
function LeadsAdmin() {
  const client = useMemo(() => new ApiClient(API, SESSION), []);
  const [leads, setLeads] = useState<unknown[]>([]);
  useEffect(() => {
    client.get<unknown[]>("/leads").then(setLeads);
  }, [client]);
  return (
    <main className="controls">
      <h1>Demonstration service leads</h1>
      <p>Fictional records saved by the local public-widget demonstration.</p>
      <Link to="/">Public demo</Link> · <Link to="/control">Controls</Link>
      <pre>{JSON.stringify(leads, null, 2)}</pre>
    </main>
  );
}
function App() {
  return (
    <BrowserRouter>
      {location.pathname.startsWith("/employee") ? (
        <EmployeeDemo />
      ) : location.pathname === "/control" ? (
        <Controls />
      ) : location.pathname === "/admin/leads" ? (
        <LeadsAdmin />
      ) : (
        <PublicDemo />
      )}
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
