import { useEffect, useState } from "react";
import * as OBC from "@thatopen/components";
import { Btn } from "../../components/Btn";
import { Empty } from "../../components/Empty";
import { ErrorBanner } from "../../components/ErrorBanner";
import { colors } from "../../styles/tokens";
import { useBcfTester, type ImportedBcf, type ViewpointReport } from "./useBcfTester";

interface BcfTesterTabProps {
  components: OBC.Components | null;
  world: OBC.World | null;
}

/** Imports a BCF file, lists its tasks and shows a task's viewpoint in the viewport when it is clicked. */
export function BcfTesterTab({ components, world }: BcfTesterTabProps) {
  const tester = useBcfTester(components, world);
  const { imported, selectedTopic, activeViewpoint, report, importing, error } = tester;
  const { importFile, selectTopic, showViewpoint, resetView } = tester;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Lets the same file be imported again.
    if (file) importFile(file);
  };

  return (
    <div style={s.root}>
      <div style={s.listHeader}>
        <span style={s.count} title={imported?.fileName}>
          {imported ? `Aufgaben (${imported.topics.length})` : "Keine Datei"}
        </span>
        <label style={{ ...s.importBtn, ...(importing ? s.importBtnDisabled : null) }}>
          {importing ? "Importieren…" : "BCF importieren"}
          <input type="file" accept=".bcf,.bcfzip" hidden disabled={importing} onChange={handleFile} />
        </label>
      </div>

      <div style={s.list}>
        {!imported ? (
          <Empty>BCF-Datei importieren, um ihre Aufgaben zu prüfen.</Empty>
        ) : imported.topics.length === 0 ? (
          <Empty>Die Datei enthält keine Aufgaben.</Empty>
        ) : (
          imported.topics.map((topic) => {
            const selected = topic === selectedTopic;
            return (
              <div key={topic.guid} style={s.task}>
                <button onClick={() => selectTopic(topic)} style={{ ...s.taskBtn, ...(selected ? s.taskBtnSelected : null) }}>
                  <div style={s.taskTitle} title={topic.title}>{topic.title}</div>
                  <div style={s.taskMeta}>
                    {[topic.type, topic.status, topic.priority].filter(Boolean).join(" · ")}
                  </div>
                </button>
                {selected && (
                  <TopicDetails
                    topic={topic}
                    imported={imported}
                    activeViewpoint={activeViewpoint}
                    report={report}
                    onShowViewpoint={showViewpoint}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={s.footer}>
        {error && <div style={{ marginBottom: 8 }}><ErrorBanner>{error}</ErrorBanner></div>}
        <div style={s.footerRow}>
          <Btn color={colors.border} onClick={() => resetView()} disabled={!activeViewpoint}>
            Ansicht zurücksetzen
          </Btn>
        </div>
      </div>
    </div>
  );
}

interface TopicDetailsProps {
  topic: OBC.Topic;
  imported: ImportedBcf;
  activeViewpoint: string | null;
  report: ViewpointReport | null;
  onShowViewpoint: (viewpoint: OBC.Viewpoint) => void;
}

function TopicDetails({ topic, imported, activeViewpoint, report, onShowViewpoint }: TopicDetailsProps) {
  const viewpoints = [...topic.viewpoints].flatMap((guid) => imported.viewpoints.get(guid) ?? []);
  const comments = [...topic.comments.values()];

  return (
    <div style={s.details}>
      {topic.description && <div style={s.description}>{topic.description}</div>}
      <Info label="Zuständig" value={topic.assignedTo} />
      <Info label="Autor" value={topic.creationAuthor} />
      <Info label="Erstellt" value={formatDate(topic.creationDate)} />
      <Info label="Fällig" value={formatDate(topic.dueDate)} />
      <Info label="Labels" value={[...topic.labels].join(", ")} />

      <div style={s.sectionTitle}>Ansichten ({viewpoints.length})</div>
      {viewpoints.length === 0 && <div style={s.warning}>Diese Aufgabe hat keine Ansicht.</div>}
      <div style={s.viewpoints}>
        {viewpoints.map((viewpoint, i) => (
          <button
            key={viewpoint.guid}
            onClick={() => onShowViewpoint(viewpoint)}
            style={{ ...s.viewpointBtn, ...(viewpoint.guid === activeViewpoint ? s.viewpointBtnActive : null) }}
            title={`Ansicht ${i + 1} anzeigen`}
          >
            <Snapshot bytes={imported.snapshots.get(viewpoint.guid)} fallback={`Ansicht ${i + 1}`} />
          </button>
        ))}
      </div>
      {report && <ReportLine report={report} />}

      {comments.length > 0 && <div style={s.sectionTitle}>Kommentare ({comments.length})</div>}
      {comments.map((comment) => (
        <div key={comment.guid} style={s.comment}>
          <div style={s.commentMeta}>{comment.author} · {formatDate(comment.date)}</div>
          <div style={s.description}>{comment.comment}</div>
        </div>
      ))}
    </div>
  );
}

function ReportLine({ report }: { report: ViewpointReport }) {
  const missing = report.elementsTotal - report.elementsFound;
  return (
    <div style={s.report}>
      {!report.hasCamera && <div style={s.warning}>Keine Kamera gespeichert.</div>}
      {report.elementsTotal === 0 ? (
        <div>Keine Elemente referenziert.</div>
      ) : (
        <div style={missing > 0 ? s.warning : s.ok}>
          {report.elementsFound} von {report.elementsTotal} Elementen im Modell gefunden
        </div>
      )}
    </div>
  );
}

function Snapshot({ bytes, fallback }: { bytes?: Uint8Array; fallback: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bytes) return;
    const objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart]));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes]);

  return url ? <img src={url} alt={fallback} style={s.snapshot} /> : <span style={s.noSnapshot}>{fallback}</span>;
}

function Info({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={s.info}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value}</span>
    </div>
  );
}

function formatDate(date?: Date) {
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("de-CH") : undefined;
}

const s: Record<string, React.CSSProperties> = {
  root: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  listHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    padding: "10px 12px", flexShrink: 0,
  },
  count: {
    color: colors.textSecondary, fontSize: 11, fontWeight: 600,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  importBtn: {
    padding: "4px 10px", borderRadius: 5, background: colors.accentBold, color: "#fff",
    fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  },
  importBtnDisabled: { background: colors.border, color: colors.textDisabled, cursor: "not-allowed" },
  list: { flex: 1, overflowY: "auto", minHeight: 0 },
  task: { borderTop: `1px solid ${colors.borderSubtle}` },
  taskBtn: {
    display: "block", width: "100%", boxSizing: "border-box", padding: "8px 12px",
    background: "none", border: "none", borderLeft: "2px solid transparent",
    textAlign: "left", fontFamily: "monospace", cursor: "pointer",
  },
  taskBtnSelected: { background: colors.border, borderLeft: `2px solid ${colors.accent}` },
  taskTitle: {
    color: colors.textPrimary, fontSize: 12, fontWeight: 600,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  taskMeta: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  details: { padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 4 },
  description: { color: colors.textSecondary, fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  info: { display: "flex", gap: 8, fontSize: 10 },
  infoLabel: { color: colors.textMuted, flexShrink: 0, width: 56 },
  infoValue: { color: colors.textSecondary, minWidth: 0, overflowWrap: "anywhere" },
  sectionTitle: { color: colors.textSecondary, fontSize: 10, fontWeight: 600, marginTop: 8 },
  viewpoints: { display: "flex", flexWrap: "wrap", gap: 6 },
  viewpointBtn: {
    width: "100%", padding: 0, background: colors.appBg, cursor: "pointer", overflow: "hidden",
    border: `1px solid ${colors.border}`, borderRadius: 4,
  },
  viewpointBtnActive: { border: `1px solid ${colors.accent}` },
  snapshot: { display: "block", width: "100%", height: "auto" },
  noSnapshot: {
    display: "block", padding: "10px 0", textAlign: "center",
    color: colors.textMuted, fontSize: 10, fontFamily: "monospace",
  },
  report: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  ok: { color: colors.successLight, fontSize: 10 },
  warning: { color: colors.errorLight, fontSize: 10 },
  comment: { paddingTop: 6, borderTop: `1px solid ${colors.borderSubtle}` },
  commentMeta: { color: colors.textMuted, fontSize: 10, marginBottom: 2 },
  footer: { padding: "10px 12px", borderTop: `1px solid ${colors.border}`, flexShrink: 0 },
  footerRow: { display: "flex", justifyContent: "flex-end" },
};
