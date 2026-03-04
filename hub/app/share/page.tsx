import { Suspense } from "react";
import { ShareClient } from "./ShareClient";

export default function SharePage() {
  return (
    <Suspense>
      <ShareClient />
    </Suspense>
  );
}
