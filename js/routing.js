const ShodoRouting = (() => {
  const ROUTING_ENDPOINT = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
  const WALKING_SPEED_METERS_PER_MINUTE = 80;

  let map;
  let routeStatusElement;
  let getCurrentLatLng;
  let destinationMarker;
  let routeLine;
  let selectedDestination;
  let isRouting = false;
  let currentRouteLatLngs = [];

  const destinationIcon = L.divIcon({
    className: "",
    html: '<div class="destination-marker"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

  function initRouting(targetMap, options = {}) {
    map = targetMap;
    routeStatusElement = options.routeStatusElement;
    getCurrentLatLng = options.getCurrentLatLng;
  }

  async function selectDestination(destination) {
    if (!destination || !destination.latLng) return;

    selectedDestination = destination;
    showDestinationMarker(destination);

    const start = typeof getCurrentLatLng === "function" ? getCurrentLatLng() : null;
    if (!start) {
      showRouteStatus("現在地を取得してからルートを表示します。", false);
      return;
    }

    await buildWalkingRoute(start, destination);
  }

  function showDestinationMarker(destination) {
    if (!destinationMarker) {
      destinationMarker = L.marker(destination.latLng, {
        icon: destinationIcon,
        zIndexOffset: 900,
      }).addTo(map);
    } else {
      destinationMarker.setLatLng(destination.latLng);
    }

    destinationMarker.bindPopup(destination.name).openPopup();
  }

  async function buildWalkingRoute(start, destination) {
    if (isRouting) return;

    isRouting = true;
    showRouteStatus("徒歩ルートを取得しています...", false);

    try {
      const route = await fetchWalkingRoute(start, destination.latLng);
      const routeLatLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      if (routeLine) {
        routeLine.setLatLngs(routeLatLngs);
      } else {
        routeLine = L.polyline(routeLatLngs, {
          color: "#0f766e",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      currentRouteLatLngs = routeLatLngs.map(([lat, lng]) => L.latLng(lat, lng));
      fitRoute(start, destination.latLng, routeLatLngs);
      showRouteSummary(route);
    } catch (error) {
      showRouteStatus("徒歩ルートを取得できませんでした。別の目的地を試してください。", false);
    } finally {
      isRouting = false;
    }
  }

  async function fetchWalkingRoute(start, goal) {
    const coordinates = `${start.lng},${start.lat};${goal.lng},${goal.lat}`;
    const url = new URL(`${ROUTING_ENDPOINT}/${coordinates}`);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "false");
    url.searchParams.set("generate_hints", "false");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Route request failed");
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route?.geometry?.coordinates?.length) {
      throw new Error("Route not found");
    }

    return route;
  }

  function fitRoute(start, goal, routeLatLngs) {
    const bounds = L.latLngBounds([start, goal, ...routeLatLngs]);
    map.fitBounds(bounds, {
      paddingTopLeft: [28, 80],
      paddingBottomRight: [28, 240],
      maxZoom: 17,
      animate: true,
    });
  }

  function showRouteSummary(route, prefix = "") {
    const distance = formatDistance(route.distance);
    const durationMinutes = route.duration ? Math.max(1, Math.round(route.duration / 60)) : estimateWalkingMinutes(route.distance);
    const message = prefix ? `${prefix}。徒歩 ${distance} ・ 約${durationMinutes}分` : `徒歩 ${distance} ・ 約${durationMinutes}分`;
    showRouteStatus(message, true);
  }

  function showRouteStatus(message, isSummary) {
    if (!routeStatusElement) return;

    routeStatusElement.textContent = message;
    routeStatusElement.hidden = false;
    routeStatusElement.dataset.summary = String(isSummary);
  }

  function estimateWalkingMinutes(distanceMeters) {
    if (!Number.isFinite(distanceMeters)) return 1;
    return Math.max(1, Math.round(distanceMeters / WALKING_SPEED_METERS_PER_MINUTE));
  }

  function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "距離不明";
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
  }

  function getSelectedDestination() {
    return selectedDestination;
  }

  function getCurrentRouteLatLngs() {
    return currentRouteLatLngs;
  }

  function hasRoute() {
    return currentRouteLatLngs.length > 1;
  }

  function isRoutingActive() {
    return isRouting;
  }

  async function rerouteFromCurrentLocation(start) {
    if (!selectedDestination || !start || isRouting) return false;

    isRouting = true;
    showRouteStatus("ルートから外れたため再ルートしています...", false);

    try {
      const route = await fetchWalkingRoute(start, selectedDestination.latLng);
      const routeLatLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      if (routeLine) {
        routeLine.setLatLngs(routeLatLngs);
      } else {
        routeLine = L.polyline(routeLatLngs, {
          color: "#0f766e",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      currentRouteLatLngs = routeLatLngs.map(([lat, lng]) => L.latLng(lat, lng));
      showRouteSummary(route);
      return true;
    } catch (error) {
      showRouteStatus("再ルートできませんでした。現在のルートを表示したままにします。", false);
      return false;
    } finally {
      isRouting = false;
    }
  }

  async function refreshRouteFromCurrentLocation(start) {
    if (!selectedDestination || !start || isRouting) return false;

    isRouting = true;
    showRouteStatus("現在地からルートを更新しています...", false);

    try {
      const route = await fetchWalkingRoute(start, selectedDestination.latLng);
      const routeLatLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      if (routeLine) {
        routeLine.setLatLngs(routeLatLngs);
      } else {
        routeLine = L.polyline(routeLatLngs, {
          color: "#0f766e",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      currentRouteLatLngs = routeLatLngs.map(([lat, lng]) => L.latLng(lat, lng));
      showRouteSummary(route, "ルートを更新しました");
      return true;
    } catch (error) {
      showRouteStatus("ルートを更新できませんでした。現在のルートを表示したままにします。", false);
      return false;
    } finally {
      isRouting = false;
    }
  }

  return {
    initRouting,
    selectDestination,
    getSelectedDestination,
    getCurrentRouteLatLngs,
    hasRoute,
    isRoutingActive,
    rerouteFromCurrentLocation,
    refreshRouteFromCurrentLocation,
  };
})();
