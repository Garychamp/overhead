// Map
const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const locationLayer = L.layerGroup().addTo(map); // user marker + radius circle
const planeLayer = L.layerGroup().addTo(map); // current plane markers

// Config
const RADIUS_KM = 10;
const REFRESH_MS = 15000;
const HISTORY_HOURS = 24;
const HISTORY_KEY = "overhead-history-v1";
// The adsb.lol API doesn't allow browser CORS. The page fetches through the
// local Node proxy (run `node proxy.js`). Swap in any CORS-friendly endpoint.
const PROXY_URL = "http://localhost:8080";

const emptyEl = document.querySelector(".details-empty");
const listEl = document.getElementById("flight-list");

// --- Route lookup ---
// ADS-B doesn't broadcast routes, so callsign → airline + flight number,
// then look up scheduled departure/destination by airline-prefix + digits.
const ROUTES = {
  BAW935: {
    airline: "British Airways",
    dep: "LHR",
    dest: "BER",
    depName: "London Heathrow",
    destName: "Berlin Brandenburg",
  },
  CSN673: {
    airline: "China Southern",
    dep: "PKX",
    dest: "MWX",
    depName: "Beijing Daxing",
    destName: "Muan (South Korea)",
  },
  EZY83MU: {
    airline: "easyJet",
    dep: "LTN",
    dest: "AMS",
    depName: "London Luton",
    destName: "Amsterdam",
  },
};

// Extract airline prefix (2-3 letters) and flight number digits from a callsign.
function parseCallsign(callsign) {
  const m = callsign.match(/^([A-Z]{2,3})(\d{1,4})/);
  if (!m) return null;
  return { prefix: m[1], number: m[2] };
}

function lookupRoute(callsign) {
  const key = callsign.replace(/\s/g, "");
  const direct = ROUTES[key];
  if (direct) return direct;
  const parsed = parseCallsign(key);
  if (!parsed || !ROUTES[parsed.prefix + parsed.number]) {
    return parsed ? { prefix: parsed.prefix, number: parsed.number } : null;
  }
  return ROUTES[parsed.prefix + parsed.number];
}

// --- History (24h window, persisted) ---
function loadHistory() {
  try {
    return new Map(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  } catch {
    return new Map();
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...history]));
  } catch {
    // storage unavailable; history simply won't persist
  }
}

function pruneHistory(history) {
  const cutoff = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
  for (const [hex, entry] of history) {
    if (entry.lastSeen < cutoff) history.delete(hex);
  }
}

function mergePlanes(history, planes) {
  for (const p of planes) {
    const route = lookupRoute((p.flight || "").trim());
    history.set(p.hex, {
      hex: p.hex,
      callsign: (p.flight || "").trim() || p.hex,
      route:
        route && route.dep
          ? `${route.depName} (${route.dep}) → ${route.destName} (${route.dest})`
          : route
            ? `${route.prefix}${route.number} · Route unavailable`
            : "Route unavailable",
      type: p.t || "Unknown",
      registration: p.r || "—",
      alt: p.alt_baro,
      speed: p.gs,
      track: p.track,
      dist: p.dist,
      lastSeen: Date.now(),
    });
  }
  pruneHistory(history);
  saveHistory(history);
}

// --- Rendering ---
function renderMarkers(planes) {
  planeLayer.clearLayers();
  for (const p of planes) {
    const heading = Math.round(p.track || 0);
    const icon = L.divIcon({
      className: "plane-marker",
      html: `<span style="display:inline-block; transform:rotate(${heading}deg)">✈️</span>`,
      iconSize: [24, 24],
    });
    const alt =
      typeof p.alt_baro === "number" ? `${p.alt_baro} ft` : "on ground";
    const route = lookupRoute((p.flight || "").trim());
    const routeText =
      route && route.dep
        ? `${route.depName} (${route.dep}) → ${route.destName} (${route.dest})`
        : route
          ? `${route.prefix}${route.number} · Route unavailable`
          : "Route unavailable";

    L.marker([p.lat, p.lon], { icon })
      .addTo(planeLayer)
      .bindPopup(
        `<b>${(p.flight || "").trim() || p.hex}</b><br>` +
          `Route: ${routeText}<br>` +
          `Alt: ${alt}<br>` +
          `Dist: ${p.dist.toFixed(1)} km`,
      );
  }
}

function renderDetails(history) {
  const entries = [...history.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  listEl.innerHTML = "";

  emptyEl.textContent = entries.length
    ? `Last ${HISTORY_HOURS}h: ${entries.length} flight${entries.length === 1 ? "" : "s"} within ${RADIUS_KM} km`
    : `No flights within ${RADIUS_KM} km in the last ${HISTORY_HOURS} hours.`;

  for (const e of entries) {
    const li = document.createElement("li");
    const time = new Date(e.lastSeen).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    li.innerHTML =
      `<div class="callsign">${e.callsign}</div>` +
      `<div class="route">${e.route}</div>` +
      `<div class="meta">${e.speed ? Math.round(e.speed) + " kt" : ""} · ` +
      `${e.track ? Math.round(e.track) + "°" : ""} · ` +
      `${e.dist.toFixed(1)} km</div>` +
      `<div class="meta muted">${e.type} · ${e.registration} · ${time}</div>`;
    listEl.appendChild(li);
  }
}

// --- Data ---
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchPlanes(lat, lon) {
  let resp = await fetch(`${PROXY_URL}/planes?lat=${lat}&lon=${lon}`).catch(
    () => null,
  );
  if (!resp || !resp.ok) {
    emptyEl.textContent =
      "Plane data unavailable — start the proxy: node proxy.js";
    return [];
  }
  const data = await resp.json();
  return (data.ac || [])
    .filter((ac) => ac.lat != null && ac.lon != null)
    .map((ac) => ({
      ...ac,
      dist: haversineKm(lat, lon, ac.lat, ac.lon),
    }))
    .filter((ac) => ac.dist <= RADIUS_KM);
}

function startTracking(lat, lon) {
  map.setView([lat, lon], 11);
  const history = loadHistory();

  locationLayer.clearLayers();
  L.circleMarker([lat, lon], {
    radius: 6,
    color: "#fff",
    weight: 2,
    fillOpacity: 0.9,
  })
    .bindPopup("You are here")
    .addTo(locationLayer);
  L.circle([lat, lon], {
    radius: RADIUS_KM * 1000,
    color: "#7fb8ff",
    weight: 1.5,
    dashArray: "4 6",
    fillOpacity: 0.05,
  }).addTo(locationLayer);

  const refresh = async () => {
    const planes = await fetchPlanes(lat, lon);
    if (!planes.length) {
      renderDetails(history);
      renderMarkers([]);
      return;
    }
    mergePlanes(history, planes);
    renderDetails(history);
    renderMarkers(planes);
  };

  refresh();
  setInterval(refresh, REFRESH_MS);
}

// --- Geolocation ---
emptyEl.textContent = "Locating you…";

if (!("geolocation" in navigator)) {
  emptyEl.textContent = "Geolocation is not supported in this browser.";
} else {
  navigator.geolocation.getCurrentPosition(
    (pos) => startTracking(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      emptyEl.textContent =
        "Location access denied. Allow it to see planes within 10 km of you.";
      console.warn("geolocation failed:", err.message);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}

// Keep footer year current.
document.getElementById("year").textContent = new Date().getFullYear();
