import { useState } from "react";
import * as OBC from "@thatopen/components";
import { Btn } from "../../components/Btn";
import { ErrorBanner } from "../../components/ErrorBanner";
import { colors } from "../../styles/tokens";
import type { BcfTaskInput } from "./useBcfController";
import { useBcfElementPicker } from "./useBcfElementPicker";

const TYPES = ["Issue", "Fault", "Clash", "Request", "Inquiry", "Remark"];
const PRIORITIES = ["Minor", "Normal", "Major", "Critical"];

interface BcfTaskDialogProps {
  components: OBC.Components | null;
  world: OBC.World | null;
  defaultAuthor: string;
  error: string | null;
  onSave: (input: BcfTaskInput) => Promise<boolean>;
  onClose: () => void;
}

/** Separate window for entering one task. Closes only once the task has been saved. */
export function BcfTaskDialog({ components, world, defaultAuthor, error, onSave, onClose }: BcfTaskDialogProps) {
  const { picking, guids, startPicking, stopPicking, clearPicks } = useBcfElementPicker(components, world);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [priority, setPriority] = useState("Normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [author, setAuthor] = useState(defaultAuthor);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() !== "" && author.trim() !== "" && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const saved = await onSave({
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      assignedTo: assignedTo.trim(),
      author: author.trim(),
      elementGuids: guids,
    });
    setSaving(false);
    if (saved) onClose();
  };

  // The dialog gives way to a small bar so the model can be clicked; its fields keep their values.
  if (picking) {
    return (
      <div style={s.pickBar}>
        <span style={s.pickText}>Elemente im Modell anklicken ({guids.length})</span>
        <Btn color={colors.accentBold} onClick={stopPicking}>Fertig</Btn>
      </div>
    );
  }

  return (
    <div style={s.backdrop}>
      <form
        style={s.dialog}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div style={s.titleRow}>
          <span style={s.heading}>Neue Aufgabe</span>
          <button type="button" onClick={onClose} style={s.closeBtn} title="Schliessen">×</button>
        </div>

        <Field label="Titel *">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} style={s.input} />
        </Field>
        <Field label="Beschreibung">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...s.input, resize: "vertical" }} />
        </Field>
        <div style={s.row}>
          <Field label="Typ">
            <select value={type} onChange={(e) => setType(e.target.value)} style={s.input}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Priorität">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={s.input}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Zuständig">
          <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={s.input} />
        </Field>
        <Field label="Autor *">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} style={s.input} />
        </Field>

        <div style={s.elementsRow}>
          <span style={s.label}>Elemente ({guids.length})</span>
          <div style={s.elementsActions}>
            {guids.length > 0 && <Btn color={colors.border} onClick={clearPicks}>Leeren</Btn>}
            <Btn color={colors.accentBold} onClick={startPicking}>Im Modell auswählen</Btn>
          </div>
        </div>

        <div style={s.hint}>Die aktuelle Kameraansicht wird mit der Aufgabe gespeichert.</div>
        {error && <ErrorBanner>{error}</ErrorBanner>}

        <div style={s.actions}>
          <Btn color={colors.border} onClick={onClose}>Abbrechen</Btn>
          <Btn color={colors.accentBold} onClick={handleSave} disabled={!canSave}>
            {saving ? "Speichern…" : "Speichern"}
          </Btn>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      {children}
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.45)",
  },
  dialog: {
    width: 360, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
    boxSizing: "border-box", padding: 16, borderRadius: 8,
    background: colors.panelBg, border: `1px solid ${colors.border}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontFamily: "monospace",
  },
  titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  heading: { color: colors.accent, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  closeBtn: {
    background: "none", border: `1px solid ${colors.border}`, color: colors.textMuted,
    cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 7px", borderRadius: 4,
  },
  row: { display: "flex", gap: 8 },
  field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, flex: 1, minWidth: 0 },
  label: { color: colors.textSecondary, fontSize: 10 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 5,
    border: `1px solid ${colors.border}`, background: colors.appBg, color: colors.textPrimary,
    fontSize: 12, fontFamily: "monospace",
  },
  hint: { color: colors.textMuted, fontSize: 10 },
  elementsRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  elementsActions: { display: "flex", gap: 6 },
  pickBar: {
    position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 100,
    display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8,
    background: colors.panelBg, border: `1px solid ${colors.accent}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontFamily: "monospace",
  },
  pickText: { color: colors.textPrimary, fontSize: 12 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },
};
