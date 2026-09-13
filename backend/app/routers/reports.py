import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from fpdf import FPDF
from app.database import get_db
from app.models.hotspot import ActiveHotspot
from app.models.refinery import Refinery
from app.ml.classifier import classifier_service
from app.services.scoring import calculate_unified_hazard_score, get_severity_label

router = APIRouter(prefix="/api/reports", tags=["Forensic Reports"])

class IncidentPDF(FPDF):
    def header(self):
        # Header banner
        self.set_fill_color(24, 32, 47)  # Dark Navy
        self.rect(0, 0, 210, 26, "F")
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 6)
        self.cell(0, 8, "GEO-SCD | NTRO FORENSIC INCIDENT AUDIT DOSSIER", 0, 1, "L")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(200, 210, 230)
        self.set_xy(10, 14)
        self.cell(0, 6, "AI-Driven Geospatial Thermal Anomaly & Fire Classification System (PS 26162)", 0, 1, "L")
        self.ln(10)

    def footer(self):
        self.set_y(-18)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(130, 140, 150)
        self.cell(0, 8, f"CONFIDENTIAL & OFFICIAL DISASTER REPORT -- Page {self.page_no()}/{{nb}} -- Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", 0, 0, "C")

@router.get("/incident/{hotspot_id}/pdf")
def generate_incident_pdf(hotspot_id: int, db: Session = Depends(get_db)):
    """
    Generates a forensic, print-ready, audit-compliant PDF dossier of a critical incident.
    Contains coordinate telemetry, satellite metrics, suppression diagnostics,
    explainability breakdown, and recommended SOP action plans.
    """
    hotspot = db.query(ActiveHotspot).filter(ActiveHotspot.id == hotspot_id).first()
    if not hotspot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotspot not found")

    refinery = None
    if hotspot.nearest_refinery_id:
        refinery = db.query(Refinery).filter(Refinery.id == hotspot.nearest_refinery_id).first()

    ref_name = refinery.name if refinery else "N/A (Wildfire/Open Area)"
    ref_op = refinery.operator if refinery else "N/A"

    score = calculate_unified_hazard_score(
        classification=hotspot.classification,
        frp=hotspot.frp or 0.0,
        distance_to_refinery_m=hotspot.distance_to_refinery_m or 999999.0,
        distance_to_population_m=hotspot.distance_to_population_m or 999999.0,
        anomaly_score=hotspot.anomaly_score or 0.0,
        is_suppressed=bool(hotspot.is_suppressed)
    )
    sev_label = get_severity_label(score)

    # Dynamic Explainability reasons
    reasons = classifier_service.generate_xai_explanations(
        classification=hotspot.classification,
        frp=hotspot.frp,
        distance_to_refinery_m=hotspot.distance_to_refinery_m,
        distance_to_population_m=hotspot.distance_to_population_m,
        persistence_days=hotspot.persistence_days,
        ndvi=hotspot.ndvi,
        anomaly_score=hotspot.anomaly_score,
        refinery_name=ref_name
    )

    pdf = IncidentPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Incident Overview Title
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 8, f"INCIDENT DOSSIER: #{hotspot.id} -- {hotspot.classification.upper()}", 0, 1, "L")

    # Priority Score Banner
    if sev_label == "Critical":
        pdf.set_fill_color(239, 68, 68)  # Red
    elif sev_label == "High":
        pdf.set_fill_color(249, 115, 22) # Orange
    elif hotspot.is_suppressed:
        pdf.set_fill_color(16, 185, 129)  # Green
    else:
        pdf.set_fill_color(245, 158, 11)  # Amber

    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    status_text = f"HAZARD SCORE: {score}/100 ({sev_label.upper()})  |  STATUS: {hotspot.status.upper()}  |  SUPPRESSION: {'SUPPRESSED (NORMAL FLARE)' if hotspot.is_suppressed else 'UNSUPPRESSED (ACTIVE EVENT)'}"
    pdf.cell(0, 8, status_text, 0, 1, "C", fill=True)
    pdf.ln(5)


    # Section 1: Geospatial & Sensor Telemetry Table
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "1. Satellite Telemetry & Geospatial Coordinates", 0, 1, "L")

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)

    col_w1 = 45
    col_w2 = 50
    col_w3 = 45
    col_w4 = 50

    data_rows = [
        ("Latitude / Longitude:", f"{hotspot.latitude:.5f}° N, {hotspot.longitude:.5f}° E", "Detection Timestamp:", f"{hotspot.detected_at.strftime('%Y-%m-%d %H:%M:%S UTC')}"),
        ("Fire Radiative Power (FRP):", f"{hotspot.frp:.2f} MW", "Brightness Temperature:", f"{hotspot.brightness:.1f} K"),
        ("Sensor Detection Confidence:", f"{hotspot.confidence:.1f}%", "Sentinel-2 NDVI:", f"{hotspot.ndvi:.4f}" if hotspot.ndvi is not None else "Pending / Bypassed"),
        ("Persistence Index (30d):", f"{hotspot.persistence_days} Days Active", "Isolation Forest Anomaly:", f"{hotspot.anomaly_score:.3f}"),
        ("Nearest Industrial Facility:", f"{ref_name}", "Facility Operator:", f"{ref_op}"),
        ("Distance to Facility:", f"{int(hotspot.distance_to_refinery_m):,} m", "Distance to Population:", f"{int(hotspot.distance_to_population_m):,} m")
    ]

    for label1, val1, label2, val2 in data_rows:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_fill_color(241, 245, 249)
        pdf.cell(col_w1, 6, label1, 1, 0, "L", fill=True)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(col_w2, 6, val1, 1, 0, "L")

        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(col_w3, 6, label2, 1, 0, "L", fill=True)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(col_w4, 6, val2, 1, 1, "L")

    pdf.ln(5)

    # Section 2: AI Classification & Explainability Evidence
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "2. AI/ML Explainability & Forensic Attributions (XAI)", 0, 1, "L")

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.multi_cell(0, 5, f"Classification Model: RandomForestClassifier (Confidence: {hotspot.model_confidence * 100:.1f}%)")
    pdf.ln(2)

    for idx, reason in enumerate(reasons, 1):
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(8, 6, f"{idx}.", 0, 0, "R")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(0, 6, reason, 0, 1, "L")

    pdf.ln(5)

    # Section 3: Recommended Standard Operating Procedure (SOP) Action Plan
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "3. Recommended Disaster Response Action Protocol (SOP)", 0, 1, "L")

    sop_steps = []
    if hotspot.classification == "Potential Industrial Incident" or is_crit:
        sop_steps = [
            ("STEP 1 - IMMEDIATE ALARM:", "Trigger automated priority notification to National Disaster Management Authority (NDMA) & NTRO Command Deck."),
            ("STEP 2 - FACILITY SHUTDOWN:", f"Contact {ref_op} Emergency Operations Center ({ref_name}) to verify flare stack / process line pressure."),
            ("STEP 3 - PERIMETER ISOLATION:", f"Deploy rapid ground response teams to secure safety radius of {int(hotspot.distance_to_refinery_m + 1000):,} meters."),
            ("STEP 4 - RESIDENTIAL EVACUATION:", f"Assess wind direction towards settlement zone ({int(hotspot.distance_to_population_m):,} meters away) for toxic dispersion safeguards.")
        ]
    elif hotspot.is_suppressed:
        sop_steps = [
            ("STEP 1 - OPERATIONAL VERIFICATION:", "Log event in automated suppression ledger as normal flaring baseline."),
            ("STEP 2 - TELEMETRY WATCH:", "Continue automated 24-hour satellite observation for unexpected FRP expansion (>300%)."),
            ("STEP 3 - NO ESCALATION:", "No civic or emergency dispatch required.")
        ]
    else:
        sop_steps = [
            ("STEP 1 - FOREST/RURAL DISPATCH:", "Notify State Forest Department and local fire stations of active biomass/wildfire."),
            ("STEP 2 - CONTAINMENT BUFFER:", "Establish natural firebreak lines to prevent advance toward industrial infrastructure.")
        ]

    for step_title, step_desc in sop_steps:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(185, 28, 28) if is_crit else pdf.set_text_color(30, 41, 59)
        pdf.cell(50, 6, step_title, 0, 0, "L")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(0, 6, step_desc, 0, 1, "L")

    # Output PDF byte buffer
    pdf_bytes = pdf.output()
    filename = f"incident_report_{hotspot.id}_{hotspot.detected_at.strftime('%Y%m%d')}.pdf"

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
