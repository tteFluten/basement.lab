/**
 * Bridge to Hub: reference picker (upload or history) and download actions.
 */
const PREFIX = "BASEMENT_";
const REQUEST_OPEN_REFERENCE = PREFIX + "OPEN_REFERENCE_PICKER";
const RESPONSE_REFERENCE_SELECTED = PREFIX + "REFERENCE_SELECTED";
const REQUEST_OPEN_DOWNLOAD = PREFIX + "OPEN_DOWNLOAD_ACTION";
const RESPONSE_DOWNLOAD_DONE = PREFIX + "DOWNLOAD_DONE";

function nextId() {
  return "r-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export function isHubEnv(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return false;
  }
}

export function openReferencePicker(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (window.self === window.top) {
      reject(new Error("Not inside Hub iframe"));
      return;
    }
    const requestId = nextId();
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === RESPONSE_REFERENCE_SELECTED && d.requestId === requestId) {
        window.removeEventListener("message", handler);
        resolve(d.dataUrl ?? "");
      }
    };
    window.addEventListener("message", handler);
    window.parent.postMessage(
      { type: REQUEST_OPEN_REFERENCE, requestId },
      "*"
    );
    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Reference picker timeout"));
    }, 120000);
  });
}

export function openDownloadAction(
  imageDataUrl: string,
  appId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.self === window.top) {
      reject(new Error("Not inside Hub iframe"));
      return;
    }
    const requestId = nextId();
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === RESPONSE_DOWNLOAD_DONE && d.requestId === requestId) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.parent.postMessage(
      { type: REQUEST_OPEN_DOWNLOAD, requestId, imageDataUrl, appId },
      "*"
    );
    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Download action timeout"));
    }, 60000);
  });
}
