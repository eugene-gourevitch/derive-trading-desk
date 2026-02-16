"use client";

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { StatusBar } from "./StatusBar";
import { AccountBar } from "./AccountBar";
import { PanelTabs } from "./PanelTabs";
import { useUiStore } from "@/lib/stores/uiStore";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Real components
import { OptionsChain } from "@/components/trading/OptionsChain";
import { OrderEntry } from "@/components/trading/OrderEntry";
import { OrderBookViz } from "@/components/market-data/OrderBookViz";
import { TradesFeed } from "@/components/market-data/TradesFeed";
import { CandlestickChart } from "@/components/market-data/CandlestickChart";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { OpenOrdersTable } from "@/components/orders/OpenOrdersTable";
import { GreeksDashboard } from "@/components/risk/GreeksDashboard";
import { IvSurface } from "@/components/risk/IvSurface";
import { StressTestPanel } from "@/components/risk/StressTestPanel";
import { RfqPanel } from "@/components/trading/RfqPanel";
import { PerpTrading } from "@/components/trading/PerpTrading";
import { OrderHistoryTable } from "@/components/orders/OrderHistoryTable";
import { TradeHistoryTable } from "@/components/orders/TradeHistoryTable";
import { DepositPanel } from "@/components/wallet/DepositPanel";
import { WithdrawPanel } from "@/components/wallet/WithdrawPanel";
import { CollateralManager } from "@/components/wallet/CollateralManager";
import { InstrumentSelector } from "@/components/trading/InstrumentSelector";

export function DeskLayout() {
  const leftTab = useUiStore((s) => s.leftPanelTab);
  const centerTab = useUiStore((s) => s.centerPanelTab);
  const rightTab = useUiStore((s) => s.rightPanelTab);
  const bottomTab = useUiStore((s) => s.bottomPanelTab);
  const setLeftTab = useUiStore((s) => s.setLeftPanelTab);
  const setCenterTab = useUiStore((s) => s.setCenterPanelTab);
  const setRightTab = useUiStore((s) => s.setRightPanelTab);
  const setBottomTab = useUiStore((s) => s.setBottomPanelTab);

  return (
    <div className="flex h-screen flex-col">
      <StatusBar />

      {/* Main Content */}
      <PanelGroup direction="vertical" className="flex-1">
        {/* Top Row: Left | Center | Right */}
        <Panel defaultSize={70} minSize={40}>
          <PanelGroup direction="horizontal">
            {/* Left Panel */}
            <Panel defaultSize={25} minSize={15}>
              <PanelTabs
                activeTab={leftTab}
                onTabChange={setLeftTab}
                tabs={[
                  {
                    label: "Options Chain",
                    component: (
                      <ErrorBoundary panelName="Options Chain">
                        <OptionsChain />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Perps",
                    component: (
                      <ErrorBoundary panelName="Perps">
                        <PerpTrading />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "RFQ",
                    component: (
                      <ErrorBoundary panelName="RFQ">
                        <RfqPanel />
                      </ErrorBoundary>
                    ),
                  },
                ]}
              />
            </Panel>

            <PanelResizeHandle />

            {/* Center Panel */}
            <Panel defaultSize={50} minSize={30}>
              <PanelTabs
                activeTab={centerTab}
                onTabChange={setCenterTab}
                tabs={[
                  {
                    label: "Chart",
                    component: (
                      <ErrorBoundary panelName="Chart">
                        <CandlestickChart />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "IV Surface",
                    component: (
                      <ErrorBoundary panelName="IV Surface">
                        <IvSurface />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Stress Test",
                    component: (
                      <ErrorBoundary panelName="Stress Test">
                        <StressTestPanel />
                      </ErrorBoundary>
                    ),
                  },
                ]}
              />
            </Panel>

            <PanelResizeHandle />

            {/* Right Panel */}
            <Panel defaultSize={25} minSize={15}>
              <PanelTabs
                activeTab={rightTab}
                onTabChange={setRightTab}
                tabs={[
                  {
                    label: "Order",
                    component: (
                      <ErrorBoundary panelName="Order Entry">
                        <OrderEntry />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Book",
                    component: (
                      <ErrorBoundary panelName="Order Book">
                        <OrderBookViz />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Trades",
                    component: (
                      <ErrorBoundary panelName="Trades">
                        <TradesFeed />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Deposit",
                    component: (
                      <ErrorBoundary panelName="Deposit">
                        <DepositPanel />
                      </ErrorBoundary>
                    ),
                  },
                  {
                    label: "Withdraw",
                    component: (
                      <ErrorBoundary panelName="Withdraw">
                        <WithdrawPanel />
                      </ErrorBoundary>
                    ),
                  },
                ]}
              />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle />

        {/* Bottom Panel */}
        <Panel defaultSize={30} minSize={15}>
          <PanelTabs
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            tabs={[
              {
                label: "Positions",
                component: (
                  <ErrorBoundary panelName="Positions">
                    <PositionsTable />
                  </ErrorBoundary>
                ),
              },
              {
                label: "Open Orders",
                component: (
                  <ErrorBoundary panelName="Open Orders">
                    <OpenOrdersTable />
                  </ErrorBoundary>
                ),
              },
              {
                label: "Order History",
                component: (
                  <ErrorBoundary panelName="Order History">
                    <OrderHistoryTable />
                  </ErrorBoundary>
                ),
              },
              {
                label: "Trade History",
                component: (
                  <ErrorBoundary panelName="Trade History">
                    <TradeHistoryTable />
                  </ErrorBoundary>
                ),
              },
              {
                label: "Risk",
                component: (
                  <ErrorBoundary panelName="Risk Dashboard">
                    <GreeksDashboard />
                  </ErrorBoundary>
                ),
              },
              {
                label: "Collateral",
                component: (
                  <ErrorBoundary panelName="Collateral">
                    <CollateralManager />
                  </ErrorBoundary>
                ),
              },
            ]}
          />
        </Panel>
      </PanelGroup>

      <AccountBar />

      {/* Global overlays */}
      <InstrumentSelector />
    </div>
  );
}
