import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import Chart from "chart.js/auto";

async function getExplanation(lat: number, lng: number) {
  const res = await fetch("http://localhost:3000/map/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });

  if (!res.ok) throw new Error("Erreur getExplanation");
  return res.json();
}

interface Explanation {
  input: {
    latitude: number;
    longitude: number;
  };
  expected_value: number | number[];
  shap_values: number[][];
  feature_names: string[];
}

export default function ExplainPage() {
  const [searchParams] = useSearchParams();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  useEffect(() => {
    if (lat && lng) {
      getExplanation(Number(lat), Number(lng))
        .then(setExplanation)
        .catch((err) => {
          console.error(err);
          setError("Failed to fetch explanation.");
        });
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!chartRef.current || !explanation) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const shapValues = explanation.shap_values[0][1]; 
    const expectedValue = Array.isArray(explanation.expected_value)
      ? explanation.expected_value[1] // class 1
      : explanation.expected_value;
    const featureNames = explanation.feature_names || ['longitude', 'latitude'];
    
    // Detect dark mode for chart text/grid colors
    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? 'white' : '#334155'; // Use pure white for dark mode
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(51, 65, 85, 0.2)';

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: featureNames,
        datasets: [
          {
            label: "SHAP Value",
            data: shapValues,
            backgroundColor: shapValues.map(v => v > 0 ? 'rgba(255, 99, 132, 0.5)' : 'rgba(54, 162, 235, 0.5)'),
            borderColor: shapValues.map(v => v > 0 ? 'rgb(255, 99, 132)' : 'rgb(54, 162, 235)'),
            borderWidth: 1
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: `SHAP Explanation for prediction at lat: ${explanation.input.latitude.toFixed(4)}, lng: ${explanation.input.longitude.toFixed(4)}`,
                color: textColor,
                font: { size: 16 }
            },
            subtitle: {
                display: true,
                text: `Base value (expected prediction for class 1): ${expectedValue.toFixed(4)}`,
                color: textColor,
                font: { size: 14 }
            },
            legend: {
              labels: { color: textColor }
            }
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      },
    });
  }, [explanation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-slate-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 flex items-center justify-center p-4">
        <div className="rounded-lg shadow-lg bg-white/30 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/20 text-center p-8">
          <p className="text-red-700 dark:text-red-300 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!lat || !lng) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-slate-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 flex items-center justify-center p-4">
        <p>Latitude and Longitude are required.</p>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-slate-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 flex items-center justify-center p-4">
        <p>Loading explanation...</p>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-slate-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800 dark:text-gray-200">SHAP Value Explanation</h1>
        
        <div className="rounded-lg shadow-lg bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/20 p-4 md:p-6">
          <canvas ref={chartRef}></canvas>
        </div>

        <div className="mt-8 rounded-lg shadow-lg bg-white/30 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/20 p-4 md:p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Raw Explanation Data</h3>
          <pre className="text-left text-xs bg-gray-800/70 text-white p-4 rounded-md overflow-x-auto">{JSON.stringify(explanation, null, 2)}</pre>
        </div>

        <div className="text-center mt-12">
           <Link 
              to="/map" 
              className="bg-white/30 dark:bg-white/10 text-gray-900 dark:text-white font-bold py-3 px-6 rounded-full shadow-lg border border-white/40 dark:border-white/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-white/20 transition-all duration-300 ease-in-out"
            >
              Retour à la carte
            </Link>
        </div>
      </div>
    </section>
  );
}
