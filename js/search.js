const ShodoSearch = (() => {
  let map;
  let form;
  let input;
  let button;
  let statusElement;
  let resultsElement;
  let getCurrentLatLng;
  let onSelect;
  let selectedResultId;

  function initSearch(targetMap, options = {}) {
    map = targetMap;
    form = options.form;
    input = options.input;
    button = options.button;
    statusElement = options.statusElement;
    resultsElement = options.resultsElement;
    getCurrentLatLng = options.getCurrentLatLng;
    onSelect = options.onSelect;

    if (!form || !input || !resultsElement) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(input.value.trim());
    });
  }

  async function search(query) {
    if (!query) {
      setStatus("目的地を入力してください。");
      clearResults();
      return;
    }

    const origin = getOrigin();
    if (!origin) {
      setStatus("現在地を取得してから検索してください。");
      clearResults();
      return;
    }

    setLoading(true);
    setStatus("検索しています...");
    clearResults();

    try {
      const places = await fetchPlaces(query);
      const sortedPlaces = places
        .map((place) => toSearchResult(place, origin))
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);

      renderResults(sortedPlaces, origin.isUserLocation);
      setStatus(sortedPlaces.length ? `${sortedPlaces.length}件見つかりました。` : "検索結果がありません。");
    } catch (error) {
      setStatus("検索に失敗しました。通信状況を確認してください。");
      clearResults();
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlaces(query) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "ja");
    url.searchParams.set("bounded", "0");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Search request failed");
    }

    return response.json();
  }

  function getOrigin() {
    const userLatLng = typeof getCurrentLatLng === "function" ? getCurrentLatLng() : null;
    if (!userLatLng) return null;

    return {
      latLng: userLatLng,
      isUserLocation: true,
    };
  }

  function toSearchResult(place, origin) {
    const lat = Number(place.lat);
    const lon = Number(place.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const latLng = L.latLng(lat, lon);
    const displayName = place.display_name || "名称不明";

    return {
      id: place.place_id || `${lat}-${lon}`,
      name: place.name || firstDisplayPart(displayName),
      address: displayName,
      latLng,
      distance: origin.latLng.distanceTo(latLng),
    };
  }

  function renderResults(results, isUserLocation) {
    clearResults();

    const distanceBase = isUserLocation ? "現在地から" : "基準地点から";

    results.forEach((result) => {
      const item = document.createElement("li");
      const resultButton = document.createElement("button");
      const name = document.createElement("span");
      const meta = document.createElement("span");

      item.dataset.resultId = String(result.id);
      resultButton.type = "button";
      resultButton.className = "result-button";
      name.className = "result-name";
      meta.className = "result-meta";

      name.textContent = result.name;
      meta.textContent = `${distanceBase} ${formatDistance(result.distance)} ・ ${result.address}`;

      resultButton.setAttribute("aria-pressed", String(String(result.id) === String(selectedResultId)));
      resultButton.addEventListener("click", () => {
        selectedResultId = String(result.id);
        updateSelectedResult();
        setStatus(`${result.name} を目的地にしました。`);

        if (typeof onSelect === "function") {
          onSelect(result);
        }
      });

      resultButton.append(name, meta);
      item.appendChild(resultButton);
      resultsElement.appendChild(item);
    });
  }

  function clearResults() {
    selectedResultId = null;
    resultsElement.replaceChildren();
  }

  function updateSelectedResult() {
    resultsElement.querySelectorAll(".result-button").forEach((button, index) => {
      const itemId = resultsElement.children[index]?.dataset.resultId;
      button.setAttribute("aria-pressed", String(itemId === String(selectedResultId)));
    });
  }

  function firstDisplayPart(displayName) {
    return String(displayName).split(",")[0].trim() || "名称不明";
  }

  function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "距離不明";
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
  }

  function setLoading(isLoading) {
    if (button) {
      button.disabled = isLoading;
      button.textContent = isLoading ? "検索中" : "検索";
    }
  }

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  return {
    initSearch,
  };
})();
