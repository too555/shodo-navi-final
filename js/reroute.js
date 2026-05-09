const ShodoReroute = (() => {
  const OFF_ROUTE_THRESHOLD_METERS = 60;
  const MIN_MOVE_FOR_CHECK_METERS = 30;
  const REROUTE_COOLDOWN_MS = 15000;

  let hasRoute;
  let getRouteLatLngs;
  let getDestination;
  let isRouting;
  let rerouteFromCurrentLocation;
  let refreshRouteFromCurrentLocation;
  let lastCheckedLatLng;
  let lastRerouteAt = 0;

  function initReroute(options = {}) {
    hasRoute = options.hasRoute;
    getRouteLatLngs = options.getRouteLatLngs;
    getDestination = options.getDestination;
    isRouting = options.isRouting;
    rerouteFromCurrentLocation = options.rerouteFromCurrentLocation;
    refreshRouteFromCurrentLocation = options.refreshRouteFromCurrentLocation;

    if (typeof options.onLocationUpdate === "function") {
      options.onLocationUpdate(handleLocationUpdate);
    }
  }

  async function handleLocationUpdate(currentLatLng, meta = {}) {
    if (meta.reason === "manual-refresh") {
      await handleManualRefresh(currentLatLng);
      return;
    }

    if (!canCheck(currentLatLng)) return;

    lastCheckedLatLng = currentLatLng;

    const routeLatLngs = getRouteLatLngs();
    const distanceFromRoute = getDistanceToRouteMeters(currentLatLng, routeLatLngs);

    if (distanceFromRoute <= OFF_ROUTE_THRESHOLD_METERS) return;
    if (!canRerouteNow()) return;

    lastRerouteAt = Date.now();
    await rerouteFromCurrentLocation(currentLatLng);
  }

  async function handleManualRefresh(currentLatLng) {
    lastCheckedLatLng = currentLatLng;

    if (!currentLatLng) return;
    if (typeof getDestination !== "function" || !getDestination()) return;
    if (typeof refreshRouteFromCurrentLocation !== "function") return;
    if (typeof isRouting === "function" && isRouting()) return;

    lastRerouteAt = Date.now();
    await refreshRouteFromCurrentLocation(currentLatLng);
  }

  function canCheck(currentLatLng) {
    if (!currentLatLng) return false;
    if (typeof hasRoute !== "function" || !hasRoute()) return false;
    if (typeof getDestination !== "function" || !getDestination()) return false;
    if (typeof getRouteLatLngs !== "function") return false;
    if (typeof rerouteFromCurrentLocation !== "function") return false;
    if (typeof isRouting === "function" && isRouting()) return false;

    if (lastCheckedLatLng) {
      const movedMeters = lastCheckedLatLng.distanceTo(currentLatLng);
      if (movedMeters < MIN_MOVE_FOR_CHECK_METERS) return false;
    }

    return true;
  }

  function canRerouteNow() {
    return Date.now() - lastRerouteAt >= REROUTE_COOLDOWN_MS;
  }

  function getDistanceToRouteMeters(point, routeLatLngs) {
    if (!Array.isArray(routeLatLngs) || routeLatLngs.length === 0) return Infinity;
    if (routeLatLngs.length === 1) return point.distanceTo(routeLatLngs[0]);

    let minDistance = Infinity;

    for (let index = 0; index < routeLatLngs.length - 1; index += 1) {
      const start = routeLatLngs[index];
      const end = routeLatLngs[index + 1];
      const distance = distanceToSegmentMeters(point, start, end);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  function distanceToSegmentMeters(point, start, end) {
    const pointXY = toLocalMeters(point, point);
    const startXY = toLocalMeters(start, point);
    const endXY = toLocalMeters(end, point);
    const dx = endXY.x - startXY.x;
    const dy = endXY.y - startXY.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return point.distanceTo(start);
    }

    const projection = ((pointXY.x - startXY.x) * dx + (pointXY.y - startXY.y) * dy) / lengthSquared;
    const clamped = Math.max(0, Math.min(1, projection));
    const closest = {
      x: startXY.x + clamped * dx,
      y: startXY.y + clamped * dy,
    };

    return Math.hypot(pointXY.x - closest.x, pointXY.y - closest.y);
  }

  function toLocalMeters(latLng, origin) {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);

    return {
      x: (latLng.lng - origin.lng) * metersPerDegreeLng,
      y: (latLng.lat - origin.lat) * metersPerDegreeLat,
    };
  }

  return {
    initReroute,
  };
})();
