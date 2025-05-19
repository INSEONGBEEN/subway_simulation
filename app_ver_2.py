# ✅ app_ver_2.py
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
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig", low_memory=False)
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

# 📍 역 좌표 딕셔너리
station_dict = {row['역명']: (row['위도'], row['경도']) for _, row in df_station.iterrows()}

@app.route("/")
def index():
    return render_template("index_ver_3.html")

@app.route("/api/stations")
def stations():
    df_station['호선명'] = df_station['호선'].astype(str) + '호선'
    return jsonify(df_station.to_dict(orient="records"))

@app.route("/api/lines")
def lines():
    return jsonify(line_orders)

@app.route("/api/simulation_data")
def simulation_data():
    req_time = request.args.get("time")
    selected_week = request.args.get("weekday", "3")
    selected_direction = request.args.get("direction", "전체")
    selected_line = request.args.get("line", "전체")

    if not req_time:
        return jsonify([])

    try:
        t_now = datetime.strptime(req_time, "%H:%M:%S")
    except:
        return jsonify([])

    df_active = df_timetable.copy()
    df_active = df_active[
        (df_active['LEFTTIME'] <= req_time) & 
        (df_active['NEXT_ARRIVETIME'] >= req_time)
    ]

    if selected_week != "전체":
        df_active = df_active[df_active['WEEK_TAG'].astype(str) == selected_week]
    if selected_direction != "전체":
        df_active = df_active[df_active['INOUT_TAG'].astype(str) == selected_direction]
    if selected_line != "전체":
        df_active = df_active[df_active['LINE_NUM'] == selected_line]

    active_trains = []
    for _, row in df_active.iterrows():
        try:
            lat1, lon1 = station_dict.get(row['STATION_NM'], (None, None))
            lat2, lon2 = station_dict.get(row['NEXT_STATION'], (None, None))
            if lat1 is None:
                continue

            # 정차 상태: 같은 역에 머물고 있는 경우
            if row['STATION_NM'] == row['NEXT_STATION'] or pd.isna(row['NEXT_STATION']):
                active_trains.append({
                    'train_no': row['TRAIN_NO'],
                    'line': row['LINE_NUM'],
                    'from': row['STATION_NM'],
                    'to': row['NEXT_STATION'] if pd.notna(row['NEXT_STATION']) else row['STATION_NM'],
                    'progress': 0,
                    'status': 'stopped'
                })
                continue

            if lat2 is not None:
                t1 = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
                t2 = datetime.strptime(row['NEXT_ARRIVETIME'], "%H:%M:%S")
                progress = (t_now - t1).total_seconds() / (t2 - t1).total_seconds()
                progress = max(0, min(1, progress))

                active_trains.append({
                    'train_no': row['TRAIN_NO'],
                    'line': row['LINE_NUM'],
                    'from': row['STATION_NM'],
                    'to': row['NEXT_STATION'],
                    'progress': progress,
                    'status': 'moving'
                })
        except:
            continue

    return jsonify(active_trains)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)
