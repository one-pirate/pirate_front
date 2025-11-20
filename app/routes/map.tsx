import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Chart from "chart.js/auto";

// === BACKEND CALLS (compatibles avec ton nouveau backend Express) ===

async function sendCoords(points: { lat: number; lng: number }[], spacing: number) {
  const res = await fetch("http://localhost:3000/map/send-coords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, spacing }),
  });

  if (!res.ok) throw new Error("Erreur sendCoords");
  return res.json();
}

async function predictRisk(coords: { lat: number; lng: number }[]) {
  const res = await fetch("http://localhost:3000/map/predict-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coords }),
  });

  if (!res.ok) throw new Error("Erreur predictRisk");
  return res.json();
}

interface Prediction {
  lat: number;
  lng: number;
  probability_success: number | null;
  prediction: number | null;
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const lineRef = useRef<maplibregl.GeoJSONSource | null>(null);
  const pointsRef = useRef<maplibregl.GeoJSONSource | null>(null); // New ref for points
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [fullPath, setFullPath] = useState<{ lat: number; lng: number }[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [spacing, setSpacing] = useState(500); // New state for spacing
  const [isLoading, setIsLoading] = useState(false); // New state for loading

  // === INIT MAP ===
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/019a3adf-ed0a-74b4-b1f1-b55ffeefcdd4/style.json?key=Vx085W00NFIfkyFGT02u",
      center: [0, 0],
      zoom: 2,
    });

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-width": 4,
          "line-color": [
            "case",
            ["has", "risk"],
            [
              "interpolate",
              ["linear"],
              ["get", "risk"],
              0,
              "#00ff00", // green
              0.5,
              "#ffff00", // yellow
              1,
              "#ff0000", // red
            ],
            "#fff000", // default yellow
          ],
        },
      });

      lineRef.current = map.getSource("route") as maplibregl.GeoJSONSource;
      
      // Add source and layer for points
      map.addSource("points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "points-layer",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": 6,
          "circle-color": "#B42222",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff"
        },
      });

      pointsRef.current = map.getSource("points") as maplibregl.GeoJSONSource;
    });

    // Add point on click
    const clickHandler = (e: maplibregl.MapMouseEvent) => {
      const newPt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPoints((currentPoints) => [...currentPoints, newPt]);
      setPredictions([]); // Clear predictions
      setStatusMessage(""); // Clear status message
    };

    map.on("click", clickHandler);

    return () => {
      map.off("click", clickHandler);
      map.remove();
    };
  }, []);

  // === GET FULL PATH ===
  useEffect(() => {
    if (points.length === 0) {
      setFullPath([]);
      return;
    }

    const getFullPath = async () => {
      const res = await sendCoords(points, spacing);
      setFullPath(res.all_points);
    };

    getFullPath();
  }, [points, spacing]); // Add spacing to dependency array

  // === DRAW LINE ===
  useEffect(() => {
    if (!lineRef.current) return;

    let features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    if (predictions.length > 1) {
      // Create segments with risk property
      for (let i = 0; i < predictions.length - 1; i++) {
        const startPoint = predictions[i];
        const endPoint = predictions[i + 1];
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [startPoint.lng, startPoint.lat],
              [endPoint.lng, endPoint.lat],
            ],
          },
          properties: {
            risk: startPoint.probability_success ?? 0,
          },
        });
      }
    } else {
      // Create a single line with no risk property
      if (fullPath.length > 1) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: fullPath.map((p) => [p.lng, p.lat]),
          },
          properties: {}, // No risk property
        });
      }
    }

    lineRef.current.setData({
      type: "FeatureCollection",
      features: features,
    });
  }, [fullPath, predictions]);
  
  // === DRAW POINTS ===
  useEffect(() => {
    if (!pointsRef.current) return;

    const features = points.map(p => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.lng, p.lat],
      },
      properties: {},
    }));

    pointsRef.current.setData({
      type: "FeatureCollection",
      features: features,
    });
  }, [points]);


  // === RESET ===
  const resetPoints = () => {
    setPoints([]);
    setFullPath([]);
    setPredictions([]);
    setStatusMessage("");
  };

  // === REMOVE LAST POINT ===
  const deleteLastPoint = () => {
    setPoints((currentPoints) => currentPoints.slice(0, -1));
  };

  // === VALIDATE PATH → PREDICT RISK ===
  const validatePath = async () => {
    if (fullPath.length === 0 || isLoading) return;

    setIsLoading(true);
    setStatusMessage("Validation en cours...");
    try {
      const res = await predictRisk(fullPath);
      setPredictions(res.predictions);

      if (res.global_risk > 0.5) {
        setStatusMessage(
          "⚠️ Attention : chemin risqué, probabilité élevée d'attaque !"
        );
      } else {
        setStatusMessage("✔️ Chemin sûr selon le modèle.");
      }
    } catch (error) {
      console.error("predictRisk error:", error);
      setStatusMessage("❌ Erreur lors de la prédiction du risque.");
    } finally {
      setIsLoading(false);
    }
  };

  // === CHART UPDATE ===
  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: predictions.map((_, i) => `Point ${i + 1}`),
        datasets: [
          {
            label: "Probabilité de risque (%)",
            data: predictions.map((p) =>
              p.probability_success ? p.probability_success * 100 : 0
            ),
            backgroundColor: "#00aaff",
          },
          {
            label: "Prédiction (0=sûr, 1=risqué)",
            data: predictions.map((p) => (p.prediction ?? 0) * 100),
            backgroundColor: "#ff4d4f",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
        },
      },
    });
  }, [predictions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100/50 to-indigo-200 dark:from-neutral-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 p-4">
      <div className="container mx-auto max-w-7xl">
        <h1 className="text-4xl font-extrabold text-center mb-8 rounded-lg p-6 shadow-lg border border-black/20 dark:border-white/20 bg-black/10 dark:bg-white/10 text-gray-800 dark:text-gray-200">
          OnePirate
        </h1>

        {/* MAP */}
        <div
          ref={mapContainer}
          className="rounded-lg shadow-md"
          style={{ height: "60vh", border: "2px solid #333" }}
        />

        {/* SPACING SLIDER */}
        <div className="space-y-4 mt-6 p-4 rounded-lg shadow-lg bg-white/30 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/20 text-gray-900 dark:text-white">
          <label className="block text-lg font-semibold">
            Spacing: {spacing}
          </label>
          <div className="relative">
            <input
              type="range"
              min="10"
              max="1000"
              step="1"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="w-full h-2 appearance-none rounded-lg bg-blue-200/50 dark:bg-blue-900/50 cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md
                         [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow-md"
            />
          </div>
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 pt-1">
            <span>10</span>
            <span>1000</span>
          </div>
        </div>

        <div className="flex gap-4 justify-center my-8">
          <button
            className="bg-white/30 dark:bg-white/10 text-red-700 dark:text-red-300 font-bold py-3 px-6 rounded-full shadow-lg cursor-pointer active:shadow-black/30 border border-white/40 dark:border-white/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-white/20 transition-all duration-300 ease-in-out"
            onClick={resetPoints}
          >
            Reset
          </button>

          <button
            className="bg-white/30 dark:bg-white/10 text-yellow-700 dark:text-yellow-300 font-bold py-3 px-6 rounded-full shadow-lg cursor-pointer active:shadow-black/30 border border-white/40 dark:border-white/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-white/20 transition-all duration-300 ease-in-out"
            onClick={deleteLastPoint}
          >
            Supprimer dernier point
          </button>

          <button
            className="bg-white/30 dark:bg-white/10 text-green-700 dark:text-green-300 font-bold py-3 px-6 rounded-full shadow-lg cursor-pointer active:shadow-black/30 border border-white/40 dark:border-white/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-white/20 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            onClick={validatePath}
            disabled={isLoading}
          >
            {isLoading && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLoading ? "Validation en cours..." : "Valider le chemin"}
          </button>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-lg shadow-lg bg-white/30 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/20 text-center text-lg text-blue-700 dark:text-blue-300">
            {statusMessage}
          </div>
        )}

        <div className="table-container mt-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Détails des prédictions</h3>

          <table className="min-w-full table-auto border-collapse rounded-lg overflow-hidden shadow-lg bg-white/30 dark:bg-white/10 backdrop-blur-md">
            <thead className="bg-sky-700/50 dark:bg-sky-900/50 text-white dark:text-gray-200">
              <tr>
                <th className="py-3 px-4 text-center font-semibold">#</th>
                <th className="py-3 px-4 text-center font-semibold">Lat</th>
                <th className="py-3 px-4 text-center font-semibold">Lng</th>
                <th className="py-3 px-4 text-center font-semibold">Probabilité</th>
                <th className="py-3 px-4 text-center font-semibold">Prédiction</th>
                <th className="py-3 px-4 text-center font-semibold">Explain</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {predictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-700 dark:text-gray-300">
                    Aucune donnée
                  </td>
                </tr>
              ) : (
                predictions.map((p, i) => (
                  <tr key={i} className="hover:bg-white/20 dark:hover:bg-white/10 transition duration-150 ease-in-out even:bg-white/10 dark:even:bg-white/5">
                    <td className="py-3 px-4 text-center">{i + 1}</td>
                    <td className="py-3 px-4 text-center tabular-nums">{p.lat.toFixed(4)}</td>
                    <td className="py-3 px-4 text-center tabular-nums">{p.lng.toFixed(4)}</td>
                    <td className="py-3 px-4 text-center tabular-nums font-medium">
                      {p.probability_success !== null
                        ? (p.probability_success * 100).toFixed(2) + "%"
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4">{p.prediction}</td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        to={`/explain?lat=${p.lat}&lng=${p.lng}`}
                        className="inline-flex items-center px-3 py-1 border border-white/30 dark:border-white/20 text-sm font-medium rounded-full shadow-sm bg-blue-600/50 dark:bg-blue-800/50 text-white hover:bg-blue-700/60 dark:hover:bg-blue-700/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Expliquer
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CHART */}
        <div className="chart-container mt-6">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}