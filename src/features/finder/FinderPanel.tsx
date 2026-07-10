import { useState, useCallback } from "react";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { colors } from "../../styles/tokens";
import * as THREE from "three";
import { FrontFunctions } from "../hider/FrontFunctions";
import { Btn } from "../../components/Btn";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Panel } from "../../components/Panel";

interface FinderPanelProps {
  components: OBC.Components | null;
}

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}

const QUERY_NAME = "finder-query";

export function FinderPanel({ components }: FinderPanelProps) {
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ghostMode, setGhostMode] = useState(false);

  const getHl = useCallback((): FrontFunctions | null => {
    if (!components) return null;
    try { return components.get(FrontFunctions); } catch { return null; }
  }, [components]);

  const handleFind = useCallback(async (value: string) => {
    if (!components || !value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const finder = components.get(OBC.ItemsFinder);
      const fragments = components.get(OBC.FragmentsManager);

      // Remove previous query if exists
      if (finder.list.get(QUERY_NAME)) {
        finder.list.delete(QUERY_NAME);
      }

      finder.create(QUERY_NAME, [
        {
          categories: [/WALL/,/SLAB/,/BEAM/,/COLUMN/,/DOOR/,/WINDOW/],
          relation: {
            name: "IsDefinedBy",
            query: {
              relation: {
                name: "HasProperties",
                query: {
                  attributes: {
                    queries: [
                      { name: /Name/, value: /Allright_Bauteil_ID/ },
                      { name: /NominalValue/, value: new RegExp(value) },
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      const finderQuery = finder.list.get(QUERY_NAME);
      if (!finderQuery) {
        setError("Query could not be created.");
        return;
      }

      const modelIdMap = await finderQuery.test();
      if (!modelIdMap || Object.keys(modelIdMap).length === 0) {
        setError(`No elements found for: ${value}`);
        return;
      }

      await fragments.resetHighlight();
      await fragments.highlight(
        {
          customId: "isolate",
          color: new THREE.Color("darkred"),
          renderedFaces: FRAGS.RenderedFaces.ONE,
          opacity: 1,
          transparent: false,
        },
        modelIdMap
      );
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [components]);

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

  const handleReset = useCallback(async () => {
    if (!components) return;
    setResetting(true);
    setError(null);
    try {
      const fragments = components.get(OBC.FragmentsManager);
      await fragments.resetHighlight();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setResetting(false);
    }
  }, [components]);

  const disabled = !components;

  return (
    <Panel
      title="Allplanfinder"
      width={260}
      header={
        <>
          <div style={s.inputRow}>
            <Input
              value={input}
              onChange={setInput}
              onEnter={() => handleFind(input)}
            />
            <Btn
              onClick={() => handleFind(input)}
              disabled={disabled || loading || !input.trim()}
              color="#0f766e"
            >
              {loading ? "…" : "Find"}
            </Btn>
          </div>
          <div style={s.actions}>
            <Btn onClick={handleReset} disabled={disabled || resetting} color={colors.accentBold}>
              {resetting ? "Resetting…" : "Reset"}
            </Btn>
            <Btn onClick={handleToggleGhost} disabled={disabled} color="#7c3aed">
              {ghostMode ? "Unghost" : "Ghost"}
            </Btn>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
        </>
      }
    >
      {null}
    </Panel>
  );
}

function Input({ value, onChange, onEnter }: InputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.slice(0, 50));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onEnter?.();
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="z.B. 9304HWa0000012579"
      maxLength={50}
      style={s.input}
    />
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
};
