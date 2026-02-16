"use client";

import { DeskLayout } from "@/components/layout/DeskLayout";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useDeriveInit } from "@/lib/hooks/useDeriveInit";
import { useActiveInstrumentSubs } from "@/lib/hooks/useActiveInstrumentSubs";

export default function DeskPage() {
  useKeyboardShortcuts();
  useDeriveInit();
  useActiveInstrumentSubs(); // Real-time ticker/orderbook/trades for active instrument

  return <DeskLayout />;
}
