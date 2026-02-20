/** Message types for Hub <-> iframe app communication */
export const BASEMENT_OPEN_REFERENCE_PICKER = "BASEMENT_OPEN_REFERENCE_PICKER";
export const BASEMENT_REFERENCE_SELECTED = "BASEMENT_REFERENCE_SELECTED";
export const BASEMENT_OPEN_DOWNLOAD_ACTION = "BASEMENT_OPEN_DOWNLOAD_ACTION";
export const BASEMENT_DOWNLOAD_DONE = "BASEMENT_DOWNLOAD_DONE";

export type BridgeOpenReferencePicker = {
  type: typeof BASEMENT_OPEN_REFERENCE_PICKER;
  requestId: string;
};

export type BridgeReferenceSelected = {
  type: typeof BASEMENT_REFERENCE_SELECTED;
  requestId: string;
  dataUrl: string;
};

export type BridgeOpenDownloadAction = {
  type: typeof BASEMENT_OPEN_DOWNLOAD_ACTION;
  requestId: string;
  imageDataUrl: string;
  appId: string;
};

export type BridgeDownloadDone = {
  type: typeof BASEMENT_DOWNLOAD_DONE;
  requestId: string;
};
