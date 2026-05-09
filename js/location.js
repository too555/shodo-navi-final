const ShodoLocation = (() => {
  const CENTER_ZOOM = 16;

  let map;
  let statusElement;
  let refreshButton;
  let userMarker;
  let accuracyCircle;
  let currentLatLng;
  let hasCenteredOnce = false;
  let watchId;
  const listeners = new Set();

  const userIcon = L.divIcon({
    className: "",
    html: '<div class="user-location-marker"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  function initLocation(targetMap, options = {}) {
    map = targetMap;
    statusElement = options.statusElement;
    refreshButton = options.refreshButton;

    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        setStatus("現在地を再取得しています...");
        locateOnce(true, "manual-refresh");
      });
    }

    if (!("geolocation" in navigator)) {
      setStatus("この端末では現在地を取得できません。");
      return;
    }

    locateOnce(false, "initial");
    startWatch();
  }

  function startWatch() {
    watchId = navigator.geolocation.watchPosition(
      (position) => updateUserLocation(position, false, "watch"),
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  }

  function locateOnce(forceCenter, reason = "manual") {
    navigator.geolocation.getCurrentPosition(
      (position) => updateUserLocation(position, forceCenter, reason),
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function updateUserLocation(position, forceCenter, reason) {
    const { latitude, longitude, accuracy } = position.coords;
    const latLng = L.latLng(latitude, longitude);
    currentLatLng = latLng;

    if (!userMarker) {
      userMarker = L.marker(latLng, {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarker.setLatLng(latLng);
    }

    if (!accuracyCircle) {
      accuracyCircle = L.circle(latLng, {
        radius: accuracy || 20,
        color: "#0f766e",
        weight: 1,
        fillColor: "#0f766e",
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latLng);
      accuracyCircle.setRadius(accuracy || 20);
    }

    if (!hasCenteredOnce || forceCenter) {
      map.setView(latLng, Math.max(map.getZoom(), CENTER_ZOOM), { animate: true });
      hasCenteredOnce = true;
    }

    const accuracyText = reason === "manual-refresh"
      ? "現在地を更新しました。"
      : accuracy
        ? `現在地を表示中（精度 約${Math.round(accuracy)}m）`
        : "現在地を表示中";
    setStatus(accuracyText);
    notifyLocationUpdate(latLng, reason);
  }

  function handleLocationError(error) {
    const messages = {
      1: "位置情報が許可されていません。SafariまたはiPhoneの設定を確認してください。",
      2: "現在地を取得できませんでした。電波状況を確認してください。",
      3: "現在地の取得がタイムアウトしました。",
    };

    setStatus(messages[error.code] || "現在地を取得できませんでした。");
  }

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function getCurrentLatLng() {
    return currentLatLng;
  }

  function onLocationUpdate(listener) {
    if (typeof listener !== "function") return () => {};

    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notifyLocationUpdate(latLng, reason) {
    listeners.forEach((listener) => {
      listener(latLng, { reason });
    });
  }

  return {
    initLocation,
    getCurrentLatLng,
    onLocationUpdate,
  };
})();
