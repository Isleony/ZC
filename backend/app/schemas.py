from datetime import datetime
from typing import Literal

from pydantic import BaseModel


IncidentType = Literal["tiroteio", "roubo", "homicidio", "furto", "violencia_domestica"]


class IncidentOut(BaseModel):
    id: int
    title: str
    incident_type: IncidentType
    occurred_at: datetime
    source: str
    confidence: float
    status: str
    region: str
    lat: float
    lng: float


class RiskZoneOut(BaseModel):
    region: str
    total_incidents: int
    weighted_risk: float
    latest_incident: datetime


class HeatPointOut(BaseModel):
    lat: float
    lng: float
    weight: float
