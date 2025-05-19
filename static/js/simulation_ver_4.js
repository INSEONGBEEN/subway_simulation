// ✅ 0. 노선 색상 정의
const lineColors = {
  "1호선": "blue",
  "2호선": "green",
  "3호선": "orange",
  "4호선": "skyblue",
  "5호선": "purple",
  "6호선": "brown",
  "7호선": "olive",
  "8호선": "pink"
};

// ✅ 1. 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

let stationMarkers = {};
let trainMarkers = {};
let congestionMap = {};  // 혼잡도 저장용
let simInterval = null;
let currentSimTimeSec = 9 * 3600;
let speedMultiplier = 1;
let delayMap = {};  // 누적 지연 시간

const timeLabel = document.getElementById("timeLabel");
const speedSelect = document.getElementById("speed-select");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const directionSelect = document.getElementById("direction-select");
const weekdaySelect = document.getElementById("weekday-select");
const lineSelect = document.getElementById("line-select");
const weatherSelect = document.getElementById("weather-select");

let weatherLevel = "none";

function secondsToTimeString(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function animateMove(marker, fromLatLng, toLatLng, duration = 1000) {
  const start = performance.now();
  function step(timestamp) {
    const progress = Math.min((timestamp - start) / duration, 1);
    const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * progress;
    const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * progress;
    marker.setLatLng([lat, lng]);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ✅ 2. 역 & 선로 렌더링
fetch('/api/stations')
  .then(res => res.json())
  .then(stations => {
    stations.forEach(station => {
      const lineName = `${station.호선}호선`;
      const color = lineColors[lineName] || 'gray';
      congestionMap[station.역명] = 100;

      const marker = L.circleMarker([station.위도, station.경도], {
        radius: 3,
        color: color,
        fillColor: color,
        fillOpacity: 0.7
      }).bindPopup(`${station.역명} (${lineName})<br>🚶 혼잡도: ${congestionMap[station.역명]}%`).addTo(map);

      stationMarkers[station.역명] = [station.위도, station.경도];
    });

    return fetch('/api/lines');
  })
  .then(res => res.json())
  .then(lines => {
    for (const [lineName, stationList] of Object.entries(lines)) {
      const baseLine = lineName.match(/\d+호선/);
      const color = baseLine ? lineColors[baseLine[0]] : 'gray';
      const coords = stationList.map(name => stationMarkers[name]).filter(Boolean);
      if (coords.length >= 2) {
        L.polyline(coords, {
          color: color,
          weight: 3,
          opacity: 0.8
        }).addTo(map);
      }
    }
  });

// ▶️ 시작
startBtn.addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    currentSimTimeSec += speedMultiplier;
    timeLabel.innerText = secondsToTimeString(currentSimTimeSec);
    updateTrains(secondsToTimeString(currentSimTimeSec));
  }, 1000);
});

resetBtn.addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  Object.values(trainMarkers).forEach(m => map.removeLayer(m));
  trainMarkers = {};
  currentSimTimeSec = 9 * 3600;
  timeLabel.innerText = "09:00:00";
  delayMap = {};
  Object.keys(congestionMap).forEach(k => congestionMap[k] = 100);
});

speedSelect.addEventListener("change", () => {
  speedMultiplier = parseInt(speedSelect.value);
});

weatherSelect.addEventListener("change", () => {
  weatherLevel = weatherSelect.value;
});

function updateTrains(timeStr) {
  const direction = directionSelect.value;
  const weekday = weekdaySelect.value;
  const line = lineSelect.value;

  const params = new URLSearchParams({
    time: timeStr,
    direction: direction,
    weekday: weekday,
    line: line,
    congested: JSON.stringify(Object.keys(congestionMap).filter(k => congestionMap[k] > 100)),
    weather: weatherLevel
  });

  fetch(`/api/simulation_data?${params.toString()}`)
    .then(res => res.json())
    .then(data => {
      const activeIds = new Set();

      data.forEach(train => {
        const lat = train.lat;
        const lon = train.lon;
        const lineName = `${parseInt(train.line)}호선`;
        const color = lineColors[lineName] || 'gray';
        const key = train.train_no;
        activeIds.add(key);

        delayMap[key] = (delayMap[key] || 0) + (train.delay || 0);

        const icon = L.divIcon({
          className: 'emoji-icon',
          html: `<div style="font-size:12px;color:white;border:1px solid ${color};border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;background-color:${color};">🚇</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const popupText = `🚆 ${lineName}<br>열차번호: ${train.train_no}<br>다음역: ${train.to}<br>⏱️ 누적 지연: ${delayMap[key]}초`;

        if (trainMarkers[key]) {
          const prev = trainMarkers[key].getLatLng();
          animateMove(trainMarkers[key], prev, L.latLng(lat, lon), 1000);
          trainMarkers[key].setPopupContent(popupText);
        } else {
          const marker = L.marker([lat, lon], { icon: icon }).bindPopup(popupText);
          marker.addTo(map);
          trainMarkers[key] = marker;
        }
      });

      for (const key in trainMarkers) {
        if (!activeIds.has(key)) {
          map.removeLayer(trainMarkers[key]);
          delete trainMarkers[key];
          delete delayMap[key];
        }
      }
    });
}

// ✅ 드래그로 혼잡도 증가
let rectangle = null;
let startPoint = null;

map.on("mousedown", (e) => {
  if (weatherLevel !== "none") {
    startPoint = e.latlng;
    if (rectangle) map.removeLayer(rectangle);
  }
});

map.on("mousemove", (e) => {
  if (!startPoint) return;
  const bounds = L.latLngBounds(startPoint, e.latlng);
  if (!rectangle) {
    rectangle = L.rectangle(bounds, { color: "red", weight: 1 }).addTo(map);
  } else {
    rectangle.setBounds(bounds);
  }
});

map.on("mouseup", () => {
  if (!rectangle) return;
  const bounds = rectangle.getBounds();
  const affected = Object.entries(stationMarkers)
    .filter(([_, coord]) => bounds.contains(L.latLng(coord)))
    .map(([name]) => name);

  affected.forEach(name => congestionMap[name] += weatherLevel === "light" ? 5 : weatherLevel === "moderate" ? 10 : 20);
  alert(`🌧️ ${affected.length}개 역에 혼잡도 반영 완료!`);

  map.removeLayer(rectangle);
  rectangle = null;
  startPoint = null;
});

