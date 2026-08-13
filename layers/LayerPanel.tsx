"use client";

import { useEffect, useState } from "react";
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";
import { objectForLayer } from "@/store/layerStore";
import type { AdjustmentType } from "@/engine/adjustmentEngine";

export default function LayerPanel() {
  const canvas = useEditorStore((state) => state.canvas);

  const {
    layers,
    activeLayer,
    groups,
    addLayer,
    removeLayer,
    toggleVisibility,
    toggleLock,
    setActiveLayer,
    setOpacity,
    setBlendMode,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    bringLayerToFront,
    sendLayerToBack,
    createGroup,
    addToGroup,
    removeFromGroup,
    deleteGroup,
    toggleGroupCollapsed,
    toggleGroupVisibility,
    renameGroup,
    groupForLayer,
    addAdjustmentLayer,
  } = useLayerStore();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const getObject = (layer: any) => objectForLayer(canvas, layer);

  const selectLayer = (layer: any) => {
    if (editingGroupId === layer.id) return;
    setActiveLayer(layer.id);
    const object = getObject(layer);
    if (!object || !canvas) return;
    object.set({ selectable: !layer.locked, evented: !layer.locked });
    canvas.setActiveObject(object);
    object.setCoords();
    canvas.requestRenderAll();
  };

  const startGroupRename = (e: React.MouseEvent, group: any) => {
    e.stopPropagation();
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const finishGroupRename = (group: any) => {
    const name = editingName.trim();
    if (name && name !== group.name) renameGroup(group.id, name);
    setEditingGroupId(null);
    setEditingName("");
  };

  const handleVisibility = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    const newVisible = !layer.visible;
    if (object && canvas) {
      object.set({ visible: newVisible });
      if (!newVisible) canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
    toggleVisibility(layer.id);
  };

  const handleLock = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    toggleLock(layer.id);
  };

  const handleOpacity = (e: React.ChangeEvent<HTMLInputElement>, layer: any) => {
    const opacity = Number(e.target.value);
    setOpacity(layer.id, opacity);
    const object = getObject(layer);
    if (object && canvas) {
      object.set({ opacity: opacity / 100 });
      canvas.requestRenderAll();
    }
  };

  const handleBlendMode = (e: React.ChangeEvent<HTMLSelectElement>, layer: any) => {
    const blendMode = e.target.value;
    setBlendMode(layer.id, blendMode);
    const object = getObject(layer);
    if (object && canvas) {
      object.set({ globalCompositeOperation: blendMode });
      canvas.requestRenderAll();
    }
  };

  const handleDuplicate = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    duplicateLayer(layer.id);
  };

  const handleMoveUp = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    if (object && canvas) {
      canvas.bringObjectForward(object);
      canvas.requestRenderAll();
    }
    moveLayerUp(layer.id);
  };

  const handleMoveDown = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    if (object && canvas) {
      canvas.sendObjectBackwards(object);
      canvas.requestRenderAll();
    }
    moveLayerDown(layer.id);
  };

  const handleFront = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    if (object && canvas) {
      canvas.bringObjectToFront(object);
      canvas.requestRenderAll();
    }
    bringLayerToFront(layer.id);
  };

  const handleBack = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    if (object && canvas) {
      canvas.sendObjectToBack(object);
      canvas.requestRenderAll();
    }
    sendLayerToBack(layer.id);
  };

  const handleDelete = (e: React.MouseEvent, layer: any) => {
    e.stopPropagation();
    const object = getObject(layer);
    if (object && canvas) {
      if (canvas.getActiveObject() === object) canvas.discardActiveObject();
      canvas.remove(object);
      canvas.requestRenderAll();
    }
    removeLayer(layer.id);
  };

  useEffect(() => {
    if (!canvas) return;

    const handleCanvasSelection = (event: any) => {
      const object = event.selected?.[0];
      if (!object?.kaypaintId) return;
      const layer = useLayerStore.getState().layers.find(
        (item) => item.objectId === object.kaypaintId
      );
      if (layer) setActiveLayer(layer.id);
    };

    canvas.on("selection:created", handleCanvasSelection);
    canvas.on("selection:updated", handleCanvasSelection);

    return () => {
      canvas.off("selection:created", handleCanvasSelection);
      canvas.off("selection:updated", handleCanvasSelection);
    };
  }, [canvas, setActiveLayer]);

  const inGroup = (layerId: string) => !!groupForLayer(layerId);
  const groupMembership = (layerId: string) => groupForLayer(layerId)?.id ?? "";

  const layerVisible = (layer: any) => {
    const g = groupForLayer(layer.id);
    return layer.visible && (!g || g.visible);
  };

  const groupedOrder = () => {
    const ordered = [...groups].sort((a, b) => {
      const ia = Math.min(...a.children.map((c) => layers.findIndex((l) => l.id === c)).filter((i) => i >= 0));
      const ib = Math.min(...b.children.map((c) => layers.findIndex((l) => l.id === c)).filter((i) => i >= 0));
      return (ia === Infinity ? 9999 : ia) - (ib === Infinity ? 9999 : ib);
    });
    return ordered;
  };

  let renderedLayers = new Set<string>();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 gap-1">
        <h2 className="font-bold text-sm">Layers</h2>
        <div className="flex items-center gap-1">
          <select
            title="Add adjustment layer"
            onChange={(e) => {
              if (e.target.value) {
                addAdjustmentLayer(e.target.value as AdjustmentType);
              }
              e.target.value = "";
            }}
            className="text-[10px] bg-gray-800 border border-gray-600 rounded px-1 py-1 text-gray-300"
          >
            <option value="">+ Adj</option>
            <option value="levels">Levels</option>
            <option value="curves">Curves</option>
            <option value="hueSat">Hue/Saturation</option>
          </select>
          <button
            title="New group"
            onClick={() => {
              const ids = activeLayer ? [activeLayer] : [];
              createGroup(ids);
            }}
            className="text-[10px] bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300"
          >
            📁
          </button>
          <button
            onClick={addLayer}
            title="New layer"
            className="text-[10px] font-bold bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {layers.length === 0 && groups.length === 0 && (
          <p className="text-gray-500 text-xs">No Layers</p>
        )}

        {groupedOrder().map((group) => {
          const memberLayers = group.children
            .map((id) => layers.find((l) => l.id === id))
            .filter(Boolean);
          memberLayers.forEach((l: any) => renderedLayers.add(l.id));

          return (
            <div key={group.id} className="rounded border border-gray-700 bg-gray-800/40 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border-b border-gray-700 select-none">
                <button
                  onClick={() => toggleGroupCollapsed(group.id)}
                  className={`w-3.5 text-gray-400 transition-transform ${group.collapsed ? "" : "rotate-90"}`}
                  title={group.collapsed ? "Expand" : "Collapse"}
                >
                  ▶
                </button>
                <span className="text-gray-500 text-xs">📁</span>
                {editingGroupId === group.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => finishGroupRename(group)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishGroupRename(group);
                      if (e.key === "Escape") {
                        setEditingGroupId(null);
                        setEditingName("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-gray-900 border border-indigo-400 rounded px-1 text-xs"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startGroupRename(e, group)}
                    className="flex-1 truncate text-xs font-medium text-gray-200"
                    title="Double-click to rename"
                  >
                    {group.name} ({memberLayers.length})
                  </span>
                )}
                <button
                  onClick={() => toggleGroupVisibility(group.id)}
                  className="text-xs px-1 text-gray-400 hover:text-white"
                  title="Toggle group visibility"
                >
                  {group.visible ? "👁" : "🚫"}
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-xs px-1 text-gray-500 hover:text-red-400"
                  title="Delete group (keeps layers)"
                >
                  ✕
                </button>
              </div>

              {!group.collapsed && (
                <div className="pl-3 py-1 space-y-1">
                  {memberLayers.length === 0 && (
                    <p className="text-[10px] text-gray-600 px-1">Empty group</p>
                  )}
                  {memberLayers.map((layer: any) => (
                    <LayerRow
                      key={layer.id}
                      layer={layer}
                      active={activeLayer === layer.id}
                      selectable={!layer.locked}
                      visible={layerVisible(layer)}
                      onSelect={() => selectLayer(layer)}
                      onVisibility={(e) => handleVisibility(e, layer)}
                      onLock={(e) => handleLock(e, layer)}
                      onDelete={(e) => handleDelete(e, layer)}
                      onBlend={(e) => handleBlendMode(e, layer)}
                      onOpacity={(e) => handleOpacity(e, layer)}
                      onDuplicate={(e) => handleDuplicate(e, layer)}
                      onMoveUp={(e) => handleMoveUp(e, layer)}
                      onMoveDown={(e) => handleMoveDown(e, layer)}
                      onFront={(e) => handleFront(e, layer)}
                      onBack={(e) => handleBack(e, layer)}
                      onMoveToGroup={(gid) =>
                        gid ? addToGroup(layer.id, gid) : removeFromGroup(layer.id)
                      }
                      groups={groups}
                      groupId={groupMembership(layer.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {layers
          .filter((l) => !renderedLayers.has(l.id))
          .map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={activeLayer === layer.id}
              selectable={!layer.locked}
              visible={layerVisible(layer)}
              onSelect={() => selectLayer(layer)}
              onVisibility={(e) => handleVisibility(e, layer)}
              onLock={(e) => handleLock(e, layer)}
              onDelete={(e) => handleDelete(e, layer)}
              onBlend={(e) => handleBlendMode(e, layer)}
              onOpacity={(e) => handleOpacity(e, layer)}
              onDuplicate={(e) => handleDuplicate(e, layer)}
              onMoveUp={(e) => handleMoveUp(e, layer)}
              onMoveDown={(e) => handleMoveDown(e, layer)}
              onFront={(e) => handleFront(e, layer)}
              onBack={(e) => handleBack(e, layer)}
              onMoveToGroup={(gid) =>
                gid ? addToGroup(layer.id, gid) : removeFromGroup(layer.id)
              }
              groups={groups}
              groupId={groupMembership(layer.id)}
            />
          ))}
      </div>
    </div>
  );
}

function LayerRow(props: {
  layer: any;
  active: boolean;
  selectable: boolean;
  visible: boolean;
  groups: { id: string; name: string }[];
  groupId: string;
  onSelect: () => void;
  onVisibility: (e: React.MouseEvent) => void;
  onLock: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onBlend: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onOpacity: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onMoveUp: (e: React.MouseEvent) => void;
  onMoveDown: (e: React.MouseEvent) => void;
  onFront: (e: React.MouseEvent) => void;
  onBack: (e: React.MouseEvent) => void;
  onMoveToGroup: (groupId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [editingName, setEditingName] = useState(props.layer.name);
  const [opacity, setOpacity] = useState(props.layer.opacity);
  const [blend, setBlend] = useState(props.layer.blendMode);

  useEffect(() => {
    setOpacity(props.layer.opacity);
    if (!renaming) setEditingName(props.layer.name);
  }, [props.layer.opacity, props.layer.name, renaming]);

  const finish = () => {
    const name = editingName.trim();
    if (name && name !== props.layer.name) {
      useLayerStore.getState().renameLayer(props.layer.id, name);
    }
    setRenaming(false);
  };

  const isAdjustment = props.layer.type === "adjustment";

  const nameEl = renaming ? (
    <input
      autoFocus
      value={editingName}
      onChange={(e) => setEditingName(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish();
        if (e.key === "Escape") {
          setEditingName(props.layer.name);
          setRenaming(false);
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-gray-900 border border-indigo-400 rounded px-1 text-[11px]"
    />
  ) : (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingName(props.layer.name);
        setRenaming(true);
      }}
      className="block truncate text-[11px] leading-tight"
      title="Double-click to rename"
    >
      {props.layer.name}
    </span>
  );

  return (
    <div
      onClick={props.onSelect}
      className={`rounded p-1.5 cursor-pointer select-none transition-colors ${
        props.active ? "bg-indigo-500/25 border border-indigo-400/40" : "bg-gray-800 hover:bg-gray-700/60 border border-transparent"
      }`}
      style={{ opacity: props.visible ? 1 : 0.55 }}
    >
      <div
        className="flex items-center gap-1.5"
        title={isAdjustment ? "Adjustment layer — edit params in Properties" : props.layer.name}
      >
        <div className="w-8 h-7 rounded bg-gray-900 border border-gray-600 shrink-0 flex items-center justify-center text-[9px] text-gray-500">
          {isAdjustment ? "ADJ" : props.layer.objectId ? (props.layer.type === "text" ? "T" : "IMG") : "—"}
        </div>

        <div className="flex-1 min-w-0">
          {nameEl}
          {isAdjustment && (
            <span className="block text-[9px] text-indigo-300/70 leading-tight">non-destructive</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {props.groups.length > 0 && !isAdjustment ? (
            <select
              title="Move to group"
              value={props.groupId}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => props.onMoveToGroup(e.target.value)}
              className="bg-transparent text-[10px] text-gray-400 border border-gray-600 rounded px-0.5"
            >
              <option value="">—</option>
              {props.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : null}
          <button onClick={props.onVisibility} className="px-0.5 text-[11px]" title="Visibility">
            {props.visible ? "👁" : "🚫"}
          </button>
          <button onClick={props.onLock} className="px-0.5 text-[11px]" title="Lock">
            {props.layer.locked ? "🔒" : "🔓"}
          </button>
          <button onClick={props.onDelete} className="px-0.5 text-[11px] hover:text-red-400" title="Delete">
            ✕
          </button>
        </div>
      </div>

      {props.active && (
        <div className="mt-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-10 text-gray-400">Opacity</span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => {
                setOpacity(Number(e.target.value));
                props.onOpacity(e);
              }}
              className="flex-1 h-1"
            />
            <span className="w-7 text-gray-400">{opacity}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-10 text-gray-400">Blend</span>
            <select
              value={blend}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                setBlend(e.target.value);
                props.onBlend(e);
              }}
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-1 py-0.5 text-[11px]"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
              <option value="hue">Hue</option>
              <option value="saturation">Saturation</option>
              <option value="color">Color</option>
              <option value="luminosity">Luminosity</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button onClick={props.onDuplicate} className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]">
              Duplicate
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingName(props.layer.name);
                setRenaming(true);
              }}
              className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]"
            >
              Rename
            </button>
            <button onClick={props.onMoveUp} className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]">
              ↑ Up
            </button>
            <button onClick={props.onMoveDown} className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]">
              ↓ Down
            </button>
            <button onClick={props.onFront} className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]">
              Front
            </button>
            <button onClick={props.onBack} className="bg-gray-900 hover:bg-gray-700 rounded px-1 py-1 text-[10px]">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}