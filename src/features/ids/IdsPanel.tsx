import { useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import { IdsParameters } from "./IdsParameters";
import { FrontFunctions } from "../hider/FrontFunctions";
import type { SpecResult } from "../../types/ifc";
import { colors } from "../../styles/tokens";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";

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

  const getHl = useCallback((): FrontFunctions | null => {
    if (!components) return null;
    try { return components.get(FrontFunctions); } catch { return null; }
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
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryCheck = async (i: number) => {
    const params = getParams();
    if (!params) { setError("IdsParameters component not found"); return; }
    try {
      await params.applyHistoryRequirements(specResults, i);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const handleToggleGhost = async () => {
    const hl = getHl();
    if (!hl) return;
    try {
      if (ghostMode) {
        await hl.unghost();
      } else {
        await hl.ghost();
      }
      setGhostMode(!ghostMode);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const handleClear = async () => {
    const hl = getHl();
    if (!hl) return;
    try {
      await hl.reset();
      setGhostMode(false);
      setSpecResults([]);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const passCount = (r: SpecResult) =>
    Object.values(r.pass).reduce((sum, s) => sum + s.size, 0);
  const failCount = (r: SpecResult) =>
    Object.values(r.fail).reduce((sum, s) => sum + s.size, 0);

  const disabled = !components;
  const hasResults = specResults.length > 0;

  return (
    <Panel
      title="IDS Checker"
      width={280}
      bodyStyle={{ padding: "8px 0" }}
      header={
        <>
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

            <div style={s.step}>
              <span style={s.stepNum}>2</span>
              <button
                onClick={handleRunCheck}
                disabled={disabled || loading || !idsFile}
                style={{
                  ...s.stepBtn,
                  background: !idsFile || loading ? colors.border : "#0f766e",
                  color: !idsFile || loading ? colors.textDisabled : "#fff",
                }}
              >
                {loading ? "Checking…" : "Run Check"}
              </button>
            </div>
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <div style={s.actions}>
            <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
              {ghostMode ? "Unghost" : "Ghost"}
            </Btn>
            <Btn onClick={handleClear} disabled={disabled} color={colors.textMuted}>
              Clear
            </Btn>
          </div>
        </>
      }
    >
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
              <button
                onClick={() => handleHistoryCheck(i)}
                disabled={disabled}
                style={{ ...s.stepBtn, marginTop: 8 }}
              >
                Show Check
              </button>
            </div>
          );
        })
      )}
    </Panel>
  );
}

const s: Record<string, React.CSSProperties> = {
  steps: { display: "flex", flexDirection: "column", gap: 8 },
  step: { display: "flex", alignItems: "flex-start", gap: 8 },
  stepNum: {
    width: 18, height: 18, borderRadius: "50%", background: colors.border,
    color: colors.accent, fontSize: 10, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  stepBtn: {
    width: "100%", padding: "5px 10px", borderRadius: 5, border: "none",
    background: colors.accentBold, color: "#fff", fontSize: 11,
    fontFamily: "monospace", fontWeight: 600, cursor: "pointer",
    textAlign: "left" as const,
  },
  fileName: {
    display: "block", color: colors.successLight, fontSize: 10, marginTop: 4,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  card: {
    margin: "0 10px 10px", padding: 10,
    background: colors.appBg, borderRadius: 7, border: `1px solid ${colors.border}`,
  },
  cardHeader: { marginBottom: 8 },
  cardName: { display: "block", color: colors.textPrimary, fontSize: 12, fontWeight: 700 },
  cardDesc: { display: "block", color: colors.textSecondary, fontSize: 10, marginTop: 3 },
  bar: { height: 6, borderRadius: 3, background: colors.border, marginBottom: 6, overflow: "hidden" },
  barFill: {
    height: "100%", borderRadius: 3,
    background: "linear-gradient(90deg, #22c55e, #86efac)",
    transition: "width 0.4s ease",
  },
  counts: { display: "flex", gap: 10, alignItems: "center" },
  pass: { color: colors.success, fontSize: 11, fontWeight: 600 },
  fail: { color: colors.error, fontSize: 11, fontWeight: 600 },
  pct: { color: colors.textMuted, fontSize: 10, marginLeft: "auto" },
};
