from flask import Flask, render_template, jsonify
import pandas as pd
import os

app = Flask(__name__)

# 전처리된 시간표 데이터 불러오기
data_path = os.path.join("data", "preprocessed_timetable.csv")
df_timetable = pd.read_csv(data_path, encoding="utf-8-sig")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/timetable")
def timetable():
    return jsonify(df_timetable.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True)
