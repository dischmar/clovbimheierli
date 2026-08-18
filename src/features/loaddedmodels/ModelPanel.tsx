import { useState } from "react";
import * as OBC from "@thatopen/components";
import { colors } from "../../styles/tokens";
import { Panel } from "../../components/Panel";
import type { SelectedItem } from "../../types/ifc";

interface ModelPanelProps {
  components: OBC.Components | null;
  loading: boolean;
  onLoadIfc: (file: File) => Promise<void>;
  selected: SelectedItem | null;
  onClearSelection: () => void;
  activatedPanel: string;
}




export function ModelPanel({ components, loading: ifcLoading, onLoadIfc }: ModelPanelProps) {

  const [schalungName, setSchalungName] = useState<string | null>(null);
  const [bewehrungName, setBewehrungName] = useState<string | null>(null);




  const loadModel = async (file: File, setName: (name: string) => void) => {
    await onLoadIfc(file);
    if (!components) return;
    const fragments = components.get(OBC.FragmentsManager);
    const models = [...fragments.list.values()];
    const latest = models[models.length - 1];
    if (!latest) return;
    const metadata = await latest.getMetadata();
    setName(metadata?.names?.[0] ?? latest.modelId);
  };

  const handleSchalungFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadModel(file, setSchalungName);
    e.target.value = "";
  };

  const handleBewehrungFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadModel(file, setBewehrungName);
    e.target.value = "";
  };

  const disabled = !components;

  return (
    <Panel
      title="Model Overview"
      width={260}
      side="left"
    //   header={
    //     <>
    //       <div style={s.actions}>
    //         <Btn onClick={handleModelIdMap} disabled={disabled || resetting} color={colors.accentBold}>
    //           {resetting ? "Resetting…" : "Reset"}
    //         </Btn>
    //         <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
    //           {ghostMode ? "Unghost" : "Ghost"}
    //         </Btn>
    //       </div>
    //       {error && <ErrorBanner>{error}</ErrorBanner>}
    //     </>
    //   }
    >
      <div style={s.modelRow}>
        <span style={s.modelLabel}>Schalungsmodell:</span>
        {schalungName ? (
          <span style={s.modelName}>{schalungName}</span>
        ) : (
          <label style={{ ...s.loadBtn, ...((disabled || ifcLoading) && s.loadBtnDisabled) }}>
            {ifcLoading ? "Loading…" : "Load IFC"}
            <input type="file" accept=".ifc" hidden disabled={disabled || ifcLoading} onChange={handleSchalungFile} />
          </label>
        )}
      </div>
      <div style={s.modelRow}>
        <span style={s.modelLabel}>Bewehrungsmodell:</span>
        {bewehrungName ? (
          <span style={s.modelName}>{bewehrungName}</span>
        ) : (
          <label style={{ ...s.loadBtn, ...((disabled || ifcLoading) && s.loadBtnDisabled) }}>
            {ifcLoading ? "Loading…" : "Load IFC"}
            <input type="file" accept=".ifc" hidden disabled={disabled || ifcLoading} onChange={handleBewehrungFile} />
          </label>
        )}
      </div>
    </Panel>
  );
}



const s: Record<string, React.CSSProperties> = {
  inputRow: { display: "flex", gap: 6, marginBottom: 6 },
  actions: { display: "flex", gap: 6 },
  input: {
    flex: 1, padding: "4px 8px", borderRadius: 5,
    border: `1px solid ${colors.border}`, background: colors.panelBg,
    color: colors.textPrimary, fontSize: 11, fontFamily: "monospace",
    minWidth: 0,
  },
  modelRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, padding: "10px 12px", borderBottom: `1px solid ${colors.border}`,
  },
  modelLabel: {
    color: colors.textPrimary, fontSize: 11, fontFamily: "monospace",
  },
  modelName: {
    color: colors.accent, fontSize: 11, fontFamily: "monospace",
    fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", maxWidth: 150,
  },
  loadBtn: {
    padding: "4px 10px", borderRadius: 5, background: "#6d28d9",
    color: "#fff", fontSize: 10, fontFamily: "monospace", fontWeight: 600,
    cursor: "pointer", userSelect: "none", flexShrink: 0,
  },
  loadBtnDisabled: { cursor: "not-allowed", opacity: 0.5 },
};
