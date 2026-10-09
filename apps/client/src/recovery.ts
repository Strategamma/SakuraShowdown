declare const __APP_VERSION__: string;

type Diagnostic = {
  version: string;
  route: string;
  online: boolean;
  message: string;
  time: string;
};

const errorOverlay = document.getElementById("fatal-error");
const reloadButton = document.getElementById("fatal-error-reload") as HTMLButtonElement | null;
const copyButton = document.getElementById("fatal-error-copy") as HTMLButtonElement | null;
const homeButton = document.getElementById("fatal-error-home") as HTMLButtonElement | null;
const connectionNotice = document.getElementById("connection-notice");
const internetCapability = document.getElementById("internet-capability");
const internetCapabilityCopy = document.getElementById("internet-capability-copy");
let lastDiagnostic: Diagnostic | undefined;
let errorShown = false;

document.querySelectorAll<HTMLElement>("[data-app-version]").forEach((label) => {
  label.textContent = `Version ${__APP_VERSION__}`;
});

function normalizeMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === "string") return reason;
  return "Unexpected application error";
}

function showFatalError(reason: unknown) {
  if (errorShown) return;
  errorShown = true;
  lastDiagnostic = {
    version: __APP_VERSION__,
    route: window.location.pathname,
    online: navigator.onLine,
    message: normalizeMessage(reason).slice(0, 300),
    time: new Date().toISOString()
  };
  errorOverlay?.classList.remove("hidden");
  reloadButton?.focus();
}

function updateConnectionNotice() {
  const online = navigator.onLine;
  connectionNotice?.classList.toggle("hidden", online);
  document.body.dataset.connection = online ? "online" : "offline";
  internetCapability?.classList.toggle("unavailable", !online);
  if (internetCapabilityCopy) {
    internetCapabilityCopy.textContent = online
      ? "Public rooms are available when you are online."
      : "Unavailable now; offline and same-Wi-Fi play still work.";
  }
}

window.addEventListener("error", (event) => showFatalError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showFatalError(event.reason));
window.addEventListener("online", updateConnectionNotice);
window.addEventListener("offline", updateConnectionNotice);
reloadButton?.addEventListener("click", () => window.location.reload());
homeButton?.addEventListener("click", () => {
  errorOverlay?.classList.add("hidden");
  document
    .querySelectorAll<HTMLElement>(".overlay:not(#landing-overlay):not(#fatal-error)")
    .forEach((overlay) => overlay.classList.add("hidden"));
  document.getElementById("landing-overlay")?.classList.remove("hidden");
  window.dispatchEvent(new CustomEvent("sakura:return-home"));
});
copyButton?.addEventListener("click", async () => {
  if (!lastDiagnostic) return;
  const text = JSON.stringify(lastDiagnostic, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy diagnostics";
    }, 1600);
  } catch {
    copyButton.textContent = "Copy unavailable";
  }
});

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape" || errorOverlay?.classList.contains("hidden")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    homeButton?.click();
  },
  true
);

updateConnectionNotice();
