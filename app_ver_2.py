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
usecols = ["TRAIN_NO", "LINE_NUM", "STATION_NM", "NEXT_STATION", "ARRIVETIME", "LEFTTIME", "NEXT_ARRIVETIME", "WEEK_TAG", "INOUT_TAG"]
dtypes = {
    "TRAIN_NO": str,
    "LINE_NUM": str,
    "STATION_NM": str,
    "NEXT_STATION": str,
    "ARRIVETIME": str,
    "LEFTTIME": str,
    "NEXT_ARRIVETIME": str,
    "WEEK_TAG": str,
    "INOUT_TAG": str
}
df_station = pd.read_csv(station_path, encoding='utf-8')
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig", low_memory=False, usecols=usecols, dtype=dtypes)
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

# 📍 역 좌표 딕셔너리
station_dict = {row['역명']: (row['위도'], row['경도']) for _, row in df_station.iterrows()}

@app.route("/")
def index():
    return render_template("index_ver_2.html")

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

    if selected_week != "전체":
        df_active = df_active[df_active['WEEK_TAG'] == selected_week]
    if selected_direction != "전체":
        df_active = df_active[df_active['INOUT_TAG'] == selected_direction]
    if selected_line != "전체":
        df_active = df_active[df_active['LINE_NUM'] == selected_line]

    active_trains = []
    for _, row in df_active.iterrows():
        try:
            # 정차 중인 상태 (ARRIVETIME <= now < LEFTTIME)
            if row['ARRIVETIME'] != "" and row['LEFTTIME'] != "":
                t_arrive = datetime.strptime(row['ARRIVETIME'], "%H:%M:%S")
                t_leave = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
                if t_arrive <= t_now < t_leave:
                    lat, lon = station_dict.get(row['STATION_NM'], (None, None))
                    if lat is not None:
                        active_trains.append({
                            'train_no': row['TRAIN_NO'],
                            'line': row['LINE_NUM'],
                            'from': row['STATION_NM'],
                            'to': row['NEXT_STATION'] if pd.notna(row['NEXT_STATION']) else row['STATION_NM'],
                            'progress': 0,
                            'status': 'stopped'
                        })
                        continue

            # 이동 중인 상태 (LEFTTIME <= now <= NEXT_ARRIVETIME)
            if row['LEFTTIME'] != "" and row['NEXT_ARRIVETIME'] != "":
                t1 = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
                t2 = datetime.strptime(row['NEXT_ARRIVETIME'], "%H:%M:%S")
                if t1 <= t_now <= t2:
                    lat1, lon1 = station_dict.get(row['STATION_NM'], (None, None))
                    lat2, lon2 = station_dict.get(row['NEXT_STATION'], (None, None))
                    if lat1 is None or lat2 is None:
                        continue

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
