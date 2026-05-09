const INITIAL_CENTER = [35.681236, 139.767125];
const INITIAL_ZOOM = 14;

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
}).setView(INITIAL_CENTER, INITIAL_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

requestAnimationFrame(() => map.invalidateSize());
setTimeout(() => map.invalidateSize(), 500);
window.addEventListener("load", () => map.invalidateSize());

window.addEventListener("resize", () => map.invalidateSize());
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => map.invalidateSize());
}

ShodoLocation.initLocation(map, {
  statusElement: document.querySelector("#locationStatus"),
  refreshButton: document.querySelector("#refreshLocationButton"),
});

ShodoRouting.initRouting(map, {
  routeStatusElement: document.querySelector("#routeStatus"),
  getCurrentLatLng: ShodoLocation.getCurrentLatLng,
});

ShodoSearch.initSearch(map, {
  form: document.querySelector("#searchForm"),
  input: document.querySelector("#destination"),
  button: document.querySelector("#searchButton"),
  statusElement: document.querySelector("#searchStatus"),
  resultsElement: document.querySelector("#searchResults"),
  getCurrentLatLng: ShodoLocation.getCurrentLatLng,
  onSelect: ShodoRouting.selectDestination,
});

ShodoReroute.initReroute({
  onLocationUpdate: ShodoLocation.onLocationUpdate,
  hasRoute: ShodoRouting.hasRoute,
  getRouteLatLngs: ShodoRouting.getCurrentRouteLatLngs,
  getDestination: ShodoRouting.getSelectedDestination,
  isRouting: ShodoRouting.isRoutingActive,
  rerouteFromCurrentLocation: ShodoRouting.rerouteFromCurrentLocation,
  refreshRouteFromCurrentLocation: ShodoRouting.refreshRouteFromCurrentLocation,
});
