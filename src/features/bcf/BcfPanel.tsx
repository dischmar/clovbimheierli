import { useState } from "react";
import * as OBC from "@thatopen/components";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";
import { TabBar, type TabItem } from "../../components/TabBar";
import { colors } from "../../styles/tokens";
import { BcfTaskDialog } from "./BcfTaskDialog";
import { BcfTesterTab } from "./BcfTesterTab";
import { useBcfController } from "./useBcfController";

type TabId = "erstellen" | "tester";

const TABS: TabItem<TabId>[] = [
  { id: "erstellen", label: "Erstellen" },
  { id: "tester", label: "Tester" },
];

interface BcfPanelProps {
  components: OBC.Components | null;
  world: OBC.World | null;
  onClose: () => void;
}

/** Manually written BCF tasks: add them one by one, then export the list as a single BCF file. */
export function BcfPanel({ components, world, onClose }: BcfPanelProps) {
  const controller = useBcfController(components, world);
  const { tasks, error, exporting, author, addTask, removeTask, exportBcf } = controller;
  const [activeTab, setActiveTab] = useState<TabId>("erstellen");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Panel
      title="BCF"
      width={260}
      onClose={onClose}
      bodyStyle={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* useRaycaster listens on window: without this, a click here also picks the element behind the panel. */}
      <div style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>
      <TabBar tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === "tester" ? (
        <BcfTesterTab components={components} world={world} />
      ) : (
        <>
          <div style={s.listHeader}>
            <span style={s.count}>Aufgaben ({tasks.length})</span>
            <button onClick={() => setDialogOpen(true)} style={s.addBtn} title="Neue Aufgabe">+</button>
          </div>

          <div style={s.list}>
            {tasks.length === 0 ? (
              <Empty>Noch keine Aufgaben. Mit + eine Aufgabe erstellen.</Empty>
            ) : (
              tasks.map((task) => (
                <div key={task.guid} style={s.task}>
                  <div style={s.taskText}>
                    <div style={s.taskTitle} title={task.title}>{task.title}</div>
                    {task.description && <div style={s.taskDescription}>{task.description}</div>}
                    <div style={s.taskMeta}>
                      {[task.type, task.priority, task.assignedTo].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button onClick={() => removeTask(task)} style={s.removeBtn} title="Aufgabe löschen">×</button>
                </div>
              ))
            )}
          </div>

          <div style={s.footer}>
            {error && !dialogOpen && <div style={{ marginBottom: 8 }}><ErrorBanner>{error}</ErrorBanner></div>}
            <div style={s.exportRow}>
              <Btn color={colors.accentBold} onClick={exportBcf} disabled={tasks.length === 0 || exporting}>
                {exporting ? "Exportieren…" : "Als BCF exportieren"}
              </Btn>
            </div>
          </div>
        </>
      )}

      {dialogOpen && (
        <BcfTaskDialog
          components={components}
          world={world}
          defaultAuthor={author}
          error={error}
          onSave={addTask}
          onClose={() => setDialogOpen(false)}
        />
      )}
      </div>
    </Panel>
  );
}

const s: Record<string, React.CSSProperties> = {
  listHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 12px", flexShrink: 0,
  },
  count: { color: colors.textSecondary, fontSize: 11, fontWeight: 600 },
  addBtn: {
    width: 26, height: 26, padding: 0, borderRadius: 5, border: "none",
    background: colors.accentBold, color: "#fff",
    fontSize: 18, lineHeight: 1, fontFamily: "monospace", cursor: "pointer",
  },
  list: { flex: 1, overflowY: "auto", minHeight: 0 },
  task: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "8px 12px", borderTop: `1px solid ${colors.borderSubtle}`,
  },
  taskText: { flex: 1, minWidth: 0 },
  taskTitle: {
    color: colors.textPrimary, fontSize: 12, fontWeight: 600,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  taskDescription: {
    color: colors.textSecondary, fontSize: 11, marginTop: 3,
    whiteSpace: "pre-wrap", overflowWrap: "anywhere",
  },
  taskMeta: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  removeBtn: {
    background: "none", border: "none", color: colors.textMuted,
    cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
  },
  footer: { padding: "10px 12px", borderTop: `1px solid ${colors.border}`, flexShrink: 0 },
  exportRow: { display: "flex", justifyContent: "flex-end" },
};
