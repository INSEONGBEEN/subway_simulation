// ✅ 3. 역 및 선로 렌더링
fetch('/api/stations')
  .then(res => res.json())
  .then(stations => {
    stations.forEach(station => {
      const lineName = `${station.호선}호선`;
      const color = lineColors[lineName] || 'gray';

      const isCongested = congestedStations.has(station.역명);
      const popupText = `
        🚉 ${station.역명} (${lineName})<br>
        ${isCongested ? "🌧️ 혼잡도 증가 적용됨" : "✅ 기본 혼잡도"}
      `;

      const marker = L.circleMarker([station.위도, station.경도], {
        radius: 3,
        color: isCongested ? 'red' : color,         // 혼잡한 역은 빨간 테두리
        fillColor: color,
        fillOpacity: 0.7
      }).bindPopup(popupText).addTo(map);

      stationMarkers[station.역명] = [station.위도, station.경도];
    });

    // ✅ 선로 렌더링
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
