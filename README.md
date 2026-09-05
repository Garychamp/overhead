# Overhead

Overhead is a real-time flight tracker that shows aircraft flying within a 10 km radius of the user's current location. It displays live aircraft positions on a Leaflet radar map and keeps a rolling 24-hour record of flights detected overhead.

## Features

- Uses browser geolocation to center the map on the user's current position.
- Shows a 10 km detection radius around the user.
- Fetches live ADS-B aircraft data every 15 seconds.
- Filters aircraft to the exact 10 km radius using a haversine distance calculation.
- Displays aircraft markers with heading, altitude, callsign, aircraft type, registration, speed, and distance.
- Keeps a 24-hour flight history in browser local storage.
- Includes a local callsign route lookup for selected flights.
- Uses a responsive blue-gradient interface with an animated aircraft in the header.

## Running the project

The browser needs a local web server for geolocation and the ADS-B proxy. From the project directory, open two terminals and run:

```bash
node proxy.js
python3 -m http.server 5500
```

Then open [http://localhost:5500](http://localhost:5500) and allow location access when prompted.

The Node proxy runs on port `8080`. It forwards requests to the ADSB.lol API and adds the CORS headers required by the browser. The proxy also sends an identifiable user agent because the upstream API rejects generic requests.

## Data notes

Aircraft position data comes from [ADSB.lol](https://adsb.lol/). ADS-B broadcasts do not include an aircraft's scheduled departure and destination airports, so route information is available only for flights included in the local lookup table. Other aircraft display `Route unavailable`.

The 24-hour history is recorded from the time the app is running and is stored locally in the browser. It is not a historical archive from the flight-data provider.

## Project files

- `index.html` — page structure, Leaflet and font dependencies.
- `style.css` — responsive layout, blue theme, panel borders, markers, and animation.
- `javascript.js` — map setup, geolocation, polling, filtering, history, route lookup, and rendering.
- `proxy.js` — local CORS proxy for live aircraft data.

## Technologies

- HTML, CSS, and vanilla JavaScript
- [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles
- [Barlow](https://fonts.google.com/specimen/Barlow) web font
- Node.js built-in HTTP server and `fetch`
