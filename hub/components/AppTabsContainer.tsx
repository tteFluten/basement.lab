"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useAppTabs } from "@/lib/appTabsContext";
import { ReferencePickerModal } from "@/components/ReferencePickerModal";
import { DownloadActionModal } from "@/components/DownloadActionModal";
import {
  BASEMENT_OPEN_REFERENCE_PICKER,
  BASEMENT_REFERENCE_SELECTED,
  BASEMENT_OPEN_DOWNLOAD_ACTION,
  BASEMENT_DOWNLOAD_DONE,
} from "@/lib/bridgeTypes";

export function AppTabsContainer() {
  const { openTabs, activeSlug } = useAppTabs();

  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadPayload, setDownloadPayload] = useState<{
    assetDataUrl: string;
    appId: string;
    mimeType?: string;
    fileName?: string;
    prompt?: string;
  } | null>(null);

  const pendingRef = useRef<{
    source: MessageEventSource | null;
    requestId: string;
  }>({ source: null, requestId: "" });

  const sendToApp = useCallback(
    (source: MessageEventSource | null, payload: object) => {
      if (source && "postMessage" in source) {
        (source as Window).postMessage(payload, "*");
      }
    },
    []
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object" || !data.type) return;

      switch (data.type) {
        case BASEMENT_OPEN_REFERENCE_PICKER: {
          pendingRef.current = {
            source: event.source,
            requestId: data.requestId ?? "",
          };
          setRefPickerOpen(true);
          break;
        }
        case BASEMENT_OPEN_DOWNLOAD_ACTION: {
          pendingRef.current = {
            source: event.source,
            requestId: data.requestId ?? "",
          };
          setDownloadPayload({
            assetDataUrl: data.assetDataUrl ?? data.imageDataUrl ?? "",
            appId: data.appId ?? "app",
            mimeType: data.mimeType,
            fileName: data.fileName,
            prompt: data.prompt,
          });
          setDownloadOpen(true);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleRefSelect = useCallback(
    (dataUrl: string) => {
      const { source, requestId } = pendingRef.current;
      sendToApp(source, {
        type: BASEMENT_REFERENCE_SELECTED,
        requestId,
        dataUrl,
      });
      pendingRef.current = { source: null, requestId: "" };
      setRefPickerOpen(false);
    },
    [sendToApp]
  );

  const handleDownloadDone = useCallback(() => {
    const { source, requestId } = pendingRef.current;
    sendToApp(source, { type: BASEMENT_DOWNLOAD_DONE, requestId });
    pendingRef.current = { source: null, requestId: "" };
    setDownloadPayload(null);
    setDownloadOpen(false);
  }, [sendToApp]);

  if (openTabs.length === 0) return null;

  return (
    <>
      <div
        className={`absolute inset-0 z-10 flex flex-col ${
          activeSlug ? "" : "pointer-events-none invisible"
        }`}
      >
        {openTabs.map((tab) => {
          const isActive = activeSlug === tab.slug;
          return (
            <div
              key={tab.slug}
              className={`absolute inset-0 flex flex-col ${
                isActive ? "z-10" : "z-0 pointer-events-none invisible"
              }`}
            >
              <iframe
                title={tab.label}
                src={tab.url}
                className="w-full flex-1 min-h-0 border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          );
        })}
      </div>

      <ReferencePickerModal
        open={refPickerOpen}
        onClose={() => {
          setRefPickerOpen(false);
          pendingRef.current = { source: null, requestId: "" };
        }}
        onSelect={handleRefSelect}
      />

      <DownloadActionModal
        open={downloadOpen}
        onClose={() => {
          setDownloadOpen(false);
          setDownloadPayload(null);
          pendingRef.current = { source: null, requestId: "" };
        }}
        assetDataUrl={downloadPayload?.assetDataUrl ?? null}
        appId={downloadPayload?.appId ?? ""}
        mimeType={downloadPayload?.mimeType}
        fileName={downloadPayload?.fileName}
        prompt={downloadPayload?.prompt}
        onDone={handleDownloadDone}
      />
    </>
  );
}
