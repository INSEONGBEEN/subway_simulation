// 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11); // 서울 중심

// 타일 레이어
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// 마커 저장용
let stationMarkers = {};
let trainMarkers = [];

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
  updateTrains();
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

// 📌 1. 역 정보 불러오기 → 완료되면 선로 연결도 실행
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

    // ✅ 2. 선로 연결 (역 정보 로딩 완료 후에 실행해야 좌표가 있음)
    fetch('/api/lines')
      .then(res => res.json())
      .then(lines => {
        for (const [lineName, stationList] of Object.entries(lines)) {
          const baseLine = lineName.match(/\d+호선/);
          const color = baseLine ? lineColors[baseLine[0]] : 'gray';

          const coords = stationList
            .map(name => stationMarkers[name])
            .filter(coord => coord !== undefined); // 좌표가 존재할 때만 추가

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

// 📌 3. 열차 시각화
let timetableData = [];

function updateTrains() {
  trainMarkers.forEach(m => map.removeLayer(m));
  trainMarkers = [];

  const activeTrains = timetableData.filter(row => {
    return row.ARRIVETIME <= currentSimTime && row.LEFTTIME >= currentSimTime;
  });

  activeTrains.forEach(train => {
    const coord = stationMarkers[train.STATION_NM];
    if (coord) {
      const marker = L.circleMarker(coord, {
        radius: 6,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.9
      }).bindPopup(`🚆 ${train.LINE_NUM}<br>${train.TRAIN_NO}<br>→ ${train.SUBWAYENAME}`);
      trainMarkers.push(marker);
      marker.addTo(map);
    }
  });
}

// 📌 4. 시간표 불러오기
fetch('/api/timetable')
  .then(res => res.json())
  .then(data => {
    timetableData = data;
    updateTrains();
  });
