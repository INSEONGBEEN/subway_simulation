// 지도 초기화
const map = L.map('map').setView([37.5665, 126.9780], 11); // 서울 중심

// 타일 레이어
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// 역 마커 저장용
let stationMarkers = {};
let trainMarkers = [];

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

// 3. 시간표 기반 열차 시각화
fetch('/api/timetable')
  .then(res => res.json())
  .then(data => {
    // 현재 시간 기준 필터링
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

    const activeTrains = data.filter(row => {
      return row.ARRIVETIME <= currentTime && row.LEFTTIME >= currentTime;
    });

    // 지도에 열차 마커 표시
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
  });
