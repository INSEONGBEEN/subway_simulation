from flask import Flask, render_template, jsonify, request
import pandas as pd
import os
import json
from datetime import datetime

app = Flask(__name__)

# 📂 파일 경로 설정
station_path = os.path.join("data", "station.csv")
line_path = os.path.join("data", "line_orders.json")
timetable_path = os.path.join("data", "preprocessed_timetable.csv")

# 📄 데이터 로딩
df_station = pd.read_csv(station_path, encoding='utf-8')
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig")
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

# 📍 역 좌표 딕셔너리
station_dict = {row['역명']: (row['위도'], row['경도']) for _, row in df_station.iterrows()}

# ✅ 메인 페이지 렌더링 (ver.1)
@app.route("/")
def index():
    return render_template("index_ver_1.html")

# ✅ 역 위치 정보 API
@app.route("/api/stations")
def stations():
    df_station['호선명'] = df_station['호선'].astype(str) + '호선'
    return jsonify(df_station.to_dict(orient="records"))

# ✅ 노선 연결 순서 API
@app.route("/api/lines")
def lines():
    return jsonify(line_orders)

# ✅ 시뮬레이션용 열차 위치 정보 API
@app.route("/api/simulation_data")
def simulation_data():
    req_time = request.args.get("time")
    if not req_time:
        return jsonify([])

    try:
        t_now = datetime.strptime(req_time, "%H:%M:%S")
    except:
        return jsonify([])

    # 🔍 해당 시각에 운행 중인 열차 필터링
    df_active = df_timetable[
        (df_timetable['LEFTTIME'] < req_time) & 
        (df_timetable['NEXT_ARRIVETIME'] > req_time)
    ]

    active_trains = []
    for _, row in df_active.iterrows():
        try:
            t1 = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
            t2 = datetime.strptime(row['NEXT_ARRIVETIME'], "%H:%M:%S")
            progress = (t_now - t1).total_seconds() / (t2 - t1).total_seconds()
            progress = max(0, min(1, progress))  # 0~1 사이로 제한

            lat1, lon1 = station_dict.get(row['STATION_NM'], (None, None))
            lat2, lon2 = station_dict.get(row['NEXT_STATION'], (None, None))

            if lat1 is not None and lat2 is not None:
                active_trains.append({
                    'train_no': row['TRAIN_NO'],
                    'line': row['LINE_NUM'],
                    'from': row['STATION_NM'],
                    'to': row['NEXT_STATION'],
                    'progress': progress
                })

        except Exception as e:
            print("Error in row processing:", e)
            continue

    return jsonify(active_trains)

# ✅ 실행
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)
