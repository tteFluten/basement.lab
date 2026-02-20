"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAppUrl } from "@/lib/appUrls";
import { ReferencePickerModal } from "@/components/ReferencePickerModal";
import { DownloadActionModal } from "@/components/DownloadActionModal";
import {
  BASEMENT_OPEN_REFERENCE_PICKER,
  BASEMENT_REFERENCE_SELECTED,
  BASEMENT_OPEN_DOWNLOAD_ACTION,
  BASEMENT_DOWNLOAD_DONE,
} from "@/lib/bridgeTypes";

const VALID_SLUGS = ["cineprompt", "pov", "chronos", "swag", "avatar", "render", "frame-variator"] as const;

export function AppFrameClient() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadPayload, setDownloadPayload] = useState<{
    imageDataUrl: string;
    appId: string;
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
          pendingRef.current = { source: event.source, requestId: data.requestId ?? "" };
          setRefPickerOpen(true);
          break;
        }
        case BASEMENT_OPEN_DOWNLOAD_ACTION: {
          pendingRef.current = { source: event.source, requestId: data.requestId ?? "" };
          setDownloadPayload({
            imageDataUrl: data.imageDataUrl ?? "",
            appId: data.appId ?? slug ?? "app",
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
  }, [slug]);

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

  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    return (
      <main className="flex-1 flex flex-col min-h-0 p-8">
        <p className="text-fg-muted">Unknown app.</p>
      </main>
    );
  }

  const url = getAppUrl(slug);

  return (
    <>
      <main className="flex-1 flex flex-col min-h-0">
        <iframe
          ref={iframeRef}
          title={slug}
          src={url}
          className="w-full flex-1 min-h-0 border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        <p className="text-fg-muted text-xs px-4 py-2 border-t border-border bg-bg-muted shrink-0">
          App at {url}. To rebuild: <code className="text-fg">npm run build:apps</code>
        </p>
      </main>

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
        imageDataUrl={downloadPayload?.imageDataUrl ?? null}
        appId={downloadPayload?.appId ?? ""}
        onDone={handleDownloadDone}
      />
    </>
  );
}
