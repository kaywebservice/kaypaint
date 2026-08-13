"use client";

import FileMenu from "./FileMenu";
import EditMenu from "./EditMenu";
import ImageMenu from "./ImageMenu";
import LayerMenu from "./LayerMenu";
import SelectMenu from "./SelectMenu";
import FilterMenu from "./FilterMenu";
import ViewMenu from "./ViewMenu";
import TypeMenu from "./TypeMenu";
import WindowMenu from "./WindowMenu";
import HelpMenu from "./HelpMenu";
import PluginMenu from "./PluginMenu";
import PluginMarket from "./PluginMarket";
import OptionDialog from "./OptionDialog";
import { Sparkles } from "lucide-react";

export default function MainMenu() {
  return (
    <div className="h-10 bg-gray-950 border-b border-white/5 flex items-center px-2 gap-1 text-sm">
      <span className="flex items-center gap-1.5 font-extrabold tracking-tight text-gradient px-3 select-none">
        <Sparkles size={14} strokeWidth={2.5} />
        KayPaint
      </span>

      <FileMenu />
      <EditMenu />
      <ImageMenu />
      <LayerMenu />
      <SelectMenu />
      <FilterMenu />
      <TypeMenu />
      <ViewMenu />
      <WindowMenu />
      <PluginMenu />
      <HelpMenu />
      <OptionDialog />
      <PluginMarket />
    </div>
  );
}