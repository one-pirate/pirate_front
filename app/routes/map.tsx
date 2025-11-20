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
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [fullPath, setFullPath] = useState<{ lat: number; lng: number }[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [spacing, setSpacing] = useState(10); // New state for spacing

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
          type: "Feature",
          geometry: { type: "LineString", coordinates: [] },
          properties: {},
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#fff000", "line-width": 4 },
      });

      lineRef.current = map.getSource("route") as maplibregl.GeoJSONSource;
    });

    // Add point on click
    const clickHandler = (e: maplibregl.MapMouseEvent) => {
      const newPt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPoints((currentPoints) => [...currentPoints, newPt]);
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
    lineRef.current.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: fullPath.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    });
  }, [fullPath]);

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
    if (fullPath.length === 0) return;

    const res = await predictRisk(fullPath);

    setPredictions(res.predictions);

    if (res.global_risk > 0.5) {
      setStatusMessage(
        "⚠️ Attention : chemin risqué, probabilité élevée d'attaque !"
      );
    } else {
      setStatusMessage("✔️ Chemin sûr selon le modèle.");
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
    <div className="container mx-auto p-4">
      <h1 className="title is-3 mb-4 text-center">
        Navigation Pirate Risk
      </h1>

      {/* MAP */}
      <div
        ref={mapContainer}
        className="rounded-lg shadow-md"
        style={{ height: "60vh", border: "2px solid #333" }}
      />

      {/* SPACING SLIDER */}
      <div className="field mt-6">
        <label className="label">Spacing: {spacing}</label>
        <div className="control">
          <input
            className="slider is-fullwidth is-info"
            step="1"
            min="10"
            max="1000"
            value={spacing}
            type="range"
            onChange={(e) => setSpacing(Number(e.target.value))}
          />
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex gap-4 justify-center mt-6">
        <button
          className="button is-danger px-6 py-2 shadow-lg"
          onClick={resetPoints}
        >
          Reset
        </button>

        <button
          className="button is-warning px-6 py-2 shadow-lg"
          onClick={deleteLastPoint}
        >
          Supprimer dernier point
        </button>

        <button
          className="button is-primary px-6 py-2 shadow-lg"
          onClick={validatePath}
        >
          Valider le chemin
        </button>
      </div>

      {/* STATUS */}
      {statusMessage && (
        <div className="notification is-info mt-4 has-text-centered text-lg">
          {statusMessage}
        </div>
      )}

      {/* TABLE */}
      <div className="table-container mt-6">
        <h3 className="subtitle is-5">Détails des prédictions</h3>

        <table className="table is-striped is-hoverable is-fullwidth">
          <thead>
            <tr>
              <th>#</th>
              <th>Lat</th>
              <th>Lng</th>
              <th>Probabilité</th>
              <th>Prédiction</th>
              <th>Explain</th>
            </tr>
          </thead>

          <tbody>
            {predictions.length === 0 ? (
              <tr>
                <td colSpan={6} className="has-text-centered">
                  Aucune donnée
                </td>
              </tr>
            ) : (
              predictions.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{p.lat.toFixed(4)}</td>
                  <td>{p.lng.toFixed(4)}</td>
                  <td>
                    {p.probability_success !== null
                      ? (p.probability_success * 100).toFixed(2) + "%"
                      : "N/A"}
                  </td>
                  <td>{p.prediction}</td>
                  <td>
                    <Link
                      to={`/explain?lat=${p.lat}&lng=${p.lng}`}
                      className="button is-info is-small"
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Explain
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
  );
}