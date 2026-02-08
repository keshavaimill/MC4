'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import ExecutiveOverview from '@/components/screens/ExecutiveOverview';
import DemandForecast from '@/components/screens/DemandForecast';
import RecipePlanning from '@/components/screens/RecipePlanning';
import MillCapacity from '@/components/screens/MillCapacity';
import RawMaterials from '@/components/screens/RawMaterials';
import Scenarios from '@/components/screens/Scenarios';
import Alerts from '@/components/screens/Alerts';
import Reports from '@/components/screens/Reports';

export default function Home() {
  const [activeScreen, setActiveScreen] = useState('executive');
  const [horizon, setHorizon] = useState<'week' | 'month' | 'year'>('month');
  const [scenario, setScenario] = useState('base');

  const screens = {
    executive: <ExecutiveOverview horizon={horizon} />,
    demand: <DemandForecast horizon={horizon} />,
    recipe: <RecipePlanning horizon={horizon} />,
    capacity: <MillCapacity horizon={horizon} />,
    rawmaterials: <RawMaterials horizon={horizon} />,
    scenarios: <Scenarios horizon={horizon} />,
    alerts: <Alerts horizon={horizon} />,
    reports: <Reports horizon={horizon} />,
  };

  return (
    <Layout
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      horizon={horizon}
      setHorizon={setHorizon}
      scenario={scenario}
      setScenario={setScenario}
    >
      {screens[activeScreen as keyof typeof screens]}
    </Layout>
  );
}
