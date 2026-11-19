const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const Request = require('../models/Request');
const auth = require('../middleware/auth');
const QRCode = require('qrcode');

// Helper function to generate impact message
function generateImpactMessage(totalDonations, certificateType) {
  const messages = {
    'first-time': 'Congratulations on taking your first noble step as a voluntary blood donor. Your compassion has ignited hope and saved a life!',
    'milestone': `Outstanding milestone of ${totalDonations} voluntary blood donations! Your enduring dedication serves as a beacon of life and humanity in our community.`,
    'emergency': 'Your rapid response to a critical emergency blood request directly saved a life in urgent need. Thank you for being a true everyday hero!',
    'regular': 'Thank you for your selfless and voluntary blood donation. Because of your kindness, patients in critical need are given a second chance at life.'
  };
  return messages[certificateType] || messages['regular'];
}

// Auto-sync & retrieve all certificates for the authenticated donor
router.get('/my-certificates', auth, async (req, res) => {
  try {
    const donorId = req.user.id;
    const donor = await User.findById(donorId);
    if (!donor) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    // Find all completed requests where this donor was the fulfilling responder
    const completedRequests = await Request.find({
      status: { $in: ['completed', 'fulfilled'] },
      $or: [
        { donorId: donorId },
        { selectedResponderId: donorId },
        { activeDonorId: donorId },
        { 'responses.responderId': donorId, 'responses.status': { $in: ['selected', 'accepted'] } }
      ]
    }).sort({ completedAt: 1, createdAt: 1 });

    // Auto-generate certificates for any completed donation that does not have one yet
    let donationIndex = 0;
    for (const reqDoc of completedRequests) {
      donationIndex++;
      const existing = await Certificate.findOne({ donationId: reqDoc._id });
      if (!existing) {
        let certificateType = 'regular';
        let milestoneBadge = null;
        let certificateTitle = 'Certificate of Appreciation';

        if (donationIndex === 1) {
          certificateType = 'first-time';
          milestoneBadge = '1st Donation Hero';
          certificateTitle = 'First Blood Donation Certificate';
        } else if (donationIndex % 5 === 0) {
          certificateType = 'milestone';
          milestoneBadge = `${donationIndex} Donations Milestone`;
          certificateTitle = `${donationIndex}th Donation Milestone Certificate`;
        } else if (reqDoc.urgency === 'critical' || reqDoc.urgency === 'emergency') {
          certificateType = 'emergency';
          milestoneBadge = 'Emergency Life Saver';
          certificateTitle = 'Emergency Life Saver Certificate';
        }

        const certYear = new Date(reqDoc.completedAt || reqDoc.createdAt || Date.now()).getFullYear();
        const certNum = `BLOOD-${certYear}-${Math.floor(100000 + Math.random() * 900000)}`;

        let qrCode = null;
        try {
          const qrData = JSON.stringify({
            certificateNumber: certNum,
            donorName: donor.name,
            bloodGroup: donor.bloodGroup || reqDoc.bloodGroup,
            donationDate: reqDoc.completedAt || reqDoc.createdAt,
            verified: true,
            organization: 'BloodNet+'
          });
          qrCode = await QRCode.toDataURL(qrData);
        } catch (qrErr) {
          console.warn('QR code generation warning:', qrErr.message);
        }

        const units = reqDoc.unitsNeeded || 1;
        const livesSaved = units * 3;
        const loc = reqDoc.location?.address || [reqDoc.location?.city, reqDoc.location?.state].filter(Boolean).join(', ') || 'Authorized Collection Centre';
        const hospName = reqDoc.hospitalName || reqDoc.acceptedHospitalInfo?.hospitalName || 'Verified Medical Centre';

        const newCert = new Certificate({
          donorId: donor._id,
          donationId: reqDoc._id,
          certificateNumber: certNum,
          certificateTitle,
          donorName: donor.name || 'Verified Donor',
          bloodGroup: donor.bloodGroup || reqDoc.bloodGroup || 'Blood Donor',
          donationDate: reqDoc.completedAt || reqDoc.createdAt || new Date(),
          donationLocation: loc,
          hospitalName: hospName,
          livesSaved,
          unitsDonated: units,
          certificateType,
          milestoneBadge,
          totalDonations: donationIndex,
          impactMessage: generateImpactMessage(donationIndex, certificateType),
          qrCode
        });

        await newCert.save();
      }
    }

    // Return all certificates for this donor, newest first
    const certificates = await Certificate.find({ donorId })
      .sort({ donationDate: -1, createdAt: -1 })
      .populate('donationId', 'urgency recipientName location bloodGroup unitsNeeded');

    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ message: 'Server error fetching certificates' });
  }
});

// Explicit generate certificate route for a completed donation
router.post('/generate/:donationId', auth, async (req, res) => {
  try {
    const { donationId } = req.params;
    const donation = await Request.findById(donationId);
    if (!donation) {
      return res.status(404).json({ message: 'Donation request not found' });
    }

    const existingCertificate = await Certificate.findOne({ donationId });
    if (existingCertificate) {
      return res.json({ message: 'Certificate already exists', certificate: existingCertificate });
    }

    const donorId = donation.donorId || donation.selectedResponderId || donation.activeDonorId || req.user.id;
    const donor = await User.findById(donorId);
    if (!donor) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    const totalDonations = await Request.countDocuments({
      status: { $in: ['completed', 'fulfilled'] },
      $or: [
        { donorId },
        { selectedResponderId: donorId },
        { activeDonorId: donorId }
      ]
    });

    let certificateType = 'regular';
    let milestoneBadge = null;
    let certificateTitle = 'Certificate of Appreciation';

    if (totalDonations <= 1) {
      certificateType = 'first-time';
      milestoneBadge = '1st Donation Hero';
      certificateTitle = 'First Blood Donation Certificate';
    } else if (totalDonations % 5 === 0) {
      certificateType = 'milestone';
      milestoneBadge = `${totalDonations} Donations Milestone`;
      certificateTitle = `${totalDonations}th Donation Milestone Certificate`;
    } else if (donation.urgency === 'critical' || donation.urgency === 'emergency') {
      certificateType = 'emergency';
      milestoneBadge = 'Emergency Life Saver';
      certificateTitle = 'Emergency Life Saver Certificate';
    }

    const certYear = new Date().getFullYear();
    const certNum = `BLOOD-${certYear}-${Math.floor(100000 + Math.random() * 900000)}`;

    let qrCode = null;
    try {
      const qrData = JSON.stringify({
        certificateNumber: certNum,
        donorName: donor.name,
        bloodGroup: donor.bloodGroup || donation.bloodGroup,
        donationDate: donation.completedAt || new Date(),
        verified: true,
        organization: 'BloodNet+'
      });
      qrCode = await QRCode.toDataURL(qrData);
    } catch (e) {}

    const units = donation.unitsNeeded || 1;
    const certificate = new Certificate({
      donorId: donor._id,
      donationId: donation._id,
      certificateNumber: certNum,
      certificateTitle,
      donorName: donor.name,
      bloodGroup: donor.bloodGroup || donation.bloodGroup,
      donationDate: donation.completedAt || new Date(),
      donationLocation: donation.location?.address || 'Verified Facility',
      hospitalName: donation.hospitalName || donation.acceptedHospitalInfo?.hospitalName || 'General Hospital',
      livesSaved: units * 3,
      unitsDonated: units,
      totalDonations: Math.max(1, totalDonations),
      certificateType,
      milestoneBadge,
      qrCode,
      impactMessage: generateImpactMessage(totalDonations, certificateType)
    });

    await certificate.save();

    res.status(201).json({
      message: 'Certificate generated successfully',
      certificate
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ message: 'Server error generating certificate' });
  }
});

// Get single certificate by ID
router.get('/:certificateId', auth, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.certificateId)
      .populate('donationId', 'urgency recipientName location')
      .populate('donorId', 'name email bloodGroup');

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    // Check ownership or admin
    if (certificate.donorId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    certificate.viewCount += 1;
    await certificate.save();

    res.json(certificate);
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle share status for public viewing
router.post('/:certificateId/share', auth, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.certificateId);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    if (certificate.donorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    certificate.isPublic = !certificate.isPublic;
    certificate.sharedOn = certificate.isPublic ? new Date() : null;
    await certificate.save();

    res.json({
      message: certificate.isPublic ? 'Certificate shared publicly' : 'Certificate marked private',
      isPublic: certificate.isPublic
    });
  } catch (error) {
    console.error('Error sharing certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download printable high-resolution HTML certificate
router.get('/:certificateId/download', auth, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.certificateId)
      .populate('donorId', 'name email bloodGroup');

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    if (certificate.donorId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    certificate.downloadCount += 1;
    await certificate.save();

    const certificateHTML = generateCertificateHTML(certificate);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bloodnet-certificate-${certificate.certificateNumber}.html"`);
    res.send(certificateHTML);
  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to generate clean, standard printable certificate HTML
function generateCertificateHTML(cert) {
  const donationDateStr = cert.donationDate
    ? new Date(cert.donationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Verified Date';
  const issueDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = cert.certificateTitle || 'Certificate of Appreciation';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${cert.donorName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Playfair+Display:ital,wght@0,600;0,800;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #1e293b;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }

    .cert-frame {
      width: 100%;
      max-width: 1020px;
      background: #ffffff;
      border: 12px double #991b1b;
      padding: 38px 48px;
      position: relative;
      box-shadow: 0 15px 35px rgba(0,0,0,0.12);
      border-radius: 4px;
      overflow: hidden;
    }

    .cert-frame::before {
      content: '';
      position: absolute;
      inset: 8px;
      border: 2px solid #d97706;
      pointer-events: none;
    }

    .cert-corner {
      position: absolute;
      width: 32px;
      height: 32px;
      border-color: #991b1b;
      border-style: solid;
      pointer-events: none;
    }
    .top-left { top: 14px; left: 14px; border-width: 4px 0 0 4px; }
    .top-right { top: 14px; right: 14px; border-width: 4px 4px 0 0; }
    .bottom-left { bottom: 14px; left: 14px; border-width: 0 0 4px 4px; }
    .bottom-right { bottom: 14px; right: 14px; border-width: 0 4px 4px 0; }

    .cert-header {
      text-align: center;
      margin-bottom: 20px;
    }

    .cert-badge {
      display: inline-block;
      padding: 4px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #b91c1c;
      margin-bottom: 10px;
    }

    .cert-title {
      font-family: 'Cinzel', serif;
      font-size: 38px;
      font-weight: 900;
      color: #881337;
      letter-spacing: 3px;
      text-transform: uppercase;
      line-height: 1.1;
      margin-bottom: 6px;
    }

    .cert-subtitle {
      font-size: 14px;
      color: #64748b;
      letter-spacing: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .cert-body {
      text-align: center;
      margin: 24px 0;
    }

    .presented-text {
      font-size: 15px;
      color: #64748b;
      font-style: italic;
      margin-bottom: 8px;
    }

    .donor-name {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      font-weight: 800;
      color: #1e1b4b;
      text-transform: uppercase;
      letter-spacing: 2px;
      display: inline-block;
      border-bottom: 3px solid #d97706;
      padding: 0 24px 8px 24px;
      margin-bottom: 12px;
    }

    .appreciation-para {
      max-width: 760px;
      margin: 0 auto 24px;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }

    .cert-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      max-width: 860px;
      margin: 0 auto 24px;
    }

    .stat-box {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      padding: 10px 14px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #9f1239;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
      margin-top: 2px;
    }

    .cert-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px dashed #cbd5e1;
    }

    .footer-col {
      flex: 1;
      text-align: center;
    }

    .signature-line {
      width: 180px;
      border-bottom: 2px solid #475569;
      margin: 0 auto 6px auto;
    }

    .sign-name {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
    }

    .sign-title {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
    }

    .seal-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .seal-circle {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: linear-gradient(135deg, #b91c1c, #881337);
      border: 3px solid #fbbf24;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
      box-shadow: 0 4px 12px rgba(185, 28, 28, 0.35);
    }

    .seal-text-top {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #fef08a;
    }

    .seal-text-main {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .qr-img {
      width: 64px;
      height: 64px;
      margin-bottom: 4px;
      border: 1px solid #e2e8f0;
      padding: 2px;
      border-radius: 4px;
    }

    .cert-meta {
      font-size: 9px;
      color: #64748b;
      line-height: 1.4;
    }

    @media print {
      body {
        padding: 0;
        background: white;
      }
      .cert-frame {
        box-shadow: none;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div class="cert-corner top-left"></div>
    <div class="cert-corner top-right"></div>
    <div class="cert-corner bottom-left"></div>
    <div class="cert-corner bottom-right"></div>

    <div class="cert-header">
      <span class="cert-badge">Official BloodNet+ Award</span>
      <h1 class="cert-title">${title}</h1>
      <p class="cert-subtitle">Recognizing Voluntary Life-Saving Blood Donation</p>
    </div>

    <div class="cert-body">
      <p class="presented-text">This certificate is proudly awarded to</p>
      <div class="donor-name">${cert.donorName}</div>
      <p class="appreciation-para">
        ${cert.impactMessage}
      </p>

      <div class="cert-stats-grid">
        <div class="stat-box">
          <div class="stat-label">Blood Group</div>
          <div class="stat-value">${cert.bloodGroup}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Units Donated</div>
          <div class="stat-value">${cert.unitsDonated || 1} Unit(s)</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Estimated Lives Saved</div>
          <div class="stat-value">${cert.livesSaved || 3} Lives</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Donation Date</div>
          <div class="stat-value">${donationDateStr}</div>
        </div>
      </div>
    </div>

    <div class="cert-footer">
      <div class="footer-col">
        <div class="signature-line"></div>
        <div class="sign-name">Dr. R. K. Sanas, MD</div>
        <div class="sign-title">Medical Director • BloodNet+</div>
      </div>

      <div class="footer-col seal-wrap">
        <div class="seal-circle">
          <span class="seal-text-top">OFFICIAL</span>
          <span class="seal-text-main">VERIFIED</span>
          <span class="seal-text-top">BLOODNET</span>
        </div>
      </div>

      <div class="footer-col qr-container">
        ${cert.qrCode ? `<img src="${cert.qrCode}" class="qr-img" alt="Certificate QR" />` : ''}
        <div class="cert-meta">
          <strong>No:</strong> ${cert.certificateNumber}<br />
          <strong>Issued:</strong> ${issueDateStr}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = router;
