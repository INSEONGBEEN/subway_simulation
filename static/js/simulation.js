// 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11); // 서울 중심

// 타일 레이어
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// 마커 저장용
let stationMarkers = {};
let trainMarkers = {}; // 🔄 이제는 객체로 (train_no 기준)
let simInterval = null;  // 시뮬레이션 재생 타이머

// 현재 시각 상태 (슬라이더와 연결)
let currentSimTime = null;

// ⏱️ 시간 슬라이더 연결
const timeSlider = document.getElementById("timeSlider");
const timeLabel = document.getElementById("timeLabel");

function getTimeStringFromMinutes(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

currentSimTime = getTimeStringFromMinutes(parseInt(timeSlider.value));
timeLabel.innerText = currentSimTime;

timeSlider.addEventListener("input", () => {
  currentSimTime = getTimeStringFromMinutes(parseInt(timeSlider.value));
  timeLabel.innerText = currentSimTime;
  updateSimulatedTrains();
});

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

// 📌 1. 역 불러오기 및 선로 그리기
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

// ▶️ 시뮬레이션 시작
document.getElementById("start-btn").addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    let value = parseInt(timeSlider.value);
    if (value < 1439) {
      value += 1;
      timeSlider.value = value;
      currentSimTime = getTimeStringFromMinutes(value);
      timeLabel.innerText = currentSimTime;
      updateSimulatedTrains();
    } else {
      clearInterval(simInterval);
    }
  }, 1000);
});

// ⏹️ 초기화
document.getElementById("reset-btn").addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  Object.values(trainMarkers).forEach(m => map.removeLayer(m));
  trainMarkers = {};
});

// 🚇 애니메이션 이동
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

// 📌 4. 열차 위치 시각화
function updateSimulatedTrains() {
  if (!currentSimTime) return;

  fetch(`/api/simulation_data?time=${currentSimTime}`)
    .then(res => res.json())
    .then(data => {
      const activeIds = new Set();

      data.forEach(train => {
        const from = train.from;
        const to = train.to;
        const p = train.progress;
        const line = String(train.line).replace(/^0/, '').replace(/호선$/, '') + "호선";

        const coord1 = stationMarkers[from];
        const coord2 = stationMarkers[to];
        if (!coord1 || !coord2) return;

        const lat = coord1[0] + (coord2[0] - coord1[0]) * p;
        const lon = coord1[1] + (coord2[1] - coord1[1]) * p;
        const color = lineColors[line] || "gray";

        const icon = L.divIcon({
          className: 'emoji-icon',
          html: `<div style="
            font-size: 12px;
            font-weight: bold;
            color: white;
            border: 1px solid ${color};
            border-radius: 50%;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: ${color};
          ">🚇</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const key = train.train_no;
        activeIds.add(key);

        if (trainMarkers[key]) {
          const currentLatLng = trainMarkers[key].getLatLng();
          animateMove(trainMarkers[key], currentLatLng, L.latLng(lat, lon));
        } else {
          const marker = L.marker([lat, lon], { icon: icon }).bindPopup(`🚆 ${line}<br>${train.train_no}<br>→ ${train.to}`);
          trainMarkers[key] = marker;
          marker.addTo(map);
        }
      });

      // ❌ 지나간 열차 제거
      for (const key in trainMarkers) {
        if (!activeIds.has(key)) {
          map.removeLayer(trainMarkers[key]);
          delete trainMarkers[key];
        }
      }
    })
    .catch(err => console.error("🚨 시뮬레이션 데이터 로딩 실패:", err));
}
