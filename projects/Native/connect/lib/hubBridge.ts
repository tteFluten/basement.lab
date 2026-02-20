/**
 * Bridge to Hub: download actions for embedded project apps.
 */
const PREFIX = "BASEMENT_";
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

export function openDownloadAction(
  assetDataUrl: string,
  appId: string,
  options?: { mimeType?: string; fileName?: string }
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
      {
        type: REQUEST_OPEN_DOWNLOAD,
        requestId,
        imageDataUrl: assetDataUrl,
        assetDataUrl,
        appId,
        mimeType: options?.mimeType,
        fileName: options?.fileName,
      },
      "*"
    );
    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Download action timeout"));
    }, 60000);
  });
}
