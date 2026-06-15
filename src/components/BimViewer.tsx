import { useRef, useCallback, useState } from "react";
import { useBimWorld } from "../hooks/useBimWorld";
import { useRaycaster } from "../hooks/useRaycaster";
import { PropertiesPanel } from "./PropertiesPanel";
import { IdsPanel } from "./IdsPanel";
import { ClassifierPanel } from "./ClassifierPanel";
import { FinderPanel } from "./ItemsFinder";
import { AttributeChecker } from "./AttributeChecker_old";

type ActivePanel = "properties" | "ids" | "classifier" | "finder" | "checker" | null;

export default function BimViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { worldRef, ready, loading, progress, error, modelLoaded, loadIfc } = useBimWorld(containerRef);
  const { selected, clearSelection } = useRaycaster(worldRef);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadIfc(file);
    e.target.value = "";
  }, [loadIfc]);

  const togglePanel = (panel: ActivePanel) =>
    setActivePanel((p) => (p === panel ? null : panel));

  const components = worldRef.current?.components ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", background: "#0d0d14", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 48, flexShrink: 0, background: "#12121e", borderBottom: "1px solid #1e1e38" }}>
        <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14, fontFamily: "monospace", letterSpacing: 1, marginRight: 4 }}>HeierliBIM</span>

        <label style={{ padding: "5px 14px", borderRadius: 6, background: "#6d28d9", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: !ready || loading ? "not-allowed" : "pointer", opacity: !ready || loading ? 0.5 : 1, userSelect: "none" }}>
          {loading ? `Converting… ${progress}%` : "Load IFC"}
          <input type="file" accept=".ifc" hidden disabled={!ready || loading} onChange={onFileChange} />
        </label>

        {modelLoaded && (
          <>
            <PanelToggle
              label="Properties"
              active={activePanel === "properties"}
              onClick={() => togglePanel("properties")}
            />
            <PanelToggle
              label="IDS"
              active={activePanel === "ids"}
              onClick={() => togglePanel("ids")}
            />
            <PanelToggle
              label="Classify"
              active={activePanel === "classifier"}
              onClick={() => togglePanel("classifier")}
            />
            <PanelToggle
              label="HeierliChecker"
              active={activePanel === "checker"}
              onClick={() => togglePanel("checker")}
            />
            <PanelToggle
              label="Finder"
              active={activePanel === "finder"}
              onClick={() => togglePanel("finder")}
            />
          </>
        )}

        {modelLoaded && !loading && <span style={{ color: "#34d399", fontSize: 12, fontFamily: "monospace" }}>✓ Loaded</span>}
        {error && <span style={{ color: "#f87171", fontSize: 12, fontFamily: "monospace", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error}</span>}
        {modelLoaded && <span style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace", marginLeft: "auto" }}>Click to inspect</span>}
      </div>

      {/* Progress bar */}
      {loading && (
        <div style={{ height: 3, background: "#1e1e38", flexShrink: 0 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#a78bfa", transition: "width 0.2s" }} />
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* 3D Viewport */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {!ready && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontSize: 14, fontFamily: "monospace", background: "#0d0d14", pointerEvents: "none" }}>
              Initialising engine…
            </div>
          )}
        </div>

        {/* Panels — always mounted when active, never conditional on selection */}
        {activePanel === "properties" && (
          <PropertiesPanel
            selected={selected ?? null}
            onClose={() => {
              clearSelection();
              setActivePanel(null);
            }}
          />
        )}

        {activePanel === "ids" && (
          <IdsPanel components={components} />
        )}

        {activePanel === "classifier" && (
          <ClassifierPanel components={components} />
        )}

        {activePanel === "finder" && (
          <FinderPanel components={components} />
        )}

                {activePanel === "checker" && (
          <AttributeChecker components={components} />
        )}

      </div>
    </div>
  );
}

function PanelToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        borderRadius: 5,
        border: `1px solid ${active ? "#a78bfa" : "#1e1e38"}`,
        background: active ? "#1e1e38" : "transparent",
        color: active ? "#a78bfa" : "#6b7280",
        fontSize: 11,
        fontFamily: "monospace",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}