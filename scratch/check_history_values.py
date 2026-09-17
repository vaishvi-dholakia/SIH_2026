import os
import sys

sys.path.insert(0, r"c:\Users\LENOVO\OneDrive\Documents\GitHub\SIH_2026\backend")

from app.db.session import SessionLocal
from app.routers.incidents import get_incidents, get_incident_history

db = SessionLocal()
incidents = get_incidents(db=db)
print(f"Total incidents: {len(incidents)}")

for inc in incidents[:5]:
    hist = get_incident_history(inc["id"], db=db)
    print(f"\nFacility: {inc['nearestFacility']} | ID: {inc['id']} | Current FRP: {inc['frp']} MW | Normal FRP: {inc['normalFrp']} MW")
    frps = [d["frp"] for d in hist["dailyHistory"]]
    print(f"Daily FRPs (30 days): {frps}")
