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

    // Based on the user's provided JSON data
    const shapValues = explanation.shap_values[0][1]; 
    const expectedValue = Array.isArray(explanation.expected_value)
      ? explanation.expected_value[1] // class 1
      : explanation.expected_value;
    const featureNames = explanation.feature_names || ['longitude', 'latitude'];


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
                text: `SHAP Explanation for prediction at lat: ${explanation.input.latitude.toFixed(4)}, lng: ${explanation.input.longitude.toFixed(4)}`
            },
            subtitle: {
                display: true,
                text: `Base value (expected prediction for class 1): ${expectedValue.toFixed(4)}`
            }
        }
      },
    });
  }, [explanation]);

  if (error) {
    return <div className="notification is-danger">{error}</div>;
  }

  if (!lat || !lng) {
    return <div>Latitude and Longitude are required.</div>;
  }

  if (!explanation) {
    return <div>Loading explanation...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="title is-3 mb-4 text-center">SHAP Value Explanation</h1>
      <div className="chart-container mt-6">
        <canvas ref={chartRef}></canvas>
      </div>
      <div className="mt-6">
        <h3 className="subtitle is-5">Raw Explanation Data</h3>
        <pre>{JSON.stringify(explanation, null, 2)}</pre>
      </div>
    </div>
  );
}
