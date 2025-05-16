// 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11); // 서울 중심

// 타일 레이어
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// 마커 저장용
let stationMarkers = {};
let trainMarkers = [];
let simInterval = null;  // 시뮬레이션 재생 타이머

// 현재 시각 상태 (슬라이더와 연결)
let currentSimTime = null;

// ⏱️ 시간 슬라이더 연결
const timeSlider = document.getElementById("timeSlider");
const timeLabel = document.getElementById("timeLabel");

// 초기 시각 설정
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
  updateSimulatedTrains();  // 슬라이더 변경 시 열차 위치 갱신
});

// 노선별 색상 정의
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

// 📌 역 정보 불러오기 → 완료되면 선로 연결도 실행
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

      // 📍 좌표 저장
      stationMarkers[station.역명] = [station.위도, station.경도];
    });

    // ✅ 선로 연결
    fetch('/api/lines')
      .then(res => res.json())
      .then(lines => {
        for (const [lineName, stationList] of Object.entries(lines)) {
          const baseLine = lineName.match(/\d+호선/);
          const color = baseLine ? lineColors[baseLine[0]] : 'gray';

          const coords = stationList
            .map(name => stationMarkers[name])
            .filter(coord => coord !== undefined);

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

// 📌 시뮬레이션 시작 버튼

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
  }, 1000);  // 1초 간격으로 시각 증가
});

// 🔄 초기화 버튼 → 시뮬레이션 중지 + 마커 삭제

document.getElementById("reset-btn").addEventListener("click", () => {
  if (simInterval) clearInterval(simInterval);
  trainMarkers.forEach(m => map.removeLayer(m));
  trainMarkers = [];
});

// 📌 열차 위치 시각화
function updateSimulatedTrains() {
  if (!currentSimTime) return;

  fetch(`/api/simulation_data?time=${currentSimTime}`)
    .then(res => res.json())
    .then(data => {
      // 기존 마커 제거
      trainMarkers.forEach(m => map.removeLayer(m));
      trainMarkers = [];

      data.forEach(train => {
        const from = train.from;
        const to = train.to;
        const p = train.progress;
        const line = train.line;

        const coord1 = stationMarkers[from];
        const coord2 = stationMarkers[to];
        if (!coord1 || !coord2) return;

        const lat = coord1[0] + (coord2[0] - coord1[0]) * p;
        const lon = coord1[1] + (coord2[1] - coord1[1]) * p;

        const lineStr = String(line).replace(/^0/, '');
        const lineKey = lineStr.endsWith("\ud638\uc120") ? lineStr : `${lineStr}호선`;
        const color = lineColors[lineKey] || "gray";

        const icon = L.divIcon({
          className: 'emoji-icon',
          html: `<div style="
            font-size: 16px;
            font-weight: bold;
            color: white;
            border: 2px solid ${color};
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

        const marker = L.marker([lat, lon], { icon: icon })
          .bindPopup(`🚆 ${lineKey}<br>${train.train_no}<br>→ ${train.to}`);

        trainMarkers.push(marker);
        marker.addTo(map);
      });
    })
    .catch(err => {
      console.error("🚨 시뮬레이션 데이터 로딩 실패:", err);
    });
}
