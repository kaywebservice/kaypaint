import { canvasNow } from "@/engine/pixelOps";
import { runActionCommand, BUILTIN_ACTIONS, downloadBlob } from "@/engine/actionsEngine";
import { useFeaturesStore } from "@/store/featuresStore";
import { showOptions } from "@/components/Menu/OptionDialog";

function encodeBase64Url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(s: string): unknown {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function dropletHtml(name: string, stepsUrl: string, stepsJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Kaypaint Droplet — ${name}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #111827; color: #e5e7eb; font-family: system-ui, sans-serif; }
  .card { max-width: 560px; width: 90%; background: #1f2937; border: 1px solid rgba(255,255,255,.1);
          border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .sub { color: #9ca3af; font-size: 13px; margin-bottom: 20px; }
  ol { font-size: 13px; color: #d1d5db; line-height: 1.9; padding-left: 20px; margin: 0 0 24px; }
  button { width: 100%; padding: 12px; font-size: 15px; font-weight: 600; color: white; cursor: pointer;
           background: #4f46e5; border: none; border-radius: 10px; transition: background .15s; }
  button:hover { background: #6366f1; }
  pre { background: #111827; border: 1px solid rgba(255,255,255,.08); border-radius: 8px;
        padding: 12px; font-size: 11px; color: #9ca3af; overflow-x: auto; margin: 20px 0 0; }
</style>
</head>
<body>
  <div class="card">
    <h1>🖌 Kaypaint Droplet — ${name}</h1>
    <p class="sub">A portable automation that replays a recorded action inside Kaypaint.</p>
    <ol>
      <li>Open the Kaypaint editor in your browser.</li>
      <li>Open a document / select the layer you want to process.</li>
      <li>Click the button below — the action steps run on the active document.</li>
    </ol>
    <button id="run">▶ Run in kaypaint</button>
    <pre id="steps"></pre>
  </div>
  <script>
    var DROPLET_URL = ${JSON.stringify(stepsUrl)};
    var STEPS = ${stepsJson};
    document.getElementById('steps').textContent =
      'Steps:\\n' + STEPS.map(function (s) { return ' - ' + s.label; }).join('\\n');
    document.getElementById('run').addEventListener('click', function () {
      var url = window.location.origin + '/editor?droplet=' + DROPLET_URL;
      window.open(url, '_blank');
    });
  </script>
</body>
</html>`;
}

export async function createDropletDialog(): Promise<void> {
  const actions = [...BUILTIN_ACTIONS, ...Object.values(useFeaturesStore.getState().actions)];
  if (!actions.length) {
    window.alert("No actions available. Record one first.");
    return;
  }
  const res = await showOptions({
    title: "Create Droplet",
    text: "Generate a portable HTML droplet that replays the chosen action when opened with Kaypaint.",
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: actions[0].id,
        options: actions.map((a) => ({ value: a.id, label: a.name })),
      },
    ],
    okLabel: "Create",
  });
  if (!res) return;
  const action = actions.find((a) => a.id === res.action) ?? actions[0];

  const stepsUrl = encodeBase64Url({ name: action.name, steps: action.steps });
  const stepsJson = JSON.stringify(action.steps).replace(/</g, "\\u003c");
  const html = dropletHtml(action.name, stepsUrl, stepsJson);
  downloadBlob(new Blob([html], { type: "text/html" }), `droplet-${action.name.replace(/[^\w-]+/g, "-")}.html`);
}

export async function runDropletFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  const droplet = new URLSearchParams(window.location.search).get("droplet");
  if (!droplet) return;
  try {
    const data = decodeBase64Url(droplet) as {
      name?: string;
      steps?: { cmd: string; label: string; params: Record<string, unknown> }[];
    };
    const canvas = canvasNow();
    if (!canvas) {
      window.alert("Droplet requires an open document.");
      return;
    }
    for (const step of data.steps ?? []) {
      await runActionCommand(canvas, step.cmd, step.params ?? {});
    }
    window.alert("Droplet executed.");
  } catch {
    window.alert("Droplet could not be loaded (corrupt or unsupported).");
  }
}
