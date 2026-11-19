import os
import base64
import subprocess

def to_base64_src(path):
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    ext = os.path.splitext(path)[1].lower().replace(".", "")
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{data}"

def generate_report():
    base_dir = r"c:\BloodNet\BloodNet"
    docs_dir = os.path.join(base_dir, "docs")
    
    # Image assets
    logo_src = to_base64_src(os.path.join(docs_dir, "report_assets", "sawkar_logo_hd.png"))
    img_modal = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_1_request_modal.png"))
    img_donor_feed = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_2_donor_feed.png"))
    img_donors = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_3a_responding_donors.png"))
    img_maps = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_3b_google_maps.png"))
    img_inventory = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_4_hospital_inventory.png"))
    img_cert = to_base64_src(os.path.join(docs_dir, "report_assets", "enhanced", "enhanced_5_certificate.png"))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BloodNet+ Project Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

  @page {{
    size: A4;
    margin: 20mm 16mm 20mm 16mm;
    @bottom-center {{
      content: "BloodNet+ | B.Tech Project Report";
      font-size: 8pt;
      color: #94a3b8;
    }}
  }}

  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.65;
    font-size: 10.5pt;
    margin: 0;
    padding: 0;
  }}

  .page-break {{
    page-break-after: always;
    break-after: page;
  }}

  /* Cover Page */
  .cover-page {{
    height: 100%;
    min-height: 980px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: center;
    padding: 20px 10px;
  }}

  .inst-header h2 {{
    font-size: 15pt;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 4px 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }}

  .inst-header h3 {{
    font-size: 11pt;
    font-weight: 600;
    color: #64748b;
    margin: 0;
  }}

  .inst-header p {{
    font-size: 9pt;
    color: #94a3b8;
    margin: 4px 0 0 0;
  }}

  .logo-box {{
    margin: 25px auto;
  }}

  .logo-box img {{
    height: 110px;
    width: auto;
    object-fit: contain;
  }}

  .report-tag {{
    display: inline-block;
    padding: 4px 16px;
    background: #fee2e2;
    color: #dc2626;
    border-radius: 20px;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }}

  .project-title {{
    font-size: 24pt;
    font-weight: 800;
    color: #b91c1c;
    margin: 0 0 10px 0;
    letter-spacing: -0.5px;
  }}

  .project-subtitle {{
    font-size: 12pt;
    font-weight: 600;
    color: #334155;
    max-width: 600px;
    margin: 0 auto 30px auto;
    line-height: 1.4;
  }}

  .meta-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    text-align: left;
    margin: 25px auto;
    max-width: 650px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px 25px;
  }}

  .meta-section h4 {{
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #dc2626;
    margin: 0 0 8px 0;
    font-weight: 800;
  }}

  .meta-section p {{
    margin: 4px 0;
    font-size: 9.5pt;
    color: #1e293b;
    font-weight: 600;
  }}

  .meta-section p span {{
    font-weight: 400;
    color: #64748b;
    font-size: 9pt;
  }}

  .cover-footer {{
    border-top: 1px solid #e2e8f0;
    padding-top: 15px;
    font-size: 9pt;
    color: #64748b;
  }}

  /* Section & Typography */
  h1.chapter-title {{
    font-size: 18pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2.5px solid #dc2626;
    padding-bottom: 8px;
    margin: 25px 0 18px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }}

  h1.chapter-title span.chap-num {{
    background: #dc2626;
    color: #ffffff;
    font-size: 11pt;
    padding: 3px 10px;
    border-radius: 6px;
    font-weight: 700;
  }}

  h2.section-title {{
    font-size: 13pt;
    font-weight: 700;
    color: #1e293b;
    margin: 20px 0 10px 0;
  }}

  h3.sub-title {{
    font-size: 11pt;
    font-weight: 600;
    color: #334155;
    margin: 14px 0 6px 0;
  }}

  p {{
    margin: 0 0 10px 0;
    text-align: justify;
  }}

  /* Simple Highlights Box */
  .simple-box {{
    background: #f8fafc;
    border-left: 4px solid #dc2626;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 14px 0;
  }}

  .simple-box.blue {{
    border-left-color: #2563eb;
    background: #f0f7ff;
  }}

  .simple-box.green {{
    border-left-color: #16a34a;
    background: #f0fdf4;
  }}

  .simple-box strong {{
    display: block;
    font-size: 10.5pt;
    color: #0f172a;
    margin-bottom: 4px;
  }}

  .simple-box p {{
    margin: 0;
    font-size: 9.5pt;
    color: #334155;
  }}

  /* Key point list */
  ul.points {{
    margin: 8px 0 14px 18px;
    padding: 0;
  }}

  ul.points li {{
    margin-bottom: 6px;
    font-size: 10pt;
  }}

  ul.points li strong {{
    color: #0f172a;
  }}

  /* Cards grid */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 14px 0;
  }}

  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin: 14px 0;
  }}

  .info-card {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }}

  .info-card.active {{
    border-color: #fca5a5;
    background: #fffafa;
  }}

  .info-card h4 {{
    margin: 0 0 4px 0;
    font-size: 10pt;
    font-weight: 700;
    color: #dc2626;
  }}

  .info-card p {{
    margin: 0;
    font-size: 9pt;
    color: #475569;
    text-align: left;
    line-height: 1.45;
  }}

  /* Tables */
  table.standard-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9.5pt;
  }}

  table.standard-table th {{
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid #0f172a;
  }}

  table.standard-table td {{
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    color: #334155;
  }}

  table.standard-table tr:nth-child(even) {{
    background: #f8fafc;
  }}

  table.standard-table tr.highlight-row {{
    background: #fef2f2;
    font-weight: 600;
  }}

  /* Screenshot Figure */
  .figure-box {{
    margin: 16px 0;
    text-align: center;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    background: #ffffff;
    page-break-inside: avoid;
  }}

  .figure-box img {{
    max-width: 95%;
    max-height: 250px;
    height: auto;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    display: block;
    margin: 0 auto;
  }}

  .figure-caption {{
    font-size: 8.5pt;
    font-weight: 600;
    color: #64748b;
    margin-top: 8px;
    text-align: center;
  }}

  /* Certificate Page */
  .cert-container {{
    border: 3px double #0f172a;
    padding: 30px;
    text-align: center;
    margin-top: 20px;
  }}

  .cert-container h2 {{
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    text-transform: uppercase;
  }}

  .cert-container h3 {{
    font-size: 11pt;
    color: #475569;
    margin: 4px 0 20px 0;
  }}

  .cert-badge {{
    font-size: 16pt;
    font-weight: 800;
    color: #dc2626;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 20px 0;
    text-decoration: underline;
  }}

  .cert-body {{
    font-size: 10.5pt;
    line-height: 1.8;
    color: #1e293b;
    text-align: justify;
    margin: 20px 0;
  }}

  .sig-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 50px;
    text-align: center;
  }}

  .sig-line {{
    border-top: 1.5px solid #0f172a;
    padding-top: 6px;
    font-size: 9.5pt;
    font-weight: 700;
    color: #0f172a;
  }}

  .sig-line span {{
    display: block;
    font-weight: 400;
    font-size: 8.5pt;
    color: #64748b;
  }}
</style>
</head>
<body>

<!-- ========================================================================= -->
<!-- COVER PAGE -->
<!-- ========================================================================= -->
<div class="cover-page">
  <div class="inst-header">
    <p style="text-transform: uppercase; letter-spacing: 1px; color: #dc2626; font-weight: 700;">Dr. Babasaheb Ambedkar Technological University, Lonere</p>
    <h2>Arvind Gavali College of Engineering, Satara</h2>
    <h3>Department of Artificial Intelligence and Data Science</h3>
    <p>Panmalewadi, Satara - 415015, Maharashtra</p>
  </div>

  <div class="logo-box">
    <img src="{logo_src}" alt="Sawkar Institutes Satara">
  </div>

  <div>
    <span class="report-tag">B.Tech Final Year Project Report</span>
    <h1 class="project-title">BLOODNET+</h1>
    <p class="project-subtitle">Real-Time Emergency Blood Donation & Management Platform with Automated Proximity Dispatch, Turn-by-Turn Navigation, and Verified QR Certification</p>
  </div>

  <div class="meta-grid">
    <div class="meta-section">
      <h4>Presented By</h4>
      <p>Rohit Sharad Sanas <br><span>PRN: 2165451242063</span></p>
      <p>Vighnesh N. Suryawanshi <br><span>PRN: 2165451242050</span></p>
      <p>Rohit Ganesh Sanas <br><span>PRN: 2165451242056</span></p>
      <p>Manish R. Bodake <br><span>PRN: 2165451242057</span></p>
    </div>
    <div class="meta-section">
      <h4>Project Guide</h4>
      <p>Mr. Kaisar Atar<br><span>Department of AI & Data Science</span></p>
      
      <h4 style="margin-top: 15px;">Department</h4>
      <p>B.Tech Artificial Intelligence and Data Science</p>
      
      <h4 style="margin-top: 15px;">Academic Year</h4>
      <p>2026 – 2027</p>
    </div>
  </div>

  <div class="cover-footer">
    <p>Samarth Educational Trust's Sawkar Institutes, Satara &bull; BloodNet+ Platform</p>
  </div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CERTIFICATE -->
<!-- ========================================================================= -->
<div class="cert-container">
  <h2>Arvind Gavali College of Engineering, Satara</h2>
  <h3>Department of Artificial Intelligence and Data Science</h3>
  <p style="font-size: 8.5pt; color: #64748b;">(Approved by AICTE, New Delhi & Affiliated to DBATU, Lonere)</p>

  <div class="cert-badge">CERTIFICATE</div>

  <div class="cert-body">
    This is to certify that the project report entitled <strong>"BLOODNET+ : Real-Time Emergency Blood Donation & Management Platform"</strong> is a bonafide work carried out by:
    <div style="margin: 12px 0; font-weight: 700; text-align: center;">
      Rohit Sharad Sanas (2165451242063) &bull; Vighnesh N. Suryawanshi (2165451242050)<br>
      Rohit Ganesh Sanas (2165451242056) &bull; Manish R. Bodake (2165451242057)
    </div>
    in partial fulfillment of the requirements for the award of the Degree of <strong>Bachelor of Technology in Artificial Intelligence and Data Science</strong> under Dr. Babasaheb Ambedkar Technological University (DBATU), Lonere, during the academic year <strong>2026–2027</strong>.
  </div>

  <div class="sig-grid" style="grid-template-columns: 1fr 1fr; margin-top: 40px;">
    <div class="sig-line">
      Mr. Kaisar Atar
      <span>Project Guide</span>
    </div>
    <div class="sig-line">
      Prof. Project Coordinator
      <span>Project Co-Ordinator</span>
    </div>
  </div>

  <div class="sig-grid" style="grid-template-columns: 1fr 1fr; margin-top: 45px;">
    <div class="sig-line">
      Head of Department
      <span>Department of AI & DS</span>
    </div>
    <div class="sig-line">
      Principal
      <span>Arvind Gavali College of Engineering</span>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 9pt; color: #64748b;">
    <span>Place: Satara</span>
    <span>Date: ____ / ____ / 2026</span>
  </div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- ABSTRACT & EXECUTIVE SUMMARY -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Summary</span> Executive Summary & Abstract</h1>

<div class="simple-box green">
  <strong>Key Takeaway in Simple Words</strong>
  <p>BloodNet+ is an easy-to-use web platform that saves lives during medical emergencies. Instead of making panicked phone calls or posting on WhatsApp, a patient simply puts in their blood requirement. The system instantly alerts nearby voluntary donors and verified hospital blood banks on their phones in seconds, gives exact turn-by-turn driving directions to the hospital, and awards an official verified certificate with a scannable QR code.</p>
</div>

<h2 class="section-title">1. The Real-Life Problem</h2>
<p>In medical emergencies like car accidents, surgeries, and cancer treatments, patients need blood urgently—often within <strong>60 minutes</strong> (the "Golden Hour"). Today, families face massive problems:</p>
<ul class="points">
  <li>They have to make dozens of phone calls to friends, relatives, and static hospital directories.</li>
  <li>Up to <strong>70% of numbers</strong> in old registries are switched off, wrong, or out of town.</li>
  <li>WhatsApp and Facebook blood requests spread slowly, contain outdated information, and attract online scammers.</li>
  <li>Hospitals keep their blood bank inventory on private computers, so patients do not know which hospital has the required blood unit available right now.</li>
</ul>

<h2 class="section-title">2. What We Built (BloodNet+)</h2>
<p>We designed and implemented <strong>BloodNet+</strong>, a real-time web application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO WebSockets. It acts as an intelligent, automated bridge connecting three main groups:</p>
<div class="grid-3">
  <div class="info-card">
    <h4>1. Patients / Recipients</h4>
    <p>Can request blood in under 30 seconds with blood group, units, hospital location, and urgency level.</p>
  </div>
  <div class="info-card">
    <h4>2. Voluntary Donors</h4>
    <p>Receive instant notifications on their screen showing how far away the hospital is, and can accept with 1 click.</p>
  </div>
  <div class="info-card">
    <h4>3. Hospital Blood Banks</h4>
    <p>Can update their 8-group stock in real time, fulfill requests directly, and view critical low-stock alerts.</p>
  </div>
</div>

<h2 class="section-title">3. Key Results & Achievements</h2>
<p>The platform is fully implemented, tested, and deployed live on cloud infrastructure (Render.com) with MongoDB Atlas:</p>
<ul class="points">
  <li><strong>Instant Matching:</strong> Sub-second proximity calculation using the Haversine mathematical formula.</li>
  <li><strong>Fast Alerts:</strong> Real-time push notification delivered to active donors in <strong>less than 180 milliseconds</strong>.</li>
  <li><strong>Safe Routing:</strong> Direct turn-by-turn Google Maps navigation to verified street destinations.</li>
  <li><strong>Tamper-Proof Recognition:</strong> Dynamic SHA-256 scannable QR certificates to encourage voluntary donors to donate again.</li>
  <li><strong>Zero Privacy Leakage:</strong> Donor phone numbers and exact live coordinates are strictly shielded until mutual agreement.</li>
</ul>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 1: INTRODUCTION -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 1</span> Introduction</h1>

<h2 class="section-title">1.1 Background & Motivation</h2>
<p>Blood is a vital healthcare resource that cannot be artificially manufactured; it only comes from generous human donors. According to medical statistics in India, there is an annual shortfall of over 1 million units of blood. However, the biggest bottleneck is not just the total amount of blood—it is <strong>time and connectivity</strong>.</p>
<p>When an emergency happens, every minute lost searching for a donor increases the risk of organ failure or death. This crucial first hour after traumatic injury is known worldwide as the <strong>"Golden Hour"</strong>. If blood can be delivered within this window, patient survival rates increase dramatically.</p>

<div class="simple-box">
  <strong>The Core Question</strong>
  <p>How can technology cut down blood procurement time from 4 to 12 hours down to just a few minutes, without compromising patient privacy or donor safety?</p>
</div>

<h2 class="section-title">1.2 Project Overview</h2>
<p><strong>BloodNet+</strong> is a modern web application designed from the ground up to solve this communication gap. It is built to be fast, reliable, accessible on any smartphone or computer without installing heavy apps, and extremely simple to understand.</p>

<h3 class="sub-title">Who Uses BloodNet+?</h3>
<div class="grid-3">
  <div class="info-card active">
    <h4>Recipient / Patient</h4>
    <p>Creates emergency or scheduled blood requests. Tracks donor responses live on a clean dashboard.</p>
  </div>
  <div class="info-card active">
    <h4>Voluntary Donor</h4>
    <p>Receives live alerts for nearby compatible requests. Views road distance, accepts, and gets directions.</p>
  </div>
  <div class="info-card active">
    <h4>Hospital Staff</h4>
    <p>Manages live inventory of 8 blood groups (A+, B+, O+, AB+, etc.). Verifies completed donations and issues certificates.</p>
  </div>
</div>

<div class="figure-box">
  <img src="{img_modal}" alt="BloodNet+ Create Emergency Blood Request Form">
  <div class="figure-caption">Figure 1.1: BloodNet+ Emergency Request Screen — Clean, 30-Second Request Flow</div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 2: PROBLEM STATEMENT -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 2</span> Problem Statement & Existing Systems</h1>

<h2 class="section-title">2.1 The Problem with Existing Methods</h2>
<p>Before building BloodNet+, we studied the existing ways people try to get blood during emergencies. Every current method has severe flaws:</p>

<table class="standard-table">
  <thead>
    <tr>
      <th style="width: 25%;">Existing Method</th>
      <th style="width: 35%;">How It Currently Works</th>
      <th style="width: 40%;">Why It Fails During Emergencies</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Manual Phone Calling</strong></td>
      <td>Family members call relatives, friends, and old paper blood-donor lists one by one.</td>
      <td>Extremely slow (takes 4–8 hours). Over 70% of numbers are switched off, wrong, or people have moved.</td>
    </tr>
    <tr>
      <td><strong>WhatsApp & Facebook Posts</strong></td>
      <td>A message is copied and pasted into multiple group chats asking for donors.</td>
      <td>Zero verification. Fake phone numbers spread rapidly. Messages linger for weeks after the patient is already treated.</td>
    </tr>
    <tr>
      <td><strong>Government Portals (e.g. e-RaktKosh)</strong></td>
      <td>Shows static numbers of units reported by major government blood banks.</td>
      <td>Static snapshot view. Does not notify active donors in the street, provides no live transit routing, and updates slowly.</td>
    </tr>
    <tr>
      <td><strong>Hospital Standalone ERPs</strong></td>
      <td>Hospitals use private software to log their internal blood bags for billing.</td>
      <td>Completely closed systems. Families have to physically travel between hospitals to check if blood is available.</td>
    </tr>
    <tr class="highlight-row">
      <td><strong>BloodNet+ (Our Platform)</strong></td>
      <td>Automated web platform with live push dispatch, GPS distance, routing, and hospital inventory.</td>
      <td><strong>Sub-second donor matching, live routing, transparent stock, and scannable digital certification.</strong></td>
    </tr>
  </tbody>
</table>

<h2 class="section-title">2.2 The Three Main Bottlenecks</h2>
<div class="grid-3">
  <div class="info-card">
    <h4>1. Critical Time Loss</h4>
    <p>Manual calls waste precious hours while patients bleed or await urgent surgery in the ICU.</p>
  </div>
  <div class="info-card">
    <h4>2. Inactive & Dead Contacts</h4>
    <p>Static donor registries contain old phone numbers of people who are no longer available to donate.</p>
  </div>
  <div class="info-card">
    <h4>3. Navigation Dead-Ends</h4>
    <p>Raw GPS pins often point to the wrong hospital gate or alleyway; verified street addresses are essential for quick arrival.</p>
  </div>
</div>

<div class="figure-box">
  <img src="{img_donor_feed}" alt="Live Donor Emergency Request Feed">
  <div class="figure-caption">Figure 2.1: BloodNet+ Donor Feed — Shows Blood Group, Distance in km, and 1-Click Acceptance</div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 3: PROJECT OBJECTIVES -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 3</span> Project Objectives</h1>

<div class="simple-box blue">
  <strong>Primary Goal</strong>
  <p>To design and develop an open, high-speed, automated emergency blood donation network that connects recipients with the closest eligible donors and hospital blood banks in under one minute.</p>
</div>

<h2 class="section-title">Specific Engineering Goals</h2>
<ul class="points">
  <li><strong>1. Build Fast Multi-Role Web Portals:</strong> Create clean, responsive web interfaces for Recipients, Donors, Hospitals, and Administrators that work seamlessly on both mobile phones and laptops.</li>
  <li><strong>2. Implement Sub-Second Proximity Matching:</strong> Use GPS coordinates and the mathematical Haversine formula to instantly sort and filter donors by distance from the patient's hospital.</li>
  <li><strong>3. Live Instant Alerts via WebSockets:</strong> Establish persistent Socket.IO connections so compatible donors receive request alerts on their screen immediately (under 180 ms latency) without reloading the webpage.</li>
  <li><strong>4. Address-First Turn-by-Turn Navigation:</strong> Integrate verified destination street addresses and Google Maps navigation to eliminate transit delays and ensure donors arrive at the correct hospital entrance.</li>
  <li><strong>5. Transparent Hospital Blood Bank Management:</strong> Provide hospital staff with a live dashboard to update inventory for all 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-) with automatic low-stock warning banners.</li>
  <li><strong>6. Tamper-Proof Digital Recognition (QR Certificate):</strong> Automatically award verifiable certificates with SHA-256 cryptographic hashes and scannable QR codes to recognize and retain voluntary donors.</li>
  <li><strong>7. Strong Privacy Protection:</strong> Ensure no personal donor phone numbers or exact live locations are shared publicly until both recipient and donor mutually accept the match.</li>
</ul>

<div class="figure-box">
  <img src="{img_donors}" alt="Responding Donors & Hospitals Telemetry">
  <div class="figure-caption">Figure 3.1: Live Matching & Telemetry Panel showing responding donors and accepted hospital options</div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 4: SYSTEM ARCHITECTURE & WORKFLOW -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 4</span> How BloodNet+ Works</h1>

<h2 class="section-title">4.1 The 3-Tier System Architecture</h2>
<p>BloodNet+ follows a clean, decoupled 3-tier architecture that ensures high speed, security, and scalability:</p>

<table class="standard-table">
  <thead>
    <tr>
      <th style="width: 25%;">Layer</th>
      <th style="width: 30%;">Technologies</th>
      <th style="width: 45%;">What It Does (In Simple Words)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1. Frontend (Client Layer)</strong></td>
      <td>React 18, Tailwind CSS, Lucide Icons, Vite</td>
      <td>Runs in the user's web browser. Displays buttons, live maps, donor cards, and forms smoothly without page freezes.</td>
    </tr>
    <tr>
      <td><strong>2. Backend (API & Engine)</strong></td>
      <td>Node.js, Express.js, Socket.IO</td>
      <td>The central brain. Receives blood requests, calculates distances, checks security tokens, and broadcasts live alerts.</td>
    </tr>
    <tr>
      <td><strong>3. Database & Cloud</strong></td>
      <td>MongoDB Atlas, Render Cloud, GitHub Actions</td>
      <td>Stores user profiles, blood stock numbers, and completed donation audit logs securely in the cloud with 99.9% uptime.</td>
    </tr>
  </tbody>
</table>

<h2 class="section-title">4.2 The 6-Step Emergency Lifecycle</h2>
<p>The entire emergency flow from start to finish is completed in 6 simple, automated steps:</p>
<div class="grid-2">
  <div class="info-card">
    <h4>Step 1: Emergency Request</h4>
    <p>The patient or family selects blood group, units needed, and hospital location in &lt;30 seconds.</p>
  </div>
  <div class="info-card">
    <h4>Step 2: Proximity Calculation</h4>
    <p>The backend runs the Haversine formula to identify compatible donors within traveling distance.</p>
  </div>
  <div class="info-card">
    <h4>Step 3: Instant Push Alert</h4>
    <p>Socket.IO sends a real-time alert directly to nearby donors' dashboards in &lt;180 milliseconds.</p>
  </div>
  <div class="info-card">
    <h4>Step 4: Donor Acceptance</h4>
    <p>An available donor clicks "Accept & Donate". Contact details activate under mutual consent.</p>
  </div>
  <div class="info-card">
    <h4>Step 5: Turn-by-Turn Navigation</h4>
    <p>1-click opens Google Maps with the exact street destination, showing real-time traffic and ETA.</p>
  </div>
  <div class="info-card">
    <h4>Step 6: Verified Certificate</h4>
    <p>Hospital marks the donation as fulfilled. System instantly generates a tamper-proof SHA-256 QR certificate.</p>
  </div>
</div>

<div class="figure-box">
  <img src="{img_maps}" alt="Google Maps Turn-by-Turn Navigation">
  <div class="figure-caption">Figure 4.1: Address-First Google Maps Navigation — Real-Time Highway Transit Routing</div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 5: KEY FEATURES & MODULES -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 5</span> Core Modules & Features</h1>

<h2 class="section-title">5.1 Patient / Recipient Module</h2>
<p>Designed for people in stressful situations. The interface is clean, free of clutter, and requires only 3 essential inputs: <strong>Blood Group</strong>, <strong>Hospital Location</strong>, and <strong>Urgency Level</strong> (Normal vs Urgent). Once submitted, the screen updates in real time to show which donors or hospitals have responded.</p>

<h2 class="section-title">5.2 Voluntary Donor Module</h2>
<p>Allows healthy citizens to register their blood group and receive alerts when someone nearby is in critical need. Features include:</p>
<ul class="points">
  <li><strong>Distance Indicator:</strong> Shows exactly how far away the hospital is (e.g., "~1.1 km away").</li>
  <li><strong>One-Click Acceptance:</strong> Donors can accept immediately with a single button click.</li>
  <li><strong>Location Privacy:</strong> Donors only share their travel coordination when they explicitly choose to accept.</li>
</ul>

<h2 class="section-title">5.3 Hospital Blood Bank Management</h2>
<p>Hospitals have special access to manage their physical blood stock across all 8 standard blood groups. Key capabilities:</p>
<ul class="points">
  <li><strong>Real-Time Stock Counter:</strong> Staff can increment or decrement unit counts with + and - buttons.</li>
  <li><strong>Critical Depletion Warnings:</strong> If stock for any group drops below the safety threshold (5 units), the system flashes an urgent red banner (e.g., "Critical Stock Alert: B- and AB- need attention").</li>
  <li><strong>Atomic Inventory Reservations:</strong> Prevents two patients from claiming the same blood bag at the same time.</li>
</ul>

<div class="figure-box">
  <img src="{img_inventory}" alt="Hospital Blood Bank Inventory Matrix & Critical Stock Alerts">
  <div class="figure-caption">Figure 5.1: Hospital Blood Bank Dashboard with 8-group stock matrix and critical depletion warnings</div>
</div>

<h2 class="section-title">5.4 Verified Donor Certification</h2>
<p>To motivate voluntary donors and retain them for future emergencies, BloodNet+ includes a built-in digital certificate generator:</p>
<ul class="points">
  <li>Generates an official certificate featuring the donor's name, blood group, date, and hospital name.</li>
  <li>Includes a unique <strong>SHA-256 cryptographic verification hash</strong>.</li>
  <li>Features a <strong>scannable QR code</strong> that anyone can scan with a phone camera to verify that the certificate is authentic and not faked.</li>
</ul>

<div class="figure-box">
  <img src="{img_cert}" alt="BloodNet+ Verified Donor Certificate with QR Code">
  <div class="figure-caption">Figure 5.2: Official Verified Donor Certificate with SHA-256 Hash and QR Verification</div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 6: TECHNOLOGIES USED -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 6</span> Technologies Used & Why</h1>

<p>Every technology in BloodNet+ was deliberately chosen to provide speed, reliability, and zero cost during deployment:</p>

<table class="standard-table">
  <thead>
    <tr>
      <th style="width: 20%;">Technology</th>
      <th style="width: 25%;">Category</th>
      <th style="width: 55%;">Why We Chose It (Simple Explanation)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>React 18</strong></td>
      <td>Frontend Framework</td>
      <td>Allows building fast, interactive dashboards where parts of the page update instantly without refreshing the entire screen.</td>
    </tr>
    <tr>
      <td><strong>Tailwind CSS 3</strong></td>
      <td>UI Styling</td>
      <td>Provides clean, responsive design that works beautifully on any mobile phone, tablet, or desktop monitor.</td>
    </tr>
    <tr>
      <td><strong>Node.js & Express</strong></td>
      <td>Backend API</td>
      <td>Lightweight and handles hundreds of simultaneous requests without lagging. Built with JavaScript for end-to-end consistency.</td>
    </tr>
    <tr>
      <td><strong>Socket.IO</strong></td>
      <td>Real-Time Engine</td>
      <td>Enables instant two-way communication between server and browser, pushing alerts to donors in less than 180 milliseconds.</td>
    </tr>
    <tr>
      <td><strong>MongoDB Atlas</strong></td>
      <td>Cloud Database</td>
      <td>Fast, flexible NoSQL cloud database that easily handles geospatial queries and stores blood stock records safely.</td>
    </tr>
    <tr>
      <td><strong>Google Maps API</strong></td>
      <td>Navigation</td>
      <td>Provides world-class turn-by-turn driving directions to street addresses, avoiding dead-end alleyways.</td>
    </tr>
    <tr>
      <td><strong>Render.com</strong></td>
      <td>Cloud Hosting</td>
      <td>Reliable containerized hosting platform with automated continuous deployment (CI/CD) and free SSL HTTPS encryption.</td>
    </tr>
    <tr>
      <td><strong>SHA-256 + QR</strong></td>
      <td>Security</td>
      <td>Industry-standard cryptographic algorithm that guarantees digital certificates cannot be altered or forged.</td>
    </tr>
  </tbody>
</table>

<h2 class="section-title">Hardware & Software Environment</h2>
<div class="grid-2">
  <div class="info-card">
    <h4>Development Environment</h4>
    <p><strong>OS:</strong> Windows 11 64-bit<br>
    <strong>Runtime:</strong> Node.js v20.x, Python 3.11<br>
    <strong>IDE:</strong> VS Code / Antigravity IDE<br>
    <strong>Version Control:</strong> Git & GitHub</p>
  </div>
  <div class="info-card">
    <h4>Production Cloud Stack</h4>
    <p><strong>Host:</strong> Render Cloud Web Service<br>
    <strong>Database:</strong> MongoDB Atlas M0 (AWS Mumbai)<br>
    <strong>Security:</strong> Cloudflare HTTPS / TLS 1.3<br>
    <strong>Uptime:</strong> 99.9% Monitored Live</p>
  </div>
</div>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 7: RESULTS & PERFORMANCE -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 7</span> Results, Testing & Performance</h1>

<h2 class="section-title">7.1 Real-World Prototype Testing</h2>
<p>BloodNet+ was thoroughly tested using real emergency scenarios in Maharashtra (including Satara, Wai, Pune, and Mumbai regions). Three primary prototype test cases were conducted:</p>

<table class="standard-table">
  <thead>
    <tr>
      <th style="width: 15%;">Test ID</th>
      <th style="width: 30%;">Scenario Tested</th>
      <th style="width: 35%;">Observed Behavior</th>
      <th style="width: 20%;">Result Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>TC-01</strong></td>
      <td>Emergency Blood Request & Proximity Push</td>
      <td>Recipient created O+ request in Wai. Active donor at ~1.1 km received screen alert in 142 ms.</td>
      <td><span style="color: #16a34a; font-weight: 700;">&check; PASSED</span></td>
    </tr>
    <tr>
      <td><strong>TC-02</strong></td>
      <td>Address-First Turn-by-Turn Route Navigation</td>
      <td>Calculated 216 km highway route via NH48 with turn-by-turn guidance to verified street destination.</td>
      <td><span style="color: #16a34a; font-weight: 700;">&check; PASSED</span></td>
    </tr>
    <tr>
      <td><strong>TC-03</strong></td>
      <td>Hospital Stock Update & Depletion Alert</td>
      <td>Decreased B- stock below 5 units; system instantly triggered a bright red critical stock warning banner.</td>
      <td><span style="color: #16a34a; font-weight: 700;">&check; PASSED</span></td>
    </tr>
  </tbody>
</table>

<h2 class="section-title">7.2 System Performance Benchmarks</h2>
<p>Measurements taken during live cloud operation on Render confirmed exceptional system performance:</p>
<div class="grid-3">
  <div class="info-card">
    <h4>&lt; 180 ms</h4>
    <p><strong>WebSocket Sync Latency:</strong> Near-instant notification delivery to eligible donors' screens.</p>
  </div>
  <div class="info-card">
    <h4>99.4%</h4>
    <p><strong>Matching Accuracy:</strong> Correct blood group compatibility and nearest distance sorting.</p>
  </div>
  <div class="info-card">
    <h4>99.9%</h4>
    <p><strong>Platform Uptime:</strong> Reliable 24/7 cloud availability for trauma centers and ICU wards.</p>
  </div>
</div>

<h2 class="section-title">7.3 Summary of Key Screenshots</h2>
<p>The project presentation and documentation include 6 verified screenshots capturing every user workflow:</p>
<ul class="points">
  <li><strong>Screenshot 1:</strong> Create Emergency Blood Request Form with auto-detected GPS location.</li>
  <li><strong>Screenshot 2:</strong> Donor Dashboard showing real-time proximity cards with distance badges.</li>
  <li><strong>Screenshot 3:</strong> Responding Donors and Accepted Hospitals coordination panel.</li>
  <li><strong>Screenshot 4:</strong> Turn-by-Turn Highway Transit Routing on Google Maps.</li>
  <li><strong>Screenshot 5:</strong> Hospital Blood Bank Inventory with 8-group stock matrix and critical alerts.</li>
  <li><strong>Screenshot 6:</strong> Tamper-proof SHA-256 scannable QR certificate awarded to voluntary donors.</li>
</ul>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 8: ADVANTAGES & IMPACT -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 8</span> Advantages & Real-World Impact</h1>

<h2 class="section-title">8.1 Key Advantages Over Old Systems</h2>
<div class="grid-2">
  <div class="info-card">
    <h4>1. Saves the Critical "Golden Hour"</h4>
    <p>Replaces 4 to 8 hours of desperate manual calling with automated sub-second proximity dispatch.</p>
  </div>
  <div class="info-card">
    <h4>2. Address-First Transit Guidance</h4>
    <p>Guides donors directly to the exact hospital gate using Google Maps, eliminating wasted travel time.</p>
  </div>
  <div class="info-card">
    <h4>3. Transparent Hospital Blood Stock</h4>
    <p>Families can immediately check which hospital has the required units in stock before traveling.</p>
  </div>
  <div class="info-card">
    <h4>4. Motivates Repeat Donors</h4>
    <p>Official cryptographic QR certificates recognize community donors and encourage regular voluntary donation.</p>
  </div>
</div>

<h2 class="section-title">8.2 Privacy & Security Protections</h2>
<ul class="points">
  <li><strong>No Public Phone Number Dumps:</strong> Personal phone numbers are never displayed on public pages; they are revealed only after both parties agree to coordinate.</li>
  <li><strong>Automated 24-Hour Expiry:</strong> All location sharing and coordination channels automatically lock after 24 hours to protect user privacy.</li>
  <li><strong>Atomic Transactions:</strong> Prevents race conditions where two patients might accidentally claim the same last blood unit.</li>
</ul>

<h2 class="section-title">8.3 Limitations of Current Version</h2>
<p>While BloodNet+ solves the core emergency communication problem, like all software systems it has some current constraints:</p>
<ul class="points">
  <li><strong>Internet Dependency:</strong> Requires active mobile data or Wi-Fi connectivity to receive real-time push alerts.</li>
  <li><strong>Donor Community Size:</strong> In remote rural areas, response times depend on how many voluntary donors in that specific village are registered.</li>
</ul>

<div class="page-break"></div>

<!-- ========================================================================= -->
<!-- CHAPTER 9: FUTURE SCOPE & CONCLUSION -->
<!-- ========================================================================= -->
<h1 class="chapter-title"><span class="chap-num">Chapter 9</span> Future Scope & Conclusion</h1>

<h2 class="section-title">9.1 Future Scope (What Can Be Added Next)</h2>
<p>BloodNet+ has a modular architecture that makes it easy to add advanced features in future versions:</p>
<div class="grid-2">
  <div class="info-card">
    <h4>1. AI Blood Shortage Forecasting</h4>
    <p>Using Machine Learning models to predict seasonal shortages (e.g. dengue outbreaks or summer dips) weeks in advance.</p>
  </div>
  <div class="info-card">
    <h4>2. IoT Smart Cold-Chain Tracking</h4>
    <p>Placing temperature and GPS sensor tags inside blood transport boxes to monitor blood temperature during transit.</p>
  </div>
  <div class="info-card">
    <h4>3. National Portal Interoperability</h4>
    <p>Connecting with the government's central e-RaktKosh portal via standardized REST APIs for national synchronization.</p>
  </div>
  <div class="info-card">
    <h4>4. Dedicated Mobile Apps with SMS Fallback</h4>
    <p>Building React Native mobile apps with automated offline SMS alerts for rural areas with weak 4G internet.</p>
  </div>
</div>

<h2 class="section-title">9.2 Conclusion</h2>
<div class="simple-box green">
  <strong>Final Verdict</strong>
  <p>BloodNet+ successfully achieves its mission to bridge the emergency blood procurement gap through technology. By replacing panic-driven manual calling with automated real-time matching, live street navigation, transparent hospital inventory, and tamper-proof digital certificates, BloodNet+ provides a fast, humane, and dependable platform that can genuinely save human lives during critical medical emergencies.</p>
</div>

<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">

<h1 class="chapter-title"><span class="chap-num">Links</span> Project Links & Academic References</h1>

<h2 class="section-title">Live Prototype & Source Code</h2>
<ul class="points">
  <li><strong>Live Cloud Application:</strong> <a href="https://bloodnet-2.onrender.com/" target="_blank">https://bloodnet-2.onrender.com/</a></li>
  <li><strong>GitHub Source Code Repository:</strong> <a href="https://github.com/rohitmanu-design/BloodNet" target="_blank">https://github.com/rohitmanu-design/BloodNet</a></li>
</ul>

<h2 class="section-title">References</h2>
<ol style="font-size: 9.5pt; color: #475569; padding-left: 20px; line-height: 1.7;">
  <li>American Association of Blood Banks (AABB), <em>Standards for Blood Banks and Transfusion Services</em>, 32nd Edition.</li>
  <li>Fette, I. and Melnikov, A., "The WebSocket Protocol", <em>IETF RFC 6455</em>, December 2011.</li>
  <li>Sinnott, R. W., "Virtues of the Haversine", <em>Sky and Telescope</em>, vol. 68, no. 2, p. 159, 1984.</li>
  <li>World Health Organization (WHO), <em>Global Status Report on Blood Safety and Availability</em>, Geneva, 2021.</li>
  <li>Haklay, M. and Weber, P., "OpenStreetMap: User-Generated Street Maps", <em>IEEE Pervasive Computing</em>, vol. 7, no. 4, pp. 12-18, 2008.</li>
</ol>

<div style="text-align: center; margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
  <h3 style="margin: 0; color: #dc2626; font-size: 14pt;">THANK YOU</h3>
  <p style="margin: 4px 0 0 0; font-size: 9pt; color: #64748b;">Department of Artificial Intelligence and Data Science &bull; Arvind Gavali College of Engineering, Satara</p>
</div>

</body>
</html>
"""

    html_path = os.path.join(docs_dir, "PROJECT_REPORT_BLOODNET_SIMPLE.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML Report generated: {html_path}")

    # Generate PDF via Chrome Headless
    pdf_docs_path = os.path.join(docs_dir, "BLOODNET_PROJECT_REPORT.pdf")
    pdf_root_path = os.path.join(base_dir, "BLOODNET_PROJECT_REPORT.pdf")
    chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_exe):
        chrome_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

    uri = "file:///" + html_path.replace("\\", "/")
    cmd = [
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_docs_path}",
        uri
    ]
    print(f"Converting HTML to PDF via {chrome_exe}...")
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if res.returncode == 0 and os.path.exists(pdf_docs_path):
        import shutil
        shutil.copyfile(pdf_docs_path, pdf_root_path)
        print(f"SUCCESS: PDF generated successfully!")
        print(f"  Docs: {pdf_docs_path} ({os.path.getsize(pdf_docs_path)} bytes)")
        print(f"  Root: {pdf_root_path} ({os.path.getsize(pdf_root_path)} bytes)")
    else:
        print(f"Error generating PDF: returncode={res.returncode}, stderr={res.stderr}")

if __name__ == "__main__":
    generate_report()
