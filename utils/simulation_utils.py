import datetime


def parse_time_to_seconds(time_str):
    """
    'HH:MM:SS' 형식의 문자열을 초 단위(int)로 변환
    """
    try:
        h, m, s = map(int, time_str.split(":"))
        return h * 3600 + m * 60 + s
    except:
        return None


def seconds_to_timestr(seconds):
    """
    초 단위(int)를 'HH:MM:SS' 형식 문자열로 변환
    """
    return str(datetime.timedelta(seconds=seconds))


def interpolate_position(start_pos, end_pos, progress):
    """
    progress(0~1)에 따라 두 좌표 사이를 선형 보간하여 현재 위치 반환
    start_pos, end_pos: (위도, 경도)
    progress: 0 ~ 1 사이 부동소수점
    """
    lat = start_pos[0] + (end_pos[0] - start_pos[0]) * progress
    lon = start_pos[1] + (end_pos[1] - start_pos[1]) * progress
    return lat, lon


def is_between(now, start, end):
    """
    현재 시간이 start ~ end 사이인지 확인 (모두 초 단위 int)
    """
    return start <= now <= end
