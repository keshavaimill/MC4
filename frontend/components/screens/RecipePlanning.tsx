'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });

interface RecipePlanningProps {
  horizon: 'week' | 'month' | 'year';
}

export default function RecipePlanning({ horizon }: RecipePlanningProps) {
  const [recipeData, setRecipeData] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recipeRes, eligibilityRes] = await Promise.all([
        axios.get(`/api/planning/recipe?horizon=${horizon}`),
        axios.get('/api/planning/recipe-eligibility'),
      ]);
      setRecipeData(recipeRes.data.data || []);
      setEligibility(eligibilityRes.data.data || []);
    } catch (error) {
      console.error('Error fetching recipe data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  // Build eligibility matrix
  const flourTypes = [...new Set(eligibility.map((e) => e.flour_type))];
  const recipes = [...new Set(eligibility.map((e) => e.recipe_name))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recipe Planning</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recipe time allocation and eligibility matrix
        </p>
      </div>

      {/* Recipe Eligibility Matrix */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recipe Eligibility Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flour Type</th>
                {recipes.map((recipe) => (
                  <th key={recipe} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    {recipe}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {flourTypes.map((flour) => (
                <tr key={flour}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{flour}</td>
                  {recipes.map((recipe) => {
                    const eligible = eligibility.find(
                      (e) => e.flour_type === flour && e.recipe_name === recipe
                    );
                    return (
                      <td key={recipe} className="px-4 py-3 text-center">
                        {eligible ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipe Time Requirements */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recipe Time Requirements</h2>
        {recipeData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p className="text-sm">No recipe data available</p>
          </div>
        ) : (
          <div className="w-full" style={{ height: '400px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={recipeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recipe_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="required_hours" fill="#0ea5e9" name="Required Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recipe Mix Selector */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recipe Mix for Superior Flour</h2>
        <div className="space-y-4">
          {eligibility
            .filter((e) => e.flour_type === 'Superior')
            .map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.recipe_name}</span>
                  <span className="text-sm text-gray-600">
                    {(item.allocation_pct * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-mc4-blue h-2 rounded-full"
                    style={{ width: `${item.allocation_pct * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
