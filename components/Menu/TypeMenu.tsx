"use client";

import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { canvasNow } from "@/utils/menuUtils";
import { useFeaturesStore } from "@/store/featuresStore";
import {
  manageCharStyles,
  manageParaStyles,
  styleFromSelection,
} from "@/engine/charStyles";
import { runSpellCheck } from "@/engine/spellcheck";
import { findReplaceText } from "@/engine/findReplace";
import {
  createOutlines,
  createWorkPath,
  toggleOpenTypeFeature,
  setTextOrientation,
} from "@/engine/textTypeOps";

function entries(): MenuEntry[] {
  const canvas = canvasNow();
  const spellcheckOn = useFeaturesStore.getState().spellcheckOn;

  return [
    {
      label: "Character Styles…",
      onClick: () => void manageCharStyles(canvas),
    },
    {
      label: "Paragraph Styles…",
      onClick: () => void manageParaStyles(canvas),
    },
    {
      label: "Styles from Selection…",
      onClick: () => void styleFromSelection(canvas),
    },
    {
      label: "Create Outlines",
      onClick: () => void createOutlines(),
    },
    {
      label: "Create Work Path",
      onClick: () => void createWorkPath(),
    },
    { divider: true },
    {
      label: "OpenType",
      children: [
        {
          label: "Standard Ligatures",
          onClick: () => void toggleOpenTypeFeature("liga"),
        },
        {
          label: "Contextual Alternates",
          onClick: () => void toggleOpenTypeFeature("calt"),
        },
        {
          label: "Kerning",
          onClick: () => void toggleOpenTypeFeature("kern"),
        },
        {
          label: "Small Caps",
          onClick: () => void toggleOpenTypeFeature("smcp"),
        },
        {
          label: "Stylistic Set 1",
          onClick: () => void toggleOpenTypeFeature("ss01"),
        },
      ],
    },
    {
      label: "Orientation",
      children: [
        {
          label: "Horizontal",
          onClick: () => void setTextOrientation("horizontal"),
        },
        {
          label: "Vertical",
          onClick: () => void setTextOrientation("vertical"),
        },
      ],
    },
    { divider: true },
    {
      label: "Spell Check…",
      checked: spellcheckOn,
      onClick: () => void runSpellCheck(canvas),
    },
    {
      label: "Find and Replace…",
      onClick: () => void findReplaceText(canvas),
    },
  ];
}

export default function TypeMenu() {
  return <MenuButton title="Type" entries={entries()} />;
}
