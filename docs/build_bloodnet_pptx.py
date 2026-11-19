import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from PIL import Image, ImageDraw

def prepare_assets(base_dir):
    enhanced_dir = os.path.join(base_dir, "docs", "report_assets", "enhanced")
    os.makedirs(enhanced_dir, exist_ok=True)

    # Generate mobile composite card for Slide 9 (616 x 1226)
    mobile_path = os.path.join(enhanced_dir, "bloodnet_slide9_mobile.png")
    card = Image.new("RGBA", (616, 1226), (255, 255, 255, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([0, 0, 615, 1225], radius=36, fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=3)

    donor_p = os.path.join(enhanced_dir, "enhanced_3a_responding_donors.png")
    if os.path.exists(donor_p):
        donor_img = Image.open(donor_p).convert("RGBA")
        donor_crop = donor_img.crop((0, 0, min(donor_img.width, 1028), min(donor_img.height, 480)))
        donor_w = 570
        donor_h = int(donor_w * donor_crop.height / donor_crop.width)
        donor_resized = donor_crop.resize((donor_w, donor_h), Image.Resampling.LANCZOS)
        card.paste(donor_resized, (23, 25), donor_resized)
        next_y = 25 + donor_h + 20
    else:
        next_y = 30

    cert_p = os.path.join(enhanced_dir, "enhanced_5_certificate.png")
    if os.path.exists(cert_p):
        cert_img = Image.open(cert_p).convert("RGBA")
        cert_w = 570
        cert_h = int(cert_w * cert_img.height / cert_img.width)
        # Cap height so it fits cleanly
        if next_y + cert_h > 1200:
            cert_h = 1200 - next_y
            cert_resized = cert_img.resize((cert_w, cert_h), Image.Resampling.LANCZOS)
        else:
            cert_resized = cert_img.resize((cert_w, cert_h), Image.Resampling.LANCZOS)
        card.paste(cert_resized, (23, next_y), cert_resized)

    card.save(mobile_path)
    return mobile_path

def build_presentation():
    base_dir = r"c:\BloodNet\BloodNet"
    ref_pptx = r"C:\Users\suraj\.gemini\antigravity\brain\11c5381b-abe0-4590-adb5-713b7965389b\.user_uploaded\media_1795098428020_e7949544.pptx"
    output_pptx = os.path.join(base_dir, "docs", "BLOODNET_PROJECT_PRESENTATION.pptx")
    root_output_pptx = os.path.join(base_dir, "BLOODNET_PROJECT_PRESENTATION.pptx")
    enhanced_dir = os.path.join(base_dir, "docs", "report_assets", "enhanced")

    mobile_card_path = prepare_assets(base_dir)

    prs = pptx.Presentation(ref_pptx)
    assert len(prs.slides) == 12, f"Expected 12 slides, found {len(prs.slides)}"

    def set_shape_text(shape, new_text, font_size=None, bold=None, color_rgb=None):
        if not shape.has_text_frame:
            return
        tf = shape.text_frame
        lines = new_text.split("\n")
        tf.clear()
        for idx, line in enumerate(lines):
            p = tf.add_paragraph() if idx > 0 else tf.paragraphs[0]
            p.text = line
            if font_size:
                p.font.size = font_size
            if bold is not None:
                p.font.bold = bold
            if color_rgb:
                p.font.color.rgb = color_rgb

    def replace_pic_by_name(slide, shape_name, new_img_path, width=None, height=None, top_offset=None):
        if not os.path.exists(new_img_path):
            print(f"Warning: {new_img_path} not found")
            return
        target = None
        for s in slide.shapes:
            if s.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE and s.name == shape_name:
                target = s
                break
        if target:
            l = target.left
            t = target.top if top_offset is None else target.top + top_offset
            w = width if width is not None else target.width
            h = height if height is not None else target.height
            sp = target._element
            sp.getparent().remove(sp)
            if width is not None and height is not None:
                slide.shapes.add_picture(new_img_path, l, t, width=w, height=h)
            elif width is not None:
                slide.shapes.add_picture(new_img_path, l, t, width=w)
            elif height is not None:
                slide.shapes.add_picture(new_img_path, l, t, height=h)
            else:
                slide.shapes.add_picture(new_img_path, l, t, width=w)

    # =========================================================================
    # SLIDE 1: Title Slide
    # =========================================================================
    s1 = prs.slides[0]
    set_shape_text(s1.shapes[1], "B.TECH FINAL YEAR PROJECT")
    set_shape_text(s1.shapes[2], "BLOODNET+")
    set_shape_text(s1.shapes[3], "Real-Time Emergency Blood Donation & Management Platform")
    set_shape_text(s1.shapes[5], "Presented by")
    set_shape_text(s1.shapes[6], "Rohit Sharad Sanas (2165451242063)\nVighnesh N. Suryawanshi (2165451242050)")
    set_shape_text(s1.shapes[7], "Rohit Ganesh Sanas (2165451242056)\nManish Rajesh Bodake (2165451242057)")
    set_shape_text(s1.shapes[8], "Project Guide")
    set_shape_text(s1.shapes[9], "Dr. Samina Y. Mulla")
    set_shape_text(s1.shapes[10], "Department")
    set_shape_text(s1.shapes[11], "Department of Computer Science and Engineering")
    set_shape_text(s1.shapes[13], "Arvind Gavali College of Engineering, Satara   |   Academic Year 2026–27")

    # =========================================================================
    # SLIDE 2: Introduction
    # =========================================================================
    s2 = prs.slides[1]
    set_shape_text(s2.shapes[0], "Introduction")
    set_shape_text(s2.shapes[2], "BloodNet+ – Making Emergency Blood Procurement Fast and Transparent")
    set_shape_text(s2.shapes[5], "Timely blood availability is critical for trauma emergencies and scheduled surgeries.")
    set_shape_text(s2.shapes[9], "Patients and families struggle with obsolete phone directories and unverified broadcasts.")
    set_shape_text(s2.shapes[13], "BloodNet+ is an automated web platform connecting recipients, donors, and hospitals in real time.")
    set_shape_text(s2.shapes[17], "It provides instant proximity matching, live turn-by-turn routing, and verified QR certification.")
    set_shape_text(s2.shapes[23], "Recipient, Donor & Hospital modes")
    set_shape_text(s2.shapes[27], "Haversine Proximity Matching")
    set_shape_text(s2.shapes[31], "Live WebSocket Tracking")
    set_shape_text(s2.shapes[32], "2")

    img1_path = os.path.join(enhanced_dir, "enhanced_1_request_modal.png")
    replace_pic_by_name(s2, "Image 4", img1_path, width=Inches(4.83), height=Inches(3.15))

    # =========================================================================
    # SLIDE 3: Problem Statement
    # =========================================================================
    s3 = prs.slides[2]
    set_shape_text(s3.shapes[0], "Problem Statement")
    set_shape_text(s3.shapes[2], "The Need for BloodNet+")
    set_shape_text(s3.shapes[7], "01")
    set_shape_text(s3.shapes[8], "Critical Time Gaps")
    set_shape_text(s3.shapes[9], "Emergency trauma & surgery need blood in <60 mins; manual procurement takes 4–12 hours.")
    set_shape_text(s3.shapes[14], "02")
    set_shape_text(s3.shapes[15], "High Donor Dormancy")
    set_shape_text(s3.shapes[16], "Up to 70% of numbers in static registries or public posts are obsolete, unreachable, or inactive.")
    set_shape_text(s3.shapes[20], "Manual Calling")
    set_shape_text(s3.shapes[22], "Social Media Posts")
    set_shape_text(s3.shapes[24], "Static Directories")
    set_shape_text(s3.shapes[27], "03")
    set_shape_text(s3.shapes[28], "Information Silos & Transit Failures")
    set_shape_text(s3.shapes[29], "Hospital blood banks operate in isolated silos, and raw GPS pins lead to alleyway dead-ends during transit.")
    set_shape_text(s3.shapes[32], "Our Solution – BloodNet+")
    set_shape_text(s3.shapes[33], "A unified web-based platform providing automated sub-second proximity matching, live WebSocket dispatch, address-first turn-by-turn Google Maps routing, and tamper-proof digital certification.")
    set_shape_text(s3.shapes[34], "3")

    img1_modal = os.path.join(enhanced_dir, "enhanced_1_request_modal.png")
    img2_feed = os.path.join(enhanced_dir, "enhanced_2_donor_feed.png")
    replace_pic_by_name(s3, "Image 0", img1_modal, width=Inches(3.83), height=Inches(1.70))
    replace_pic_by_name(s3, "Image 1", img2_feed, width=Inches(3.83), height=Inches(1.70))

    # =========================================================================
    # SLIDE 4: Objectives
    # =========================================================================
    s4 = prs.slides[3]
    set_shape_text(s4.shapes[0], "Objectives")
    set_shape_text(s4.shapes[6], "1.  Full-Stack Platform\nBuild dedicated, responsive MERN web portals for Recipients, Donors, Hospitals, and Admins.")
    set_shape_text(s4.shapes[11], "2.  Automated Proximity Matching\nImplement sub-second Haversine proximity calculations and OpenStreetMap geocoding.")
    set_shape_text(s4.shapes[16], "3.  Live Transit Coordination\nIntegrate Socket.IO WebSockets and address-first Google Maps turn-by-turn route navigation.")
    set_shape_text(s4.shapes[21], "4.  Hospital Inventory Hub\nAutomate real-time 8-group stock adjustments (A+, B+, AB+, O+) with instant depletion alerts.")
    set_shape_text(s4.shapes[26], "5.  Cryptographic Certification\nGenerate SHA-256 scannable QR certificates to recognize and retain voluntary community donors.")
    set_shape_text(s4.shapes[31], "6.  Empirical Benchmarking\nValidate system latency (<180ms), matching accuracy (>99%), and dispatch speed (<1.2s).")
    set_shape_text(s4.shapes[32], "4")

    # =========================================================================
    # SLIDE 5: Literature Survey & Research Gap
    # =========================================================================
    s5 = prs.slides[4]
    set_shape_text(s5.shapes[0], "Literature Survey & Research Gap")
    set_shape_text(s5.shapes[4], "5")

    tbl = s5.shapes[2].table
    tbl.cell(0, 0).text = "Existing Approach"
    tbl.cell(0, 1).text = "Purpose"
    tbl.cell(0, 2).text = "User Challenge / Major Limitation"

    tbl.cell(1, 0).text = "e-RaktKosh (Govt. Portal)"
    tbl.cell(1, 1).text = "Centralized national blood bank database tracking"
    tbl.cell(1, 2).text = "Static inventory view; no active donor push dispatch or live transit guidance"

    tbl.cell(2, 0).text = "Social Media Groups (WhatsApp/FB)"
    tbl.cell(2, 1).text = "Crowdsourced emergency donor broadcasts"
    tbl.cell(2, 2).text = "High misinformation rate, zero medical verification, and critical time delays"

    tbl.cell(3, 0).text = "Commercial Hospital ERPs"
    tbl.cell(3, 1).text = "In-house hospital inventory and billing management"
    tbl.cell(3, 2).text = "Proprietary data silos; zero patient-facing transparency or mobile routing"

    for row in tbl.rows:
        for cell in row.cells:
            for p in cell.text_frame.paragraphs:
                p.font.name = "Segoe UI"
                p.font.size = Pt(11)

    if len(s5.shapes) > 3 and s5.shapes[3].has_text_frame:
        set_shape_text(s5.shapes[3], "• Research Gap: Existing solutions lack integrated real-time push dispatch, provide no turn-by-turn transit navigation to verified street addresses, and offer no tamper-proof digital recognition to retain voluntary donors.")

    # =========================================================================
    # SLIDE 6: Proposed System
    # =========================================================================
    s6 = prs.slides[5]
    set_shape_text(s6.shapes[0], "Proposed System")
    set_shape_text(s6.shapes[2], "From emergency blood request to verified donor fulfillment and audit certification")

    set_shape_text(s6.shapes[7], "1")
    set_shape_text(s6.shapes[8], "Emergency Request")
    set_shape_text(s6.shapes[9], "Recipient logs units, blood group & hospital in <30 seconds.")

    set_shape_text(s6.shapes[15], "2")
    set_shape_text(s6.shapes[16], "Proximity Matching")
    set_shape_text(s6.shapes[17], "Haversine engine calculates distance to all active voluntary donors.")

    set_shape_text(s6.shapes[23], "3")
    set_shape_text(s6.shapes[24], "Push Notification")
    set_shape_text(s6.shapes[25], "Instant WebSocket broadcast alerts eligible donors (<180 ms latency).")

    set_shape_text(s6.shapes[31], "4")
    set_shape_text(s6.shapes[32], "Donor Acceptance")
    set_shape_text(s6.shapes[33], "Donor accepts; contact details & mutual coordination activate.")

    set_shape_text(s6.shapes[39], "5")
    set_shape_text(s6.shapes[40], "Live Transit Routing")
    set_shape_text(s6.shapes[41], "Turn-by-turn Google Maps routing to verified street destination.")

    set_shape_text(s6.shapes[47], "6")
    set_shape_text(s6.shapes[48], "Verified Certification")
    set_shape_text(s6.shapes[49], "Hospital verifies donation and awards dynamic SHA-256 QR certificate.")

    set_shape_text(s6.shapes[52], "Multi-Role Portals")
    set_shape_text(s6.shapes[53], "Recipient, Donor, Hospital and Admin workflows")

    set_shape_text(s6.shapes[56], "Real-Time Dispatch")
    set_shape_text(s6.shapes[57], "Socket.IO WebSockets with sub-second sync (<180 ms)")

    set_shape_text(s6.shapes[60], "Hospital Inventory")
    set_shape_text(s6.shapes[61], "8 blood group stock matrix with critical depletion alerts")

    set_shape_text(s6.shapes[64], "Cryptographic Audit")
    set_shape_text(s6.shapes[65], "Tamper-proof SHA-256 scannable QR verification")
    set_shape_text(s6.shapes[67], "6")

    # =========================================================================
    # SLIDE 7: System Architecture & Methodology
    # =========================================================================
    s7 = prs.slides[6]
    set_shape_text(s7.shapes[0], "System Architecture & Methodology")
    set_shape_text(s7.shapes[3], "USER\nEmergency Recipient / Voluntary Donor / Hospital Blood Bank")
    set_shape_text(s7.shapes[6], "SELECT ROLE & LOCATION\nRecipient / Donor / Hospital Staff   |   GPS / Street Address")
    set_shape_text(s7.shapes[9], "BLOODNET+ PLATFORM HUB\nRole-Based Access Control & Real-Time Coordination")
    set_shape_text(s7.shapes[18], "EMERGENCY DISPATCH ENGINE")
    set_shape_text(s7.shapes[19], "HOSPITAL & DONOR SERVICES")
    set_shape_text(s7.shapes[21], "Request Ingestion\nBlood group, units, hospital & urgency")
    set_shape_text(s7.shapes[24], "Geocoding & Proximity\nHaversine distance calculation (< sub-sec)")
    set_shape_text(s7.shapes[27], "Socket.IO Telemetry\nReal-time push broadcast (<180ms latency)")

    set_shape_text(s7.shapes[29], "Hospital Stock\n8 blood groups\nReal-time matrix")
    set_shape_text(s7.shapes[31], "Depletion Alerts\nThreshold warnings\nSafe ratio 6/8")
    set_shape_text(s7.shapes[33], "Donor Directory\nLive coordination\nMutual consent")
    set_shape_text(s7.shapes[35], "Transit Engine\nGoogle Maps\nStreet routing")
    set_shape_text(s7.shapes[37], "Tamper-Proof QR\nSHA-256 certificate\nVoluntary retention")
    set_shape_text(s7.shapes[39], "Database Security\nAtomic transactions\nNo double-booking")

    set_shape_text(s7.shapes[45], "REAL-TIME DISPATCH & NAVIGATION\nLive tracking / turn-by-turn routing / ETA updates")
    set_shape_text(s7.shapes[48], "HOSPITAL FULFILLMENT & AUDIT LOGS\nAtomic MongoDB inventory update & verified certificate generation")
    set_shape_text(s7.shapes[49], "7")

    # =========================================================================
    # SLIDE 8: Technologies & Implementation
    # =========================================================================
    s8 = prs.slides[7]
    set_shape_text(s8.shapes[0], "Technologies & Implementation")
    set_shape_text(s8.shapes[5], "Frontend Architecture")
    set_shape_text(s8.shapes[6], "React 18 Single Page Application (SPA)\nTailwind CSS 3 responsive clinical UX\nVite build tooling with automated CI/CD")

    set_shape_text(s8.shapes[10], "Backend & Real-Time Engine")
    set_shape_text(s8.shapes[11], "Node.js & Express.js RESTful API\nSocket.IO: Room-based real-time event dispatcher\nHaversine proximity formula & OpenStreetMap geocoding")

    set_shape_text(s8.shapes[15], "Database & Transactions")
    set_shape_text(s8.shapes[16], "MongoDB Atlas & Mongoose ODM\nAtomic inventory reservation transactions\nBase64 profile avatar storage with auto-compression")

    set_shape_text(s8.shapes[20], "Deployment & Security")
    set_shape_text(s8.shapes[21], "Render Cloud Web Service container hosting\nGitHub automated CI/CD pipeline\nSHA-256 cryptographically verified QR code generator\nRole-based JWT authentication & access control")
    set_shape_text(s8.shapes[22], "8")

    # =========================================================================
    # SLIDE 9: Results & Performance
    # =========================================================================
    s9 = prs.slides[8]
    set_shape_text(s9.shapes[0], "Results & Performance")
    set_shape_text(s9.shapes[2], "Three recorded prototype verifications")
    set_shape_text(s9.shapes[5], "1")
    set_shape_text(s9.shapes[6], "Emergency Request & Distance Calculation\nCalculated ~1.1 km and ~0 km donor proximity instantly with WebSocket push")
    set_shape_text(s9.shapes[8], "Verified (<180ms)")
    set_shape_text(s9.shapes[11], "2")
    set_shape_text(s9.shapes[12], "Address-First Google Maps Route Navigation\nEliminated alleyway dead-ends; calculated 216 km / 4h 14m route via NH48")
    set_shape_text(s9.shapes[14], "Route OK")
    set_shape_text(s9.shapes[17], "3")
    set_shape_text(s9.shapes[18], "Hospital Blood Bank Inventory & Depletion Alerts\nReal-time 8-group matrix (6/8 safe, 2/8 critical) with atomic stock updates")
    set_shape_text(s9.shapes[20], "Stock Verified")
    set_shape_text(s9.shapes[22], "Empirical benchmarks verified on Render Cloud: 99.4% matching accuracy, <180ms sync latency, <1.2s dispatch speed, and 99.9% platform uptime.")
    set_shape_text(s9.shapes[25], "Prototype screenshot: Verified Donor Telemetry & QR")
    set_shape_text(s9.shapes[26], "9")

    # Replace prototype screenshot on right with mobile composite card
    replace_pic_by_name(s9, "Image 0", mobile_card_path, width=Inches(2.53), height=Inches(5.04))

    # =========================================================================
    # SLIDE 10: Applications, Advantages & Limitations
    # =========================================================================
    s10 = prs.slides[9]
    set_shape_text(s10.shapes[0], "Applications, Advantages & Limitations")
    set_shape_text(s10.shapes[5], "Applications")
    set_shape_text(s10.shapes[6], "Emergency ICUs & critical trauma surgical units\nRegional blood bank coordination & inventory tracking\nDisaster management & mass-casualty response networks\nRural & semi-urban primary healthcare donor mobilization")

    set_shape_text(s10.shapes[10], "Advantages")
    set_shape_text(s10.shapes[11], "Sub-second dispatch minimizes critical golden hour delays\nEliminates obsolete phone directories & duplicate calls\nAddress-first Google Maps navigation prevents transit dead-ends\nCryptographically verified QR certificates boost donor retention\nAtomic database transactions prevent inventory double-booking")

    set_shape_text(s10.shapes[15], "Limitations")
    set_shape_text(s10.shapes[16], "Requires active internet & WebSocket connectivity\nDependent on registered voluntary donor engagement in locality\nGeocoding accuracy relies on OpenStreetMap coverage density")
    set_shape_text(s10.shapes[17], "10")

    # =========================================================================
    # SLIDE 11: Future Scope & Conclusion
    # =========================================================================
    s11 = prs.slides[10]
    set_shape_text(s11.shapes[0], "Future Scope & Conclusion")
    set_shape_text(s11.shapes[4], "Future Scope")
    set_shape_text(s11.shapes[5], "AI Shortage Forecasting: ML models predicting regional blood deficits by season & dengue outbreaks\nIoT Smart Cold-Chain: Temperature sensors tracking blood transport boxes during transit\nNational Portal Sync: Standardized API inter-operability with national e-RaktKosh registry\nDedicated Mobile Apps: React Native iOS & Android apps with offline SMS alert fallback")

    set_shape_text(s11.shapes[8], "Conclusion")
    set_shape_text(s11.shapes[9], "BloodNet+ successfully bridges the critical emergency blood procurement gap with real-time automation.\nReplaced fragmented manual search calls with automated sub-second proximity dispatch (<180ms sync latency).\nDelivered address-first transit navigation and tamper-proof digital certification to incentivize voluntary donors.\nEmpirically validated live on Render cloud with 99.4% matching accuracy and 99.9% platform uptime.")
    set_shape_text(s11.shapes[10], "11")

    # =========================================================================
    # SLIDE 12: References & Q&A
    # =========================================================================
    s12 = prs.slides[11]
    set_shape_text(s12.shapes[0], "References & Q&A")
    set_shape_text(s12.shapes[3], "References")
    set_shape_text(s12.shapes[4], "1. American Association of Blood Banks (AABB), Standards for Blood Banks and Transfusion Services, 32nd Edition.\n2. Fette, I. and Melnikov, A., 'The WebSocket Protocol', IETF RFC 6455, Dec 2011.\n3. Sinnott, R. W., 'Virtues of the Haversine', Sky and Telescope, vol. 68, no. 2, p. 159, 1984.\n4. Haklay, M. and Weber, P., 'OpenStreetMap: User-Generated Street Maps', IEEE Pervasive Computing, 2008.\n5. BloodNet+ Project Prototype: https://bloodnet-2.onrender.com/\n6. BloodNet+ GitHub Repository: https://github.com/rohitmanu-design/BloodNet")
    set_shape_text(s12.shapes[7], "THANK YOU")
    set_shape_text(s12.shapes[9], "12")

    # Save presentation
    prs.save(output_pptx)
    prs.save(root_output_pptx)
    print("SUCCESS: BloodNet+ Presentation generated directly from Reference PPTX!")
    print(f"  Docs: {output_pptx}")
    print(f"  Root: {root_output_pptx}")

if __name__ == "__main__":
    build_presentation()
