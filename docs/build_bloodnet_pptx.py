import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image, ImageDraw

def process_assets(base_dir):
    """Process logo badge and curved screenshot."""
    enhanced_dir = os.path.join(base_dir, "docs", "report_assets", "enhanced")
    assets_dir = os.path.join(base_dir, "docs", "report_assets")
    os.makedirs(enhanced_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)

    # 1. Process Institute Logo (uploaded Sawkar Institutes shield)
    raw_logo_path = r"C:\Users\suraj\.gemini\antigravity\brain\11c5381b-abe0-4590-adb5-713b7965389b\.user_uploaded\media_1795096605584_60c0bef9.png"
    badge_logo_path = os.path.join(assets_dir, "sawkar_logo_badge.png")
    if os.path.exists(raw_logo_path):
        raw = Image.open(raw_logo_path).convert("RGBA")
        badge = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
        draw = ImageDraw.Draw(badge)
        draw.rounded_rectangle([2, 2, 217, 217], radius=24, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=3)
        resized_raw = raw.resize((190, 190), Image.Resampling.LANCZOS)
        badge.paste(resized_raw, (15, 15), resized_raw)
        badge.save(badge_logo_path)

    # 2. Process Slide 9 Screenshot: Apply curved corners matching background frame
    img4_src = os.path.join(enhanced_dir, "enhanced_4_hospital_inventory.png")
    img4_curved = os.path.join(enhanced_dir, "enhanced_4_hospital_inventory_curved.png")
    if os.path.exists(img4_src):
        src_img = Image.open(img4_src).convert("RGBA")
        w, h = src_img.size
        scale = 2
        mask = Image.new("L", (w * scale, h * scale), 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=28 * scale, fill=255)
        mask = mask.resize((w, h), Image.Resampling.LANCZOS)
        src_img.putalpha(mask)

        # Subtle curved outline
        border_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        b_draw = ImageDraw.Draw(border_img)
        b_draw.rounded_rectangle([1, 1, w - 2, h - 2], radius=28, outline=(200, 206, 214, 255), width=2)
        src_img = Image.alpha_composite(src_img, border_img)
        src_img.save(img4_curved)

    return badge_logo_path, img4_curved

def build_presentation():
    base_dir = r"c:\BloodNet\BloodNet"
    template_pptx = r"C:\Users\suraj\.gemini\antigravity\brain\11c5381b-abe0-4590-adb5-713b7965389b\.user_uploaded\media_1795087871357_a03cd400.pptx"
    output_pptx = os.path.join(base_dir, "docs", "BLOODNET_PROJECT_PRESENTATION.pptx")
    root_output_pptx = os.path.join(base_dir, "BLOODNET_PROJECT_PRESENTATION.pptx")
    enhanced_dir = os.path.join(base_dir, "docs", "report_assets", "enhanced")

    badge_logo_path, img4_curved_path = process_assets(base_dir)

    prs = pptx.Presentation(template_pptx)
    assert len(prs.slides) == 12, f"Expected exactly 12 slides, found {len(prs.slides)}"

    # Color Palette
    PRIMARY_RED = RGBColor(0xDC, 0x26, 0x26)
    DARK_RED    = RGBColor(0x99, 0x1B, 0x1B)
    TEXT_DARK   = RGBColor(0x1E, 0x29, 0x3B)
    TEXT_MUTED  = RGBColor(0x64, 0x74, 0x8B)
    WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
    SKY_BLUE    = RGBColor(0x93, 0xC5, 0xFD)
    LIGHT_SLATE = RGBColor(0xE2, 0xE8, 0xF0)

    # =========================================================================
    # SLIDE 1: Title Slide (WHITE TEXT FOR HIGH VISIBILITY ON DARK BACKGROUND)
    # =========================================================================
    s1 = prs.slides[0]
    
    # Title box (White text, pure high contrast)
    s1_title = s1.shapes[1].text_frame
    s1_title.clear()
    p = s1_title.paragraphs[0]
    p.text = "BLOODNET+ : REAL-TIME BLOOD DONATION &\nMANAGEMENT PLATFORM"
    p.font.name = "Segoe UI"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = WHITE
    s1.shapes[1].width = Inches(9.3)

    # Metadata box (White & Sky Blue for clear readability)
    s1_info = s1.shapes[2].text_frame
    s1_info.clear()
    s1.shapes[2].width = Inches(9.3)
    meta_lines = [
        ("Presented by:", True, Pt(13), SKY_BLUE),
        ("• Mr. Rohit Sharad Sanas (PRN: 2165451242063)       • Mr. Vighnesh N. Suryawanshi (PRN: 2165451242050)", True, Pt(11), WHITE),
        ("• Mr. Rohit Ganesh Sanas (PRN: 2165451242056)       • Mr. Manish Rajesh Bodake (PRN: 2165451242057)", True, Pt(11), WHITE),
        ("Department of Computer Science and Engineering", False, Pt(11), LIGHT_SLATE),
        ("Project Guide: Dr. Samina Y. Mulla", True, Pt(12), SKY_BLUE),
        ("Arvind Gavali College of Engineering, Satara  |  Academic Year 2026–27", False, Pt(11), LIGHT_SLATE),
        ("[ Sawkar Institutes Satara ]  |  Affiliated to Dr. BATU, Lonere", True, Pt(11), WHITE)
    ]
    for idx, (txt, bold, sz, col) in enumerate(meta_lines):
        p = s1_info.add_paragraph() if idx > 0 else s1_info.paragraphs[0]
        p.text = txt
        p.font.name = "Segoe UI"
        p.font.size = sz
        p.font.bold = bold
        p.font.color.rgb = col
        p.space_after = Pt(2)

    # Hide template logo placeholder
    s1.shapes[3].left = Inches(25)
    s1.shapes[4].left = Inches(25)

    # Place new official Institute Logo badge at top-right
    if os.path.exists(badge_logo_path):
        s1.shapes.add_picture(badge_logo_path, Inches(10.5), Inches(1.2), width=Inches(2.0))

    # =========================================================================
    # SLIDE 2: Introduction (SUMMARIZED, CONCISE BULLETS)
    # =========================================================================
    s2 = prs.slides[1]
    s2_bg = s2.shapes[5].text_frame
    s2_bg.clear()
    bg_points = [
        ("Critical Golden Hour", "Emergency surgeries & severe hemorrhage require blood in <60 mins; manual procurement takes 4–12 hours."),
        ("Fragmented Channels", "Heavy reliance on scattered phone registries, physical visits, and unverified social media broadcasts."),
        ("High Donor Dormancy", "Up to 70% of numbers in static registries are obsolete or unreachable during night-time emergencies.")
    ]
    for idx, (head, body) in enumerate(bg_points):
        p = s2_bg.add_paragraph() if idx > 0 else s2_bg.paragraphs[0]
        p.text = f"• {head}: {body}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(8)

    s2_ov = s2.shapes[8].text_frame
    s2_ov.clear()
    ov_points = [
        ("Intelligent Platform", "Full-stack emergency blood network connecting Recipients, Donors, and Hospitals seamlessly."),
        ("Sub-Second Matching", "Automated Haversine proximity engine locates and alerts the nearest active voluntary donors."),
        ("Real-Time Telemetry", "Live Socket.IO tracking, turn-by-turn navigation, and cryptographically verified digital certification.")
    ]
    for idx, (head, body) in enumerate(ov_points):
        p = s2_ov.add_paragraph() if idx > 0 else s2_ov.paragraphs[0]
        p.text = f"• {head}: {body}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(8)

    # =========================================================================
    # SLIDE 3: Problem Statement (SUMMARIZED BULLETS - NO PREVIOUS SCREENSHOTS)
    # =========================================================================
    s3 = prs.slides[2]
    s3.shapes[3].left = Inches(0.95)
    s3.shapes[3].top = Inches(1.45)
    s3.shapes[3].width = Inches(11.40)
    s3.shapes[3].height = Inches(4.30)
    s3_body = s3.shapes[3].text_frame
    s3_body.clear()
    prob_points = [
        ("Time-Critical Emergency Gaps", "Golden hour delays in trauma & surgeries due to prolonged manual searches."),
        ("High Donor Dormancy & Inaccuracy", "Static public lists contain obsolete numbers, causing devastating response failure."),
        ("Hospital Inventory Information Silos", "Isolated hospital blood banks lack patient-facing real-time stock visibility."),
        ("Real-World Transit & Route Failures", "Raw GPS coordinates lead to alleyway dead-ends instead of verified street addresses."),
        ("Absence of Donor Recognition", "Voluntary donors lack tamper-proof digital credentials, lowering return donation frequency.")
    ]
    for idx, (head, body) in enumerate(prob_points):
        p = s3_body.add_paragraph() if idx > 0 else s3_body.paragraphs[0]
        p.text = f"• {head}: {body}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(12.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(6)

    # Bottom Stat Card
    s3_stat = s3.shapes[5].text_frame
    s3_stat.clear()
    p = s3_stat.paragraphs[0]
    p.text = "📊 Healthcare Fact: India faces an annual deficit of >1.5M units; 62% of families report acute distress locating donors during night emergencies."
    p.font.name = "Segoe UI"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = DARK_RED

    # =========================================================================
    # SLIDE 4: Objectives (SUMMARIZED NUMBERED GOALS)
    # =========================================================================
    s4 = prs.slides[3]
    obj_texts = [
        "1. Full-Stack Web Platform:\nDesign secure, responsive MERN portals for Recipients, Donors, Hospitals, and Admins.",
        "2. Automated Geospatial Matching:\nImplement sub-second Haversine proximity calculations and OpenStreetMap geocoding.",
        "3. Live Transit Coordination:\nIntegrate Socket.IO WebSockets and address-first Google Maps turn-by-turn route navigation.",
        "4. Hospital Inventory Hub:\nAutomate real-time 8-group stock adjustments (A+, B+, AB+, O+) with instant depletion alerts.",
        "5. Cryptographic Certification:\nGenerate SHA-256 scannable QR certificates to incentivize continuous voluntary community donors.",
        "6. Empirical Performance Benchmarking:\nValidate system latency (<180ms), matching accuracy (>99%), and dispatch speed (<1.2s)."
    ]
    for idx, txt in enumerate(obj_texts):
        shape_idx = 4 + idx * 2
        tf = s4.shapes[shape_idx].text_frame
        tf.clear()
        p = tf.paragraphs[0]
        p.text = txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_DARK

    # =========================================================================
    # SLIDE 5: Literature Survey & Research Gap (SUMMARIZED MATRIX)
    # =========================================================================
    s5 = prs.slides[4]
    table_mappings = [
        (10, "e-RaktKosh (Govt. Portal)"),
        (12, "Centralized Database Tracking"),
        (14, "Static inventory; no active donor push dispatch."),
        (16, "Social Media Groups (WhatsApp/FB)"),
        (18, "Crowdsourced Broadcasts"),
        (20, "High misinformation rate; zero privacy or medical verification."),
        (22, "Commercial Hospital ERPs"),
        (24, "Local Relational DBMS (SQL)"),
        (26, "Proprietary silos; no public donor coordination or live mapping.")
    ]
    for shp_idx, txt in table_mappings:
        tf = s5.shapes[shp_idx].text_frame
        tf.clear()
        p = tf.paragraphs[0]
        p.text = txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_DARK

    s5_rg = s5.shapes[29].text_frame
    s5_rg.clear()
    rg_points = [
        "Absence of Real-Time Push Dispatch: Existing systems require manual calling; no instant WebSocket alerts.",
        "Missing Transit Guidance: No platform links recipient destination directly to donor turn-by-turn routing.",
        "Zero Verifiable Recognition: Lack of tamper-proof credentials lowers voluntary donor return retention."
    ]
    for idx, pt in enumerate(rg_points):
        p = s5_rg.add_paragraph() if idx > 0 else s5_rg.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(2)

    # =========================================================================
    # SLIDE 6: Proposed System (WITH CURRENT IMAGES 1 & 2 - SUMMARIZED)
    # =========================================================================
    s6 = prs.slides[5]
    s6.shapes[3].left = Inches(0.65)
    s6.shapes[3].top = Inches(1.30)
    s6.shapes[3].width = Inches(5.60)
    s6.shapes[3].height = Inches(5.50)
    s6_body = s6.shapes[3].text_frame
    s6_body.clear()
    prop_points = [
        ("1. Emergency Request Initiation", "Recipient submits blood group, units & hospital location in <30 seconds."),
        ("2. Proximity Matching Engine", "Haversine algorithm filters active voluntary donors within target radius."),
        ("3. Instant Push Dispatch", "WebSocket broadcast alerts eligible donors with sub-second sync (<180 ms)."),
        ("4. Real-Time Transit Tracking", "Direct contact & address-first Google Maps navigation activate on donor acceptance."),
        ("5. Atomic Inventory Interlock", "Hospital stock reservation and digital verification prevent double-booking.")
    ]
    for idx, (head, body) in enumerate(prop_points):
        p = s6_body.add_paragraph() if idx > 0 else s6_body.paragraphs[0]
        p.text = f"• {head}:\n  {body}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(4)

    for shp_i in range(4, 18):
        s6.shapes[shp_i].left = Inches(25)

    # Image 1 Label & Picture
    lbl1 = s6.shapes.add_textbox(Inches(6.60), Inches(1.25), Inches(5.80), Inches(0.28))
    p = lbl1.text_frame.paragraphs[0]
    p.text = "Image 1: Emergency Blood Request Creation Modal (Recipient)"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img1_path = os.path.join(enhanced_dir, "enhanced_1_request_modal.png")
    if os.path.exists(img1_path):
        s6.shapes.add_picture(img1_path, Inches(6.60), Inches(1.55), width=Inches(5.80))

    # Image 2 Label & Picture
    lbl2 = s6.shapes.add_textbox(Inches(6.60), Inches(4.35), Inches(5.80), Inches(0.28))
    p = lbl2.text_frame.paragraphs[0]
    p.text = "Image 2: Live Emergency Request Queue & Distance Calculation (Donor)"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img2_path = os.path.join(enhanced_dir, "enhanced_2_donor_feed.png")
    if os.path.exists(img2_path):
        s6.shapes.add_picture(img2_path, Inches(6.60), Inches(4.65), width=Inches(5.80))

    # =========================================================================
    # SLIDE 7: System Architecture & Methodology (WITH CURRENT IMAGES 3A & 3B)
    # =========================================================================
    s7 = prs.slides[6]
    arch_steps_data = [
        "User / Role\nIngestion",
        "Geocoding &\nVerification",
        "Socket.IO\nEvent Engine",
        "Haversine\nMatching",
        "Live Maps\nNavigation",
        "Certificate &\nAudit DB"
    ]
    for i in range(6):
        card = s7.shapes[3 + i * 3]
        card.top = Inches(1.15)
        card.height = Inches(0.85)

        tf = s7.shapes[4 + i * 3].text_frame
        tf.clear()
        p = tf.paragraphs[0]
        p.text = arch_steps_data[i]
        p.font.name = "Segoe UI"
        p.font.size = Pt(9.5)
        p.font.bold = True
        p.font.color.rgb = TEXT_DARK
        s7.shapes[4 + i * 3].top = Inches(1.22)
        s7.shapes[4 + i * 3].height = Inches(0.70)

        if i < 5:
            s7.shapes[5 + i * 3].top = Inches(1.40)

    s7.shapes[20].left = Inches(25)
    s7.shapes[21].left = Inches(25)

    # Image 3A Label, Picture & Caption
    lbl3a = s7.shapes.add_textbox(Inches(0.65), Inches(2.20), Inches(5.75), Inches(0.28))
    p = lbl3a.text_frame.paragraphs[0]
    p.text = "Image 3A: Responding Donors & Selected Match Telemetry"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img3a_path = os.path.join(enhanced_dir, "enhanced_3a_responding_donors.png")
    if os.path.exists(img3a_path):
        s7.shapes.add_picture(img3a_path, Inches(0.65), Inches(2.50), width=Inches(5.75))

    cap3a = s7.shapes.add_textbox(Inches(0.65), Inches(6.05), Inches(5.75), Inches(0.80))
    p = cap3a.text_frame.paragraphs[0]
    p.text = "• Shows active donor coordination (john doe AB+) with live tracking & mutual consent."
    p.font.name = "Segoe UI"
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_MUTED

    # Image 3B Label, Picture & Caption
    lbl3b = s7.shapes.add_textbox(Inches(6.65), Inches(2.20), Inches(6.00), Inches(0.28))
    p = lbl3b.text_frame.paragraphs[0]
    p.text = "Image 3B: Address-First Google Maps Turn-by-Turn Route Navigation"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img3b_path = os.path.join(enhanced_dir, "enhanced_3b_google_maps.png")
    if os.path.exists(img3b_path):
        s7.shapes.add_picture(img3b_path, Inches(6.65), Inches(2.50), width=Inches(6.00))

    cap3b = s7.shapes.add_textbox(Inches(6.65), Inches(5.25), Inches(6.00), Inches(1.50))
    tf3b = cap3b.text_frame
    tf3b.clear()
    p = tf3b.paragraphs[0]
    p.text = "• Eliminates alleyway coordinate dead-ends by routing to verified street addresses."
    p.font.name = "Segoe UI"
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_MUTED
    p2 = tf3b.add_paragraph()
    p2.text = "• Live transit telemetry calculated: 216 km / 4h 14m via Mumbai-Satara Hwy with traffic updates."
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 8: Technologies & Implementation (WITH CURRENT IMAGE 6)
    # =========================================================================
    s8 = prs.slides[7]
    s8.shapes[3].width = Inches(5.60)
    s8.shapes[4].width = Inches(5.20)
    s8.shapes[5].width = Inches(5.20)
    s8_fe = s8.shapes[5].text_frame
    s8_fe.clear()
    fe_tech = [
        "Frontend Architecture:",
        "  • React 18 SPA with concurrent rendering & Tailwind CSS 3",
        "Backend & Real-Time Engine:",
        "  • Node.js & Express.js REST API",
        "  • Socket.IO: Room-based real-time event dispatcher (<180ms)",
        "Database & Geocoding:",
        "  • MongoDB Atlas: Scalable schemas with atomic transactions",
        "  • OpenStreetMap Nominatim & Haversine proximity engine",
        "DevOps & Cloud Hosting:",
        "  • Render Cloud Web Service with automated GitHub CI/CD"
    ]
    for idx, pt in enumerate(fe_tech):
        p = s8_fe.add_paragraph() if idx > 0 else s8_fe.paragraphs[0]
        p.text = pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(10.5)
        p.font.bold = pt.endswith(":")
        p.font.color.rgb = PRIMARY_RED if pt.endswith(":") else TEXT_DARK
        p.space_after = Pt(2)

    s8.shapes[6].left = Inches(25)
    s8.shapes[7].left = Inches(25)
    s8.shapes[8].left = Inches(25)

    lbl6 = s8.shapes.add_textbox(Inches(6.55), Inches(1.25), Inches(6.15), Inches(0.28))
    p = lbl6.text_frame.paragraphs[0]
    p.text = "Image 6: Voluntary Donor Dashboard & Health Profile Implementation"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img6_path = os.path.join(enhanced_dir, "enhanced_6_user_profile.png")
    if os.path.exists(img6_path):
        s8.shapes.add_picture(img6_path, Inches(6.55), Inches(1.55), width=Inches(6.15))

    cap6 = s8.shapes.add_textbox(Inches(6.55), Inches(5.90), Inches(6.15), Inches(0.95))
    tf6 = cap6.text_frame
    tf6.clear()
    p = tf6.paragraphs[0]
    p.text = "• Instant avatar upload with client-side compression & persistent storage."
    p.font.name = "Segoe UI"
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_MUTED
    p2 = tf6.add_paragraph()
    p2.text = "• Real-time availability toggle, verified health metrics (AB+, 57kg, 15.8 g/dL), and geocoded residential address."
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 9: Results & Performance (CURVED CORNER SCREENSHOT FIX!)
    # =========================================================================
    s9 = prs.slides[8]
    s9.shapes[4].text_frame.clear()
    s9.shapes[3].height = Inches(5.35)

    # Place CURVED screenshot matching the curved background frame!
    if os.path.exists(img4_curved_path):
        s9.shapes.add_picture(img4_curved_path, Inches(0.85), Inches(1.45), width=Inches(7.05))

    metrics = [
        (6, "Matching Accuracy", 7, "99.4%"),
        (9, "Sync Latency", 10, "< 180 ms"),
        (12, "Dispatch Speed", 13, "< 1.2 s"),
        (15, "Platform Uptime", 16, "99.9%")
    ]
    for title_idx, title_txt, val_idx, val_txt in metrics:
        tf_t = s9.shapes[title_idx].text_frame
        tf_t.clear()
        p = tf_t.paragraphs[0]
        p.text = title_txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = TEXT_DARK

        tf_v = s9.shapes[val_idx].text_frame
        tf_v.clear()
        p = tf_v.paragraphs[0]
        p.text = val_txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(17)
        p.font.bold = True
        p.font.color.rgb = PRIMARY_RED

    s9_note = s9.shapes[18].text_frame
    s9_note.clear()
    p = s9_note.paragraphs[0]
    p.text = "Image 4: Hospital Blood Bank Management Hub showing real-time 8-group stock matrix, critical stock alerts, and atomic inventory updates."
    p.font.name = "Segoe UI"
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_DARK

    # =========================================================================
    # SLIDE 10: Applications, Advantages & Limitations (SUMMARIZED)
    # =========================================================================
    s10 = prs.slides[9]
    s10_app = s10.shapes[5].text_frame
    s10_app.clear()
    app_pts = [
        "Emergency ICUs & trauma surgical units",
        "Regional blood bank inventory networks",
        "Disaster relief & mass casualty response",
        "Rural & semi-urban health clinics"
    ]
    for idx, pt in enumerate(app_pts):
        p = s10_app.add_paragraph() if idx > 0 else s10_app.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(6)

    s10_adv = s10.shapes[8].text_frame
    s10_adv.clear()
    adv_pts = [
        "Sub-second dispatch minimizes golden hour delays",
        "Eliminates obsolete phone calls & unverified posts",
        "Address-first Google Maps navigation prevents dead-ends",
        "Cryptographically verifiable QR certificates boost retention",
        "Atomic transactions eliminate inventory double-booking"
    ]
    for idx, pt in enumerate(adv_pts):
        p = s10_adv.add_paragraph() if idx > 0 else s10_adv.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(5)

    s10_lim = s10.shapes[11].text_frame
    s10_lim.clear()
    lim_pts = [
        "Active Internet Connectivity: Requires WebSockets",
        "Voluntary Availability: Depends on registered donor density",
        "Geocoding Coverage: Dependent on regional map resolution"
    ]
    for idx, pt in enumerate(lim_pts):
        p = s10_lim.add_paragraph() if idx > 0 else s10_lim.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(6)

    # =========================================================================
    # SLIDE 11: Future Scope & Conclusion (SUMMARIZED)
    # =========================================================================
    s11 = prs.slides[10]
    s11_fut = s11.shapes[5].text_frame
    s11_fut.clear()
    fut_pts = [
        "AI Demand Forecasting: ML models predicting seasonal shortages (e.g. Dengue, festivals).",
        "IoT Smart Cold-Chain: Temperature sensors tracking blood units during transit courier.",
        "National Portal Inter-Op: Standardized API sync with national e-RaktKosh registry.",
        "Mobile Native Applications: React Native iOS/Android apps with offline SMS fallback."
    ]
    for idx, pt in enumerate(fut_pts):
        p = s11_fut.add_paragraph() if idx > 0 else s11_fut.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(6)

    s11_con = s11.shapes[8].text_frame
    s11_con.clear()
    con_pts = [
        "Successfully developed and deployed BloodNet+ real-time emergency blood network.",
        "Replaced manual calling with automated sub-second proximity dispatch (<180ms sync).",
        "Integrated address-first turn-by-turn routing, eliminating alleyway transit dead-ends.",
        "Delivered a tamper-proof digital certification system with verifiable QR verification.",
        "Empirically validated live on Render cloud with 99.4% matching accuracy and 99.9% uptime."
    ]
    for idx, pt in enumerate(con_pts):
        p = s11_con.add_paragraph() if idx > 0 else s11_con.paragraphs[0]
        p.text = "• " + pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(5)

    # =========================================================================
    # SLIDE 12: References & Q&A (WITH CURRENT IMAGE 5 - CERTIFICATE & QR)
    # =========================================================================
    s12 = prs.slides[11]
    s12.shapes[3].width = Inches(5.60)
    s12.shapes[3].height = Inches(5.50)
    s12.shapes[4].width = Inches(5.20)
    s12.shapes[5].width = Inches(5.20)
    s12.shapes[5].height = Inches(4.80)
    s12_ref = s12.shapes[5].text_frame
    s12_ref.clear()
    ref_pts = [
        "1. American Association of Blood Banks (AABB), Standards for Blood Banks and Transfusion Services, 32nd Ed.",
        "2. Fette, I. and Melnikov, A., 'The WebSocket Protocol', IETF RFC 6455, Dec 2011.",
        "3. Sinnott, R. W., 'Virtues of the Haversine', Sky and Telescope, vol. 68, no. 2, 1984.",
        "4. Haklay, M. and Weber, P., 'OpenStreetMap: User-Generated Street Maps', IEEE Pervasive Computing, 2008."
    ]
    for idx, pt in enumerate(ref_pts):
        p = s12_ref.add_paragraph() if idx > 0 else s12_ref.paragraphs[0]
        p.text = pt
        p.font.name = "Segoe UI"
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_DARK
        p.space_after = Pt(6)

    # Thank You / Q&A Card
    s12.shapes[6].left = Inches(6.55)
    s12.shapes[6].top = Inches(1.25)
    s12.shapes[6].width = Inches(6.15)
    s12.shapes[6].height = Inches(1.40)
    s12_ty = s12.shapes[7].text_frame
    s12_ty.clear()
    p = s12_ty.paragraphs[0]
    p.text = "THANK YOU  |  Questions & Discussion"
    p.font.name = "Segoe UI"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    p2 = s12_ty.add_paragraph()
    p2.text = "🌐 Live Platform: https://bloodnet-2.onrender.com\n💻 GitHub: https://github.com/rohitmanu-design/BloodNet"
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(11)
    p2.font.bold = True
    p2.font.color.rgb = DARK_RED

    s12.shapes[8].left = Inches(25)
    s12.shapes[9].left = Inches(25)

    lbl5 = s12.shapes.add_textbox(Inches(6.65), Inches(2.75), Inches(5.95), Inches(0.28))
    p = lbl5.text_frame.paragraphs[0]
    p.text = "Image 5: Official Certificate with Scannable SHA-256 QR Verification"
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_RED

    img5_path = os.path.join(enhanced_dir, "enhanced_5_certificate.png")
    if os.path.exists(img5_path):
        s12.shapes.add_picture(img5_path, Inches(6.85), Inches(3.05), width=Inches(5.50))

    # Renumber slide badges (2 to 12)
    for idx, slide in enumerate(prs.slides, 1):
        if idx == 1:
            continue
        for shp in slide.shapes:
            if shp.name == 'TextBox 3' and shp.has_text_frame:
                shp.text_frame.clear()
                p = shp.text_frame.paragraphs[0]
                p.text = str(idx)
                p.font.name = "Segoe UI"
                p.font.size = Pt(12)
                p.font.color.rgb = TEXT_MUTED

    # Save to docs and root
    prs.save(output_pptx)
    prs.save(root_output_pptx)
    print("SUCCESS: 12-Slide Master Presentation with White Text on Slide 1 and Curved Frame Screenshot Generated!")
    print(f"  Docs: {output_pptx}")
    print(f"  Root: {root_output_pptx}")

if __name__ == "__main__":
    build_presentation()
