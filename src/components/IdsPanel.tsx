import { useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import { IdsParameters, SpecResult, runDummySpec } from "../bim/components/IdsParameters";

interface IdsPanelProps {
  components: OBC.Components | null;
}

export function IdsPanel({ components }: IdsPanelProps) {
  const [idsFile, setIdsFile] = useState<{ name: string; text: string } | null>(null);
  const [specResults, setSpecResults] = useState<SpecResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostMode, setGhostMode] = useState(false);

  const getParams = useCallback((): IdsParameters | null => {
    if (!components) return null;
    try { return components.get(IdsParameters); } catch { return null; }
  }, [components]);

  const handleLoadFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ids,.xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setIdsFile({ name: file.name, text });
      setSpecResults([]);
      setError(null);
      console.log("[IDS] file loaded:", file.name);
    };
    input.click();
  };

  const handleRunCheck = async () => {
    const params = getParams();
    if (!params) { setError("IdsParameters component not found"); return; }
    if (!idsFile) { setError("Load an IDS file first"); return; }
    const fragments = components!.get(OBC.FragmentsManager);
    if (fragments.list.size === 0) { setError("Load an IFC model in the viewer first"); return; }

    setLoading(true);
    setError(null);

    try {
      const results = await params.applyRequirements(idsFile.text);
      setSpecResults(results);
    } catch (e: any) {
      console.error("[IDS] error:", e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGhost = async () => {
    const params = getParams();
    if (!params) return;
    const next = !ghostMode;
    await params.setGhostMode(next);
    setGhostMode(next);
  };

  const handleClear = async () => {
    const params = getParams();
    if (!params) return;
    await params.clear();
    setGhostMode(false);
    setSpecResults([]);
    setError(null);
  };

  const handleDummyTest = async () => {
    if (!components) return;
    const fragments = components.get(OBC.FragmentsManager);
    if (fragments.list.size === 0) { setError("Load an IFC model first"); return; }
    setError(null);
    console.log("[IDS] running dummy spec test...");
    await runDummySpec(components);
    console.log("[IDS] dummy test done — check console for results");
  };

  const passCount = (r: SpecResult) =>
    Object.values(r.pass).reduce((sum, s) => sum + s.size, 0);
  const failCount = (r: SpecResult) =>
    Object.values(r.fail).reduce((sum, s) => sum + s.size, 0);

  const disabled = !components;
  const hasResults = specResults.length > 0;

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>IDS Checker</span>

        {/* Step 1 — load file */}
        <div style={s.steps}>
          <div style={s.step}>
            <span style={s.stepNum}>1</span>
            <div style={{ flex: 1 }}>
              <button onClick={handleLoadFile} disabled={disabled} style={s.stepBtn}>
                {idsFile ? "Change IDS file" : "Load IDS file"}
              </button>
              {idsFile && <span style={s.fileName}>📄 {idsFile.name}</span>}
            </div>
          </div>

          {/* Step 2 — run check */}
          <div style={s.step}>
            <span style={s.stepNum}>2</span>
            <button
              onClick={handleRunCheck}
              disabled={disabled || loading || !idsFile}
              style={{
                ...s.stepBtn,
                background: !idsFile || loading ? "#1e1e38" : "#0f766e",
                color: !idsFile || loading ? "#4b5563" : "#fff",
              }}
            >
              {loading ? "Checking…" : "Run Check"}
            </button>
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {/* Always-visible actions */}
        <div style={s.actions}>
          <Btn onClick={handleDummyTest} disabled={disabled} color="#b45309">
            Test Dummy
          </Btn>
          <Btn
            onClick={handleToggleGhost}
            disabled={disabled}
            color="#7c3aed"
          >
            {ghostMode ? "Restore" : "Ghost"}
          </Btn>
          {hasResults && (
            <Btn onClick={handleClear} color="#6b7280">Clear</Btn>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={s.body}>
        {!hasResults ? (
          <Empty>
            {loading
              ? "Running IDS check…"
              : idsFile
              ? 'Click "Run Check" to test the loaded model'
              : "Load an IDS file to get started"}
          </Empty>
        ) : (
          specResults.map((r, i) => {
            const pass = passCount(r);
            const fail = failCount(r);
            const total = pass + fail;
            const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
            return (
              <div key={i} style={s.card}>
                <div style={s.cardHeader}>
                  <span style={s.cardName}>{r.name}</span>
                  {r.description && r.description !== "—" && (
                    <span style={s.cardDesc}>{r.description}</span>
                  )}
                </div>
                <div style={s.bar}>
                  <div style={{ ...s.barFill, width: `${pct}%` }} />
                </div>
                <div style={s.counts}>
                  <span style={s.pass}>✓ {pass} pass</span>
                  <span style={s.fail}>✗ {fail} fail</span>
                  <span style={s.pct}>{pct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, color }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; color: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "4px 10px", borderRadius: 5, border: "none",
      background: disabled ? "#1e1e38" : color,
      color: disabled ? "#4b5563" : "#fff",
      fontSize: 11, fontFamily: "monospace", fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, color: "#6b7280", fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
    background: "#12121e", borderLeft: "1px solid #1e1e38",
    overflow: "hidden", fontFamily: "monospace",
  },
  header: { padding: "10px 12px", borderBottom: "1px solid #1e1e38", flexShrink: 0 },
  title: {
    display: "block", color: "#a78bfa", fontWeight: 700, fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },
  steps: { display: "flex", flexDirection: "column", gap: 8 },
  step: { display: "flex", alignItems: "flex-start", gap: 8 },
  stepNum: {
    width: 18, height: 18, borderRadius: "50%", background: "#1e1e38",
    color: "#a78bfa", fontSize: 10, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  stepBtn: {
    width: "100%", padding: "5px 10px", borderRadius: 5, border: "none",
    background: "#6d28d9", color: "#fff", fontSize: 11,
    fontFamily: "monospace", fontWeight: 600, cursor: "pointer",
    textAlign: "left" as const,
  },
  fileName: {
    display: "block", color: "#34d399", fontSize: 10, marginTop: 4,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  error: {
    marginTop: 8, padding: "6px 8px", background: "#2a0a0a",
    border: "1px solid #7f1d1d", borderRadius: 5, color: "#f87171", fontSize: 11,
  },
  actions: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  card: {
    margin: "0 10px 10px", padding: 10,
    background: "#0d0d14", borderRadius: 7, border: "1px solid #1e1e38",
  },
  cardHeader: { marginBottom: 8 },
  cardName: { display: "block", color: "#e5e7eb", fontSize: 12, fontWeight: 700 },
  cardDesc: { display: "block", color: "#9ca3af", fontSize: 10, marginTop: 3 },
  bar: { height: 6, borderRadius: 3, background: "#1e1e38", marginBottom: 6, overflow: "hidden" },
  barFill: {
    height: "100%", borderRadius: 3,
    background: "linear-gradient(90deg, #22c55e, #86efac)",
    transition: "width 0.4s ease",
  },
  counts: { display: "flex", gap: 10, alignItems: "center" },
  pass: { color: "#22c55e", fontSize: 11, fontWeight: 600 },
  fail: { color: "#ef4444", fontSize: 11, fontWeight: 600 },
  pct: { color: "#6b7280", fontSize: 10, marginLeft: "auto" },
};