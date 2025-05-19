from flask import Flask, render_template, jsonify, request
import pandas as pd
import os
import json
import sqlite3
from datetime import datetime

app = Flask(__name__)

# 📂 파일 경로
station_path = os.path.join("data", "station.csv")
line_path = os.path.join("data", "line_orders.json")
db_path = os.path.join("data", "preprocessed_timetable.db")

# 📄 역 위치, 노선 불러오기
df_station = pd.read_csv(station_path, encoding='utf-8')
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

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

    conn = sqlite3.connect(db_path)
    query = f"""
        SELECT TRAIN_NO, LINE_NUM, STATION_NM, ARRIVETIME, LEFTTIME, 
               NEXT_STATION, NEXT_ARRIVETIME, WEEK_TAG, INOUT_TAG
        FROM timetable
        WHERE ARRIVETIME <= ? AND NEXT_ARRIVETIME >= ?
    """
    params = [req_time, req_time]
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()

    if selected_week != "전체":
        df = df[df['WEEK_TAG'] == selected_week]
    if selected_direction != "전체":
        df = df[df['INOUT_TAG'] == selected_direction]
    if selected_line != "전체":
        df = df[df['LINE_NUM'] == selected_line]

    active_trains = []
    for _, row in df.iterrows():
        train_no = row['TRAIN_NO']
        line = row['LINE_NUM']
        from_station = row['STATION_NM']
        to_station = row['NEXT_STATION']

        lat1, lon1 = station_dict.get(from_station, (None, None))
        lat2, lon2 = station_dict.get(to_station, (None, None))
        if lat1 is None:
            continue

        try:
            t_arrive = datetime.strptime(row['ARRIVETIME'], "%H:%M:%S")
            t_depart = datetime.strptime(row['LEFTTIME'], "%H:%M:%S")
            t_next_arrive = datetime.strptime(row['NEXT_ARRIVETIME'], "%H:%M:%S") if pd.notna(row['NEXT_ARRIVETIME']) else None
            progress = 0.0
            status = "stopped"

            if t_arrive <= t_now < t_depart:
                # 정차 중
                progress = 0
                status = "stopped"
                lat, lon = lat1, lon1
            elif t_depart <= t_now and t_next_arrive:
                # 이동 중
                total_time = (t_next_arrive - t_depart).total_seconds()
                passed_time = (t_now - t_depart).total_seconds()
                progress = max(0, min(1, passed_time / total_time))
                status = "moving"
                lat = lat1 + (lat2 - lat1) * progress
                lon = lon1 + (lon2 - lon1) * progress
            elif pd.isna(row['NEXT_ARRIVETIME']):
                # 종착역
                lat, lon = lat1, lon1
                progress = 0
                status = "terminal"
            else:
                continue

            active_trains.append({
                'train_no': train_no,
                'line': line,
                'from': from_station,
                'to': to_station if pd.notna(to_station) else from_station,
                'progress': progress,
                'status': status,
                'lat': lat,
                'lon': lon
            })
        except:
            continue

    return jsonify(active_trains)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)
