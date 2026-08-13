"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, FabricObject } from "fabric";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";

export default function KayCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvas = useEditorStore((state) => state.setCanvas);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 2000,
      height: 2000,
      backgroundColor: "white",
      selection: true,
      preserveObjectStacking: true,
    });

    setCanvas(canvas);

    const handleObjectSelected = (event: any) => {
      const object = event.selected?.[0];
      if (!object?.kaypaintId) return;

      const layers = useLayerStore?.getState?.().layers ?? [];
      const layer = layers.find(
        (item: any) => item.objectId === object.kaypaintId
      );

      if (layer) {
        useLayerStore.getState().setActiveLayer(layer.id);
      }
    };

    const handleObjectModified = (event: any) => {
      const object = event.target;
      if (!object) return;
      object.setCoords();
      canvas.requestRenderAll();
    };

    const updateZoomDisplay = () => {
      setZoom(Math.round(canvas.getZoom() * 100));
    };

    const handleWheel = (opt: any) => {
      const e = opt.e as WheelEvent;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const newZoom = Math.max(
          0.1,
          Math.min(8, canvas.getZoom() * (e.deltaY > 0 ? 0.92 : 1.08))
        );
        canvas.zoomToPoint(canvas.getScenePoint(e as any), newZoom);
        canvas.requestRenderAll();
        updateZoomDisplay();
      }
    };

    canvas.on("selection:created", handleObjectSelected);
    canvas.on("selection:updated", handleObjectSelected);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("mouse:wheel", handleWheel);
    canvas.on("after:render", updateZoomDisplay);

    updateZoomDisplay();

    return () => {
      canvas.off("selection:created", handleObjectSelected);
      canvas.off("selection:updated", handleObjectSelected);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("mouse:wheel", handleWheel);
      canvas.off("after:render", updateZoomDisplay);
      setCanvas(null);
      canvas.dispose();
    };
  }, [setCanvas]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}