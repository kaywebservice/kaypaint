"use client";

import { useEditorStore } from "@/store/editorStore";
import { Path, Circle } from "fabric";

export default function PathsPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const [paths, setPaths] = useState<{ id: string; name: string; points: any[] }[]>([]);

  const createPathFromSelection = () => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || active.type !== "path") return;

    const pathData = active.path;
    const newPath = {
      id: Date.now().toString(),
      name: `Path ${paths.length + 1}`,
      points: pathData,
    };
    setPaths([...paths, newPath]);
  };

  const loadPath = (pathData: any) => {
    if (!canvas) return;
    const path = new Path(pathData, {
      fill: "",
      stroke: "#000000",
      strokeWidth: 2,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
    });
    canvas.add(path);
    canvas.setActiveObject(path);
    canvas.requestRenderAll();
  };

  const deletePath = (id: string) => {
    setPaths(paths.filter((p) => p.id !== id));
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-xs">Paths</span>
        <button
          onClick={createPathFromSelection}
          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded"
        >
          New Path
        </button>
      </div>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {paths.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No paths saved.<br />
            Select a path and click "New Path"
          </div>
        ) : (
          paths.map((path) => (
            <div key={path.id} className="flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600">
              <button
                onClick={() => loadPath(path.points)}
                className="flex-1 text-left text-xs truncate text-white hover:text-blue-300"
              >
                {path.name}
              </button>
              <button
                onClick={() => deletePath(path.id)}
                className="text-red-400 hover:text-red-300 px-2"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-gray-700 pt-2 text-xs text-gray-500">
        Draw with Pen Tool (P), then save as path.
      </div>
    </div>
  );
}

import { useState } from "react";