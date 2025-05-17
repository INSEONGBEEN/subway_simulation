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
let simInterval = null;
let currentSimTimeSec = 9 * 3600;
let speedMultiplier = 1;

const timeLabel = document.getElementById("timeLabel");
const speedSelect = document.getElementById("speed-select");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const weekSelect = document.getElementById("week-select");
const directionSelect = document.getElementById("direction-select");
const lineSelect = document.getElementById("line-select");

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

// ✅ 2. 역 + 선로 표시
fetch('/api/stations')
  .then(res => res.json())
  .then(stations => {
    stations.forEach(station => {
      const lineName = `${station.호선}호선`;
      const color = lineColors[lineName] || 'gray';
      const marker = L.circleMarker([station.위도, station.경도], {
        radius: 3,
        color: color,
        fillColor: color,
        fillOpacity: 0.7
      }).bindPopup(`${station.역명} (${lineName})`).addTo(map);
      stationMarkers[station.역명] = [station.위도, station.경도];
    });

    fetch('/api/lines')
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
  });

startBtn.addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    currentSimTimeSec += speedMultiplier;
    const timeStr = secondsToTimeString(currentSimTimeSec);
    timeLabel.innerText = timeStr;
    updateTrains(timeStr);
  }, 1000);
});

resetBtn.addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  Object.values(trainMarkers).forEach(m => map.removeLayer(m));
  trainMarkers = {};
  currentSimTimeSec = 9 * 3600;
  timeLabel.innerText = "09:00:00";
});

speedSelect.addEventListener("change", () => {
  speedMultiplier = parseInt(speedSelect.value);
});

function updateTrains(timeStr) {
  const week_tag = weekSelect.value;
  const inout_tag = directionSelect.value;
  const line_filter = lineSelect.value;
  const url = `/api/simulation_data?time=${timeStr}&week_tag=${week_tag}&inout_tag=${inout_tag}&line_filter=${line_filter}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const activeIds = new Set();
      data.forEach(train => {
        const from = stationMarkers[train.from];
        const to = stationMarkers[train.to];
        if (!from || !to) return;

        const p = train.progress;
        const lat = from[0] + (to[0] - from[0]) * p;
        const lon = from[1] + (to[1] - from[1]) * p;
        const line = `${parseInt(train.line)}호선`;
        const color = lineColors[line] || 'gray';
        const key = train.train_no;

        const icon = L.divIcon({
          className: 'emoji-icon',
          html: `<div style="font-size: 12px; color: white; border: 1px solid ${color}; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; background-color: ${color};">🚇</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        activeIds.add(key);

        if (trainMarkers[key]) {
          const prev = trainMarkers[key].getLatLng();
          animateMove(trainMarkers[key], prev, L.latLng(lat, lon), 1000);
        } else {
          const marker = L.marker([lat, lon], { icon: icon })
            .bindPopup(`🚆 ${line}<br>${train.train_no}<br>→ ${train.to}`);
          marker.addTo(map);
          trainMarkers[key] = marker;
        }
      });

      for (const key in trainMarkers) {
        if (!activeIds.has(key)) {
          map.removeLayer(trainMarkers[key]);
          delete trainMarkers[key];
        }
      }
    })
    .catch(err => console.error("🚨 로딩 실패:", err));
}
