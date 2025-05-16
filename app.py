from flask import Flask, render_template, jsonify
import pandas as pd
import os
import json
from datetime import datetime

app = Flask(__name__)

# 📂 경로 설정
station_path = os.path.join("data", "station.csv")
line_path = os.path.join("data", "line_orders.json")
timetable_path = os.path.join("data", "preprocessed_timetable.csv")

# 📄 데이터 불러오기
df_station = pd.read_csv(station_path, encoding='utf-8')
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig")
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

# 역 좌표 딕셔너리 (시뮬레이션용)
station_dict = {row['역명']: (row['위도'], row['경도']) for _, row in df_station.iterrows()}

# ✅ 메인 페이지
@app.route("/")
def index():
    return render_template("index.html")

# ✅ 전처리된 시간표 반환
@app.route("/api/timetable")
def timetable():
    return jsonify(df_timetable.to_dict(orient="records"))

# ✅ 역 위치 정보 반환
@app.route("/api/stations")
def stations():
    df_station['호선명'] = df_station['호선'].astype(str) + '호선'
    return jsonify(df_station.to_dict(orient="records"))

# ✅ 노선 연결 순서 정보 반환
@app.route("/api/lines")
def lines():
    return jsonify(line_orders)

# ✅ 열차 실시간 위치 추정 (시뮬레이션용)
@app.route("/api/simulation_data")
def simulation_data():
    now = datetime.now().strftime("%H:%M:%S")
    active_trains = []

    for _, row in df_timetable.iterrows():
        if pd.isna(row['NEXT_ARRIVETIME']):
            continue

        left_time = row['LEFTTIME']
        next_arrive_time = row['NEXT_ARRIVETIME']

        if left_time < now < next_arrive_time:
            try:
                # 시간 보간 계산
                t1 = datetime.strptime(left_time, "%H:%M:%S")
                t2 = datetime.strptime(next_arrive_time, "%H:%M:%S")
                t_now = datetime.strptime(now, "%H:%M:%S")
                progress = (t_now - t1).total_seconds() / (t2 - t1).total_seconds()

                lat1, lon1 = station_dict.get(row['STATION_NM'], (None, None))
                lat2, lon2 = station_dict.get(row['NEXT_STATION'], (None, None))

                if lat1 is not None and lat2 is not None:
                    lat = lat1 + (lat2 - lat1) * progress
                    lon = lon1 + (lon2 - lon1) * progress

                    active_trains.append({
                        'train_no': row['TRAIN_NO'],
                        'line': row['LINE_NUM'],
                        'from': row['STATION_NM'],
                        'to': row['NEXT_STATION'],
                        'lat': lat,
                        'lon': lon
                    })
            except:
                continue

    return jsonify(active_trains)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000, debug=True)
