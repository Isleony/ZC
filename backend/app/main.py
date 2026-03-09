import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .sample_data import INCIDENTS
from .schemas import HeatPointOut, IncidentOut, RiskZoneOut

app = FastAPI(title="Crime Radar API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _filter_incidents(hours: int, types: Optional[List[str]] = None) -> list[dict]:
    min_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    filtered = [item for item in INCIDENTS if item["occurred_at"] >= min_time]
    if types:
        type_set = set(types)
        filtered = [item for item in filtered if item["incident_type"] in type_set]
    return sorted(filtered, key=lambda x: x["occurred_at"], reverse=True)


def _to_incident_out(item: dict) -> IncidentOut:
    return IncidentOut(
        id=item["id"],
        title=item["title"],
        incident_type=item["incident_type"],
        occurred_at=item["occurred_at"],
        source=item["source"],
        confidence=item["confidence"],
        status=item["status"],
        region=item["region"],
        lat=item["lat"],
        lng=item["lng"],
    )


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "local-sample-data"}


@app.get("/incidents", response_model=List[IncidentOut])
def list_incidents(
    hours: int = Query(default=168, ge=1, le=24 * 90),
    types: Optional[List[str]] = Query(default=None),
) -> List[IncidentOut]:
    items = _filter_incidents(hours=hours, types=types)[:1000]
    return [_to_incident_out(item) for item in items]


@app.get("/risk-zones", response_model=List[RiskZoneOut])
def risk_zones(
    hours: int = Query(default=168, ge=1, le=24 * 90),
    limit: int = Query(default=10, ge=1, le=50),
) -> List[RiskZoneOut]:
    items = _filter_incidents(hours=hours)

    agg: dict[str, dict] = {}
    for item in items:
        region = item["region"]
        bucket = agg.setdefault(
            region,
            {
                "total_incidents": 0,
                "weighted_risk": 0.0,
                "latest_incident": item["occurred_at"],
            },
        )
        bucket["total_incidents"] += 1
        bucket["weighted_risk"] += item["confidence"] * item["severity_weight"]
        if item["occurred_at"] > bucket["latest_incident"]:
            bucket["latest_incident"] = item["occurred_at"]

    rows = sorted(agg.items(), key=lambda kv: kv[1]["weighted_risk"], reverse=True)[:limit]
    return [
        RiskZoneOut(
            region=region,
            total_incidents=data["total_incidents"],
            weighted_risk=round(data["weighted_risk"], 2),
            latest_incident=data["latest_incident"],
        )
        for region, data in rows
    ]


@app.get("/heatmap", response_model=List[HeatPointOut])
def heatmap(hours: int = Query(default=168, ge=1, le=24 * 90)) -> List[HeatPointOut]:
    items = _filter_incidents(hours=hours)
    return [
        HeatPointOut(
            lat=item["lat"],
            lng=item["lng"],
            weight=round(item["confidence"] * item["severity_weight"], 2),
        )
        for item in items
    ]


@app.get("/alerts/check", response_model=List[IncidentOut])
def check_alert(
    lat: float,
    lng: float,
    radius_km: float = Query(default=2.0, ge=0.1, le=30),
    hours: int = Query(default=24, ge=1, le=24 * 30),
) -> List[IncidentOut]:
    items = _filter_incidents(hours=hours)
    hits = [
        item
        for item in items
        if _haversine_km(lat, lng, item["lat"], item["lng"]) <= radius_km
    ]
    return [_to_incident_out(item) for item in hits]
