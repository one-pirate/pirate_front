import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "~/services/backend";

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/019a3adf-ed0a-74b4-b1f1-b55ffeefcdd4/style.json?key=Vx085W00NFIfkyFGT02u", // style URL
      center: [0, 0], // starting position [lng, lat]
      zoom: 1, // starting zoom
    });

    map.on("mousedown", (e) => {
      setPosition([e.lngLat.lat, e.lngLat.lng]);
      api
        .post("/map/send-coords", { lat: e.lngLat.lat, lng: e.lngLat.lng })
        .then((response) => {
          console.log("Coordinates sent successfully:", response);
        })
        .catch((err) => {
          console.error("Failed to send coordinates:", err);
        });
    });

    return () => map.remove(); // cleanup on unmount
  }, []);

  return (
    <div>
      <div ref={mapContainer} id="map" className="w-full h-[80vh] border" />
      <p className="text-center mt-4">
        Latitude: {position[0].toFixed(6)}, Longitude: {position[1].toFixed(6)}
      </p>
    </div>
  );
}
