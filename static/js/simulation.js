// 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11); // 서울 중심

// 타일 레이어
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// 역 마커 저장용
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

// 1. 역 정보 시각화
fetch('/api/stations')
  .then(res => res.json())
  .then(data => {
    data.forEach(station => {
      const marker = L.circleMarker([station.위도, station.경도], {
        radius: 3,
        color: 'black',
        fillColor: 'black',
        fillOpacity: 0.7
      }).bindPopup(`${station.역명} (${station.호선}호선)`).addTo(map);
      stationMarkers[station.역명] = [station.위도, station.경도];
    });
  });

// 2. 노선 선 연결
fetch('/api/lines')
  .then(res => res.json())
  .then(data => {
    const colors = {
      "1호선": "blue",
      "2호선": "green",
      "3호선": "orange",
      "4호선": "skyblue",
      "5호선": "purple",
      "6호선": "brown",
      "7호선": "olive",
      "8호선": "pink"
    };

    for (const [lineName, stations] of Object.entries(data)) {
      const coords = stations
        .map(name => stationMarkers[name])
        .filter(coord => coord !== undefined);
      if (coords.length >= 2) {
        L.polyline(coords, {
          color: colors[lineName.slice(0, 3)] || 'gray',
          weight: 3,
          opacity: 0.8
        }).addTo(map);
      }
    }
  });

// 3. 열차 시각화 함수
let timetableData = [];

function updateTrains() {
  // 기존 마커 제거
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

// 4. 시간표 데이터 불러오기 및 초기 표시
fetch('/api/timetable')
  .then(res => res.json())
  .then(data => {
    timetableData = data;
    updateTrains();
  });
