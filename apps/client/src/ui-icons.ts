const dynamicIcons: [string, string][] = [
  [".nearby-challenge", "arrow"],
  ["#nearby-invite button", "check"],
  ["#lan-lobby-list button", "arrow"],
  ["#lobby-list button:not(.lobby-icon)", "arrow"]
];

const dialogIcons: [string, string][] = [
  ["customize-overlay", "cards"],
  ["victory-overlay", "trophy"],
  ["start-overlay", "shuffle"],
  ["draft-overlay", "cards"],
  ["settings-overlay", "tune"],
  ["install-overlay", "download"],
  ["tutorial-overlay", "book"],
  ["spectator-overlay", "eye"],
  ["lobby-overlay", "people"]
];

function decorateDialogHeaders() {
  for (const [id, icon] of dialogIcons) {
    const header = document.querySelector<HTMLElement>(`#${id} .overlay-header`);
    const copy = header?.querySelector<HTMLElement>(":scope > div:first-child");
    if (!header || !copy) continue;
    const emblem = document.createElement("span");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    emblem.className = "dialog-emblem";
    emblem.setAttribute("aria-hidden", "true");
    svg.classList.add("ui-icon");
    use.setAttribute("href", `#ui-${icon}`);
    svg.append(use);
    emblem.append(svg);
    copy.prepend(emblem);
    header.classList.add("dialog-header");
  }
}

function decorateButton(button: HTMLButtonElement) {
  if (button.querySelector(":scope > .ui-icon")) return;
  const icon = button.dataset.uiIcon || dynamicIcons.find(([selector]) => button.matches(selector))?.[1];
  if (!icon) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.classList.add("ui-icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#ui-${icon}`);
  svg.append(use);
  if (button.classList.contains("close-button") || button.hasAttribute("data-ui-icon-only")) button.textContent = "";
  button.prepend(svg);
  button.classList.add("has-ui-icon");
}

export function initializeUiIcons() {
  decorateDialogHeaders();
  document.querySelectorAll<HTMLButtonElement>("button").forEach(decorateButton);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.parentElement instanceof HTMLButtonElement) decorateButton(node.parentElement);
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLButtonElement) decorateButton(node);
        node.querySelectorAll<HTMLButtonElement>("button").forEach(decorateButton);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
