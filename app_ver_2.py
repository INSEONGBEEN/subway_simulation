# ✅ app_ver_2.py (수정 버전: 정차 상태 + 종착역 반영)
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

# 📄 데이터 로딩 (최적화 적용)
df_station = pd.read_csv(station_path, encoding='utf-8')
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

# 필요한 열만 읽고 dtype 지정하여 메모리 절약
usecols = [
    "TRAIN_NO", "LINE_NUM", "STATION_NM", "LEFTTIME",
    "NEXT_STATION", "NEXT_ARRIVETIME", "WEEK_TAG", "INOUT_TAG"
]
dtype = {
    "TRAIN_NO": str,
    "LINE_NUM": str,
    "STATION_NM": str,
    "LEFTTIME": str,
    "NEXT_STATION": str,
    "NEXT_ARRIVETIME": str,
    "WEEK_TAG": str,
    "INOUT_TAG": str
}
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig", usecols=usecols, dtype=dtype)

# 📍 역 좌표 딕셔너리
station_dict = {row['역명']: (row['위도'], row['경도']) for _, row in df_station.iterrows()}

# ✅ 메인 페이지 렌더링
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

    # LEFTTIME <= req_time <= NEXT_ARRIVETIME or (정차 상태: NEXT_ARRIVETIME == LEFTTIME)
    df_active = df_timetable.copy()
    df_active = df_active[
        (df_active['LEFTTIME'] <= req_time) &
        (df_active['NEXT_ARRIVETIME'] >= req_time)
    ]

    if selected_week != "전체":
        df_active = df_active[df_active['WEEK_TAG'] == selected_week]
    if selected_direction != "전체":
        df_active = df_active[df_active['INOUT_TAG'] == selected_direction]
    if selected_line != "전체":
        df_active = df_active[df_active['LINE_NUM'] == selected_line]

    active_trains = []
    for _, row in df_active.iterrows():
        try:
            from_coord = station_dict.get(row['STATION_NM'])
            to_coord = station_dict.get(row['NEXT_STATION'])
            if not from_coord:
                continue

            # 정차 상태 판단: 도착역 = 출발역 또는 NEXT_STATION 없음
            if row['STATION_NM'] == row['NEXT_STATION'] or pd.isna(row['NEXT_STATION']):
                active_trains.append({
                    "train_no": row['TRAIN_NO'],
                    "line": row['LINE_NUM'],
                    "from": row['STATION_NM'],
                    "to": row['NEXT_STATION'] if pd.notna(row['NEXT_STATION']) else row['STATION_NM'],
                    "progress": 0,
                    "status": "stopped"
                })
                continue

            if to_coord:
                t1 = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
                t2 = datetime.strptime(row['NEXT_ARRIVETIME'], "%H:%M:%S")
                progress = (t_now - t1).total_seconds() / (t2 - t1).total_seconds()
                progress = max(0, min(1, progress))

                active_trains.append({
                    "train_no": row['TRAIN_NO'],
                    "line": row['LINE_NUM'],
                    "from": row['STATION_NM'],
                    "to": row['NEXT_STATION'],
                    "progress": progress,
                    "status": "moving"
                })
        except:
            continue

    return jsonify(active_trains)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)
