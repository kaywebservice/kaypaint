"use client";

import { useState } from "react";

export default function LibrariesPanel() {
  const [assets, setAssets] = useState<{ id: string; name: string; type: string; dataUrl: string }[]>([]);

  const addAsset = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newAsset = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
      };
      setAssets([...assets, newAsset]);
    };
    reader.readAsDataURL(file);
  };

  const placeAsset = (dataUrl: string) => {
    const store = (window as any).__kaypaintStore;
    if (!store?.getState?.()?.canvas) return;

    const canvas = store.getState().canvas;
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => {
      const fabricImg = new (require("fabric").FabricImage)(img);
      fabricImg.set({
        left: canvas.width / 2 - fabricImg.width / 2,
        top: canvas.height / 2 - fabricImg.height / 2,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });
      canvas.add(fabricImg);
      canvas.setActiveObject(fabricImg);
      fabricImg.setCoords();
      canvas.requestRenderAll();
      store.getState().history?.push?.();
    };
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">CC Libraries</label>
        <input
          type="file"
          accept="image/*,.svg"
          className="ml-auto text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addAsset(file);
          }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {assets.map((asset) => (
          <div key={asset.id} className="relative group">
            <button
              onClick={() => placeAsset(asset.dataUrl)}
              className="aspect-square rounded border border-gray-600 overflow-hidden"
              style={{ backgroundImage: `url(${asset.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
              title={asset.name}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white px-1 py-0.5 opacity-0 group-hover:opacity-100 transition">
              {asset.name}
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <div className="col-span-4 aspect-square rounded border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-500 text-xs">
            <span>Drag & drop or click to add assets</span>
            <span className="text-[10px]">Images, SVGs supported</span>
          </div>
        )}
      </div>
    </div>
  );
}