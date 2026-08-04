import { Keyboard, QrCode, ScanBarcode } from "lucide-react";
import type { CheckinMethod } from "@/lib/types";

/** Display metadata for how a check-in happened — shared by every list. */
export const METHOD_META: Record<
  CheckinMethod,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  qr: { label: "QR pass", Icon: QrCode },
  id_scan: { label: "ID card", Icon: ScanBarcode },
  manual: { label: "Manual", Icon: Keyboard },
};
