import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Chart from "chart.js/auto";

// Backend API functions
async function sendCoords(lat: number, lng: number) {
  return fetch("http://localhost:3000/map/send-coords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  }).then((res) => res.json());
}

async function predictRisk(lat: number, lng: number) {
  return fetch("http://localhost:3000/map/predict-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  }).then((res) => res.json());
}

interface Prediction {
  lat: number;
  lng: number;
  probability_success: number;
  prediction: number;
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const lineRef = useRef<maplibregl.GeoJSONSource | null>(null);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/019a3adf-ed0a-74b4-b1f1-b55ffeefcdd4/style.json?key=Vx085W00NFIfkyFGT02u",
      center: [0, 0],
      zoom: 2,
    });

    // Add source/layer for line
    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
          properties: {},
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#fbff00", "line-width": 4 },
      });
      lineRef.current = map.getSource("route") as maplibregl.GeoJSONSource;
    });

    // Handle click
    map.on("click", async (e) => {
      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPoints((prev) => [...prev, newPoint]);

      // Send to backend
      await sendCoords(e.lngLat.lat, e.lngLat.lng);
    });

    return () => map.remove();
  }, []);

  // Update line on map
  useEffect(() => {
    if (!lineRef.current) return;
    lineRef.current.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: points },
      properties: {},
    });
  }, [points]);

  // Reset points
  const resetPoints = () => {
    setPoints([]);
    setPredictions([]);
    setStatusMessage("");
  };

  // Delete last point
  const deleteLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
    setPredictions((prev) => prev.slice(0, -1));
  };

  // Validate path (get predictions)
  const validatePath = async () => {
    const preds: Prediction[] = [];
    for (const [lng, lat] of points) {
      try {
        const res = await predictRisk(lat, lng);
        preds.push({
          lat,
          lng,
          probability_success: res.model_output.probability_success,
          prediction: res.model_output.prediction,
        });
      } catch (err) {
        console.error("Prediction failed:", err);
      }
    }
    setPredictions(preds);

    // Calculate mean probability
    const meanProb =
      preds.reduce((acc, p) => acc + (p.probability_success ?? 0), 0) /
      (preds.length || 1);

    setStatusMessage(
      meanProb > 0.5
        ? "Attention : chemin risqué, probabilité élevée d'attaque !"
        : "Chemin sûr selon le modèle."
    );
  };

  // Update Chart.js
  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: predictions.map((_, i) => `Point ${i + 1}`),
        datasets: [
          {
            label: "Probabilité de succès",
            data: predictions.map((p) =>
              p.probability_success ? p.probability_success * 100 : 0
            ),
            backgroundColor: "#00aaff",
          },
          {
            label: "Prédiction (0 = sûr, 1 = risqué)",
            data: predictions.map((p) => p.prediction * 100),
            backgroundColor: "#ff4d4f",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => `${v}%` },
          },
        },
      },
    });
  }, [predictions]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="title is-3 mb-4">Navigation Pirate Risk</h1>

      {/* Map */}
      <div
        ref={mapContainer}
        className="map-container"
        style={{ width: "100%", height: "60vh", border: "1px solid #ccc" }}
      />

      {/* Buttons */}
      {/* <div className="btn-container">
        <button className="button button-danger" onClick={resetPoints}>
          Reset
        </button>
        <button className="button button-warning" onClick={deleteLastPoint}>
          Supprimer dernier point
        </button>
        <button className="button button-primary" onClick={validatePath}>
          Valider le chemin
        </button>
      </div> */}

      {/* Buttons */}
      <div className="flex gap-4 justify-center mt-6">
        <button
          className="px-6 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors duration-200 shadow-md hover:shadow-lg"
          onClick={resetPoints}
        >
          Reset
        </button>
        <button
          className="px-6 py-2 rounded-lg bg-yellow-400 text-gray-800 font-semibold hover:bg-yellow-500 transition-colors duration-200 shadow-md hover:shadow-lg"
          onClick={deleteLastPoint}
        >
          Supprimer dernier point
        </button>
        <button
          className="px-6 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors duration-200 shadow-md hover:shadow-lg"
          onClick={validatePath}
        >
          Valider le chemin
        </button>
      </div>



      {/* Status */}
      {statusMessage && (
        <div className="notification is-info mt-4">{statusMessage}</div>
      )}

      {/* Table */}
      <div className="table-container mt-4">
        <h3 className="subtitle is-5">Détail par point</h3>
        <table className="table is-fullwidth is-striped is-hoverable">
          <thead>
            <tr>
              <th>#</th>
              <th>Lat</th>
              <th>Lng</th>
              <th>Probabilité</th>
              <th>Prédiction</th>
            </tr>
          </thead>
          <tbody>
            {predictions.length === 0 && (
              <tr>
                <td colSpan={5} className="has-text-centered">
                  Aucune prédiction
                </td>
              </tr>
            )}
            {predictions.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{p.lat.toFixed(4)}</td>
                <td>{p.lng.toFixed(4)}</td>
                <td>
                  {p.probability_success !== undefined
                    ? (p.probability_success * 100).toFixed(2) + "%"
                    : "N/A"}
                </td>
                <td>{p.prediction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <div className="chart-container mt-4">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
}
