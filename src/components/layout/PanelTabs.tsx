"use client";

import { cn } from "@/lib/utils/cn";
import { type ReactNode, useState } from "react";

interface Tab {
  label: string;
  icon?: ReactNode;
  component: ReactNode;
}

interface PanelTabsProps {
  tabs: Tab[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
}

export function PanelTabs({ tabs, activeTab, onTabChange }: PanelTabsProps) {
  const [internalTab, setInternalTab] = useState(0);
  const currentTab = activeTab ?? internalTab;

  const handleTabChange = (index: number) => {
    setInternalTab(index);
    onTabChange?.(index);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex shrink-0 items-center gap-0 border-b border-border-default bg-bg-secondary">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => handleTabChange(i)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
              currentTab === i
                ? "border-b-2 border-accent bg-bg-tertiary text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {tabs[currentTab]?.component}
      </div>
    </div>
  );
}
