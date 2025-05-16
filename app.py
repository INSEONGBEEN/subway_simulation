from flask import Flask, render_template, jsonify
import pandas as pd
import os
import json

app = Flask(__name__)

# 📂 경로 설정
station_path = os.path.join("data", "station.csv")
line_path = os.path.join("data", "line_orders.json")
timetable_path = os.path.join("data", "preprocessed_timetable.csv")

# 📄 데이터 불러오기
df_station = pd.read_csv(station_path, encoding="cp949")
df_timetable = pd.read_csv(timetable_path, encoding="utf-8-sig")
with open(line_path, encoding="utf-8") as f:
    line_orders = json.load(f)

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

if __name__ == "__main__":
    app.run(debug=True)
