// Initialize Leaflet map. Placeholder world view — geolocation will
// recenter this once wired up in a later session.
const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// TODO: wire up geolocation, plane data API, and 10km radius filter here.

// Keep footer year current.
document.getElementById("year").textContent = new Date().getFullYear();
