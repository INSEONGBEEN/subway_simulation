
# 🌨️ 날씨 기반 지하철 지연 시뮬레이션 시스템  
@injjang  
2025.05 ~ (진행중)

---

### 🔗 Live Demo  
https://subway-simulation.onrender.com

### 📂 GitHub Repository  
https://github.com/INSEONGBEEN/subway_simulation

### 📘 Dev Log  
https://lnjjang.tistory.com

---

## 📌 프로젝트 개요  

서울교통공사의 시간표 데이터를 기반으로 **지하철 열차의 실시간 위치를 시뮬레이션**하며,  
**날씨와 혼잡도에 따른 정차 시간 증가 및 누적 지연을 시각적으로 표현**하는 프로젝트입니다.

SQLite DB + Flask 백엔드, Leaflet.js 기반 프론트, 그리고 Render를 이용한 배포 환경으로 구성되어 있습니다.

---

## 🛠️ 주요 기능  

- **SQLite 기반 시간표 시뮬레이션**
  - 서울교통공사 시간표 OpenAPI → CSV → SQLite DB 변환
  - 시간 기반 열차 상태(정차/이동/종착) 및 위치 계산
- **Leaflet 지도 기반 시각화**
  - 역 마커 + 호선별 노선(Polyline) + 열차 아이콘 표시
  - 마커 클릭 시 역 혼잡도 및 열차 누적 지연 표시
- **날씨 영향 기반 혼잡도 모델링**
  - Shift+Drag로 특정 지역 날씨 영향 적용
  - 날씨 강도에 따라 정차 시간 증가 → 누적 지연 발생
- **실시간 누적 지연 계산**
  - 정차(stopped) → 이동(moving) 상태 전이 시 delay만 누적
  - 사용자 UI를 통한 진행 상황 추적

---

## 🧱 기술 스택  

| Category       | Tools                                |
|----------------|--------------------------------------|
| Language       | Python, JavaScript                   |
| Backend        | Flask                                |
| Database       | SQLite                               |
| Frontend       | Leaflet.js, HTML/CSS                 |
| Data Handling  | pandas, datetime, ast                |
| Deployment     | Render                               |
| Visualization  | Leaflet Polyline, Marker, Popup 등   |

---

## 🗂️ 디렉토리 구조

```
📁 subway_simulation/
├── app_ver_4.py
├── requirements.txt
├── /data
│   ├── station.csv
│   ├── line_orders.json
│   └── preprocessed_timetable.db
├── /templates
│   └── index_ver_4.html
├── /static
│   ├── /js
│   │   └── simulation_ver_4.js
│   └── /css
│       └── style_ver_4.css
```

---

## 🚀 실행 예시

- 초기 시각(09:00:00)부터 1초 단위로 열차 시뮬레이션 진행
- 각 열차 마커는 현재 위치를 기반으로 지도에 표시됨
- 마커 클릭 시: 열차 번호, 다음역, 누적 지연 시간 팝업
- Shift+Drag로 날씨 영향 지역 선택 → 정차시간 증가 반영

---

## 🔧 보완할 점 & 향후 아이디어  

| 한계점 | 보완 아이디어 |
|--------|----------------|
| 누적 지연시간이 반복 누적될 위험 | 상태 전이 기준 가산으로 해결 |
| 실시간 API 미적용 | 실시간 위치 OpenAPI와 하이브리드 고려 |
| 혼잡도 수동 설정 | 출퇴근 시간 기반 자동 혼잡도 반영 |
| 마커 시각 단순화 | 마커 애니메이션 및 시각 요소 개선 |
| 날씨 수동 입력 | 외부 기상 API 자동 연동 시도 예정 |

---

## ✍️ 느낀 점  

- **정적 시간표 데이터를 동적으로 해석**하여 시뮬레이션하는 과정이 흥미로웠으며,  
  날씨나 혼잡도처럼 **외부 요인을 반영한 UX 설계 경험**이 인상 깊었음
- 지하철이라는 **공공 인프라의 운영 시나리오를 실감나게 표현**할 수 있었고,  
  시각적으로 전달력이 강한 결과물을 도출함
- 기상청 API 등과 결합해 **예측형 모델로 확장할 여지**가 크며,  
  공공데이터 기반 인터랙티브 시뮬레이션 프로젝트의 가능성을 확인함
