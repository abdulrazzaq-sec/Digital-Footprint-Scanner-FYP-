import { useState } from "react";
import { Shield, Lock, RefreshCw, CheckCircle, Clock, XCircle, Inbox, Trash2 } from "lucide-react";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-warning/10 text-warning border border-warning/20",
  resolved:   "bg-success/10 text-success border border-success/20",
  dismissed:  "bg-muted/30 text-muted-foreground border border-border/30",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending:   Clock,
  resolved:  CheckCircle,
  dismissed: XCircle,
};

const SUBJECT_LABELS: Record<string, string> = {
  data_removal: "Data Removal Request",
  general:      "General Inquiry",
  support:      "Technical Support",
  privacy:      "Privacy Concern",
  feedback:     "Feedback",
  partnership:  "Partnership",
};

const Admin = () => {
  const [secret, setSecret]     = useState("");
  const [authed, setAuthed]     = useState(false);
  const [queries, setQueries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<string>("all");

  const fetchQueries = async (s = secret) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BACKEND}/admin/queries`, {
        headers: { "x-admin-secret": s },
      });
      if (resp.status === 403) { setError("Wrong password."); return; }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error || "Server error - check backend logs.");
        return;
      }
      const data = await resp.json();
      setQueries(data);
      setAuthed(true);
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${BACKEND}/admin/queries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ status }),
    });
    setQueries(q => q.map(item => item.id === id ? { ...item, status } : item));
  };

  const filtered = filter === "all" ? queries : queries.filter(q => q.subject === filter || q.status === filter);

  const counts = {
    all:      queries.length,
    pending:  queries.filter(q => q.status === "pending").length,
    resolved: queries.filter(q => q.status === "resolved").length,
  };

  if (!authed) {
    return (
      <div className="landing-theme min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Portal</h1>
              <p className="text-xs text-muted-foreground">Digital Footprint Scanner</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Admin Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && fetchQueries()}
                  placeholder="Enter password"
                  className="input-cyber w-full pl-11"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              onClick={() => fetchQueries()}
              disabled={loading || !secret}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? "Verifying..." : "Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-theme min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Portal</h1>
              <p className="text-sm text-muted-foreground">User Queries & Support Requests</p>
            </div>
          </div>
          <button
            onClick={() => fetchQueries()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total", value: counts.all, color: "text-foreground" },
            { label: "Pending", value: counts.pending, color: "text-warning" },
            { label: "Resolved", value: counts.resolved, color: "text-success" },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "pending", "resolved", "dismissed", "data_removal"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {f === "data_removal" ? "Data Removal" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Queries */}
        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No queries found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => {
              const Icon = STATUS_ICONS[q.status] || Clock;
              return (
                <div key={q.id} className="glass-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold">{q.name}</span>
                        <span className="text-muted-foreground text-sm">{q.email}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[q.status]}`}>
                          <Icon className="w-3 h-3" />
                          {q.status}
                        </span>
                        {q.subject === "data_removal" && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                            Data Removal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {SUBJECT_LABELS[q.subject] || q.subject} · {new Date(q.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{q.message}</p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {q.status !== "resolved" && (
                        <button
                          onClick={() => updateStatus(q.id, "resolved")}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Resolve
                        </button>
                      )}
                      {q.status !== "dismissed" && (
                        <button
                          onClick={() => updateStatus(q.id, "dismissed")}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted text-xs font-medium transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
