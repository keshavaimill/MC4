'use client';

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import ExecutiveOverview from '@/components/screens/ExecutiveOverview';
import DemandForecast from '@/components/screens/DemandForecast';
import RecipePlanning from '@/components/screens/RecipePlanning';
import MillCapacity from '@/components/screens/MillCapacity';
import RawMaterials from '@/components/screens/RawMaterials';
import Scenarios from '@/components/screens/Scenarios';
import Alerts from '@/components/screens/Alerts';
import Reports from '@/components/screens/Reports';

function getDefaultFromTo() {
  // Dataset (mill_recipe_schedule etc.) is for 2020; use that so Recipe Time vs Capacity chart has data by default
  const from = new Date(2020, 0, 1);
  const to = new Date(2020, 0, 31);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function Home() {
  const { from: defaultFrom, to: defaultTo } = useMemo(() => getDefaultFromTo(), []);
  const [activeScreen, setActiveScreen] = useState('executive');
  const [scenario, setScenario] = useState('base');
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const horizon = 'month';

  const screens = {
    executive: <ExecutiveOverview horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    demand: <DemandForecast horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    recipe: <RecipePlanning horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    capacity: <MillCapacity horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    rawmaterials: <RawMaterials horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    scenarios: <Scenarios horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    alerts: <Alerts horizon={horizon} fromDate={fromDate} toDate={toDate} />,
    reports: <Reports horizon={horizon} fromDate={fromDate} toDate={toDate} />,
  };

  return (
    <Layout
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      scenario={scenario}
      setScenario={setScenario}
      fromDate={fromDate}
      setFromDate={setFromDate}
      toDate={toDate}
      setToDate={setToDate}
    >
      {screens[activeScreen as keyof typeof screens]}
    </Layout>
  );
}
