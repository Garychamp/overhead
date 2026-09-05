// CORS proxy for the ADSB.lol flight API.
// Browsers block direct requests to the API (no CORS headers), so this tiny
// server forwards requests and adds an open Access-Control-Allow-Origin header.
// Usage: node proxy.js  →  available at http://localhost:8080

const http = require("http");

const PORT = 8080;
const TARGET = "https://api.adsb.lol";
const MAX_DIST_NM = 6; // request slightly wider than 10km; client filters exactly

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/planes") {
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");

    if (!lat || !lon) {
      res.writeHead(400, { "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "lat and lon query params required" }));
      return;
    }

    const upstream = `${TARGET}/v2/lat/${lat}/lon/${lon}/dist/${MAX_DIST_NM}`;
    try {
      // Upstream rejects generic bot user agents; send an identifiable one.
      const r = await fetch(upstream, {
        headers: { "User-Agent": "OverheadApp/1.0 (local flight demo)" },
      });
      const body = await r.text();
      res.writeHead(r.status, {
        "Content-Type": r.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (err) {
      res.writeHead(502, { "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "Upstream request failed" }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Unknown route. Use /planes?lat=..&lon=..");
});

server.listen(PORT, () => {
  console.log(
    `Overhead proxy running → http://localhost:${PORT}/planes?lat=51.5&lon=-0.12`,
  );
});
