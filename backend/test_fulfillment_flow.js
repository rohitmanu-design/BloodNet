require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Request = require('./models/Request');
const BloodInventory = require('./models/BloodInventory');
const InventoryLog = require('./models/InventoryLog');
const User = require('./models/User');

const {
  respondToRequest,
  selectFulfillmentOption,
  updateRequestStatus
} = require('./controllers/requestController');

// Helper to mock express req/res
function mockReqRes(reqData) {
  const req = {
    params: reqData.params || {},
    body: reqData.body || {},
    user: reqData.user || {},
    headers: {}
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('--- STARTING VERIFICATION OF ALL 6 TEST CASES ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Find or create test entities
  let recipient = await User.findOne({ role: 'recipient' });
  if (!recipient) {
    recipient = await User.create({
      name: 'Test Recipient',
      email: 'test_recip_' + Date.now() + '@example.com',
      password: 'password123',
      role: 'recipient',
      phone: '9876543210'
    });
  }

  let donor1 = await User.findOne({ role: 'donor' });
  if (!donor1) {
    donor1 = await User.create({
      name: 'Test Donor 1',
      email: 'test_donor1_' + Date.now() + '@example.com',
      password: 'password123',
      role: 'donor',
      phone: '9876543211',
      bloodGroup: 'B+'
    });
  }

  let donor2 = await User.findOne({ role: 'donor', _id: { $ne: donor1._id } });
  if (!donor2) {
    donor2 = await User.create({
      name: 'Test Donor 2',
      email: 'test_donor2_' + Date.now() + '@example.com',
      password: 'password123',
      role: 'donor',
      phone: '9876543212',
      bloodGroup: 'B+'
    });
  }

  let hospital = await User.findOne({ role: 'hospital' });
  if (!hospital) {
    hospital = await User.create({
      name: 'Test Hospital',
      hospitalName: 'Apollo Care Test Hospital',
      email: 'test_hosp_' + Date.now() + '@example.com',
      password: 'password123',
      role: 'hospital',
      phone: '9876543213',
      address: 'Test City, 412803'
    });
  }

  // Ensure hospital has inventory for testing
  await BloodInventory.findOneAndUpdate(
    { hospitalId: hospital._id, bloodGroup: 'B+' },
    { $set: { unitsAvailable: 10, unitsReserved: 0, lastUpdated: new Date() } },
    { upsert: true }
  );

  await BloodInventory.findOneAndUpdate(
    { hospitalId: hospital._id, bloodGroup: 'AB-' },
    { $set: { unitsAvailable: 0, unitsReserved: 0, lastUpdated: new Date() } },
    { upsert: true }
  );

  console.log(`Entities ready: Recipient (${recipient._id}), Donor1 (${donor1._id}), Donor2 (${donor2._id}), Hospital (${hospital._id})`);

  // =========================================================================
  // CASE 1: Donor accepts first -> Hospital can STILL accept
  // =========================================================================
  console.log('\n--- CASE 1: Donor accepts first -> Hospital can still accept ---');
  const req1 = await Request.create({
    requesterId: recipient._id,
    bloodGroup: 'B+',
    unitsNeeded: 1,
    urgency: 'urgent',
    location: { address: 'Wai, Satara, 412803' }
  });

  // Donor accepts first
  const donorResp1 = mockReqRes({
    params: { requestId: req1._id.toString() },
    body: { response: 'accepted', message: 'I can donate!' },
    user: { id: donor1._id.toString(), role: 'donor' }
  });
  await respondToRequest(donorResp1.req, donorResp1.res);
  console.log('Donor 1 acceptance status:', donorResp1.getStatus(), donorResp1.getData()?.message);

  let updatedReq1 = await Request.findById(req1._id);
  console.log('Request status after donor response:', updatedReq1.status);
  console.log('Number of responses so far:', updatedReq1.responses.length);

  // Hospital attempts to accept AFTER donor accepted
  const hospResp1 = mockReqRes({
    params: { requestId: req1._id.toString() },
    body: { response: 'accepted', message: 'Hospital has units ready' },
    user: { id: hospital._id.toString(), role: 'hospital' }
  });
  await respondToRequest(hospResp1.req, hospResp1.res);
  console.log('Hospital acceptance status:', hospResp1.getStatus(), hospResp1.getData()?.message);

  updatedReq1 = await Request.findById(req1._id);
  console.log('Responses count after hospital accepted:', updatedReq1.responses.length);
  const hospInReq1 = updatedReq1.responses.find(r => r.responderType === 'hospital');
  console.log('Hospital response recorded:', Boolean(hospInReq1), 'unitsReserved:', hospInReq1?.unitsReserved);

  const invAfterHosp1 = await BloodInventory.findOne({ hospitalId: hospital._id, bloodGroup: 'B+' });
  console.log('Hospital B+ stock: available =', invAfterHosp1.unitsAvailable, 'reserved =', invAfterHosp1.unitsReserved);

  if (donorResp1.getStatus() === 200 && hospResp1.getStatus() === 200 && updatedReq1.responses.length === 2 && invAfterHosp1.unitsReserved === 1) {
    console.log('>>> CASE 1 PASSED: Hospital successfully accepted after donor had already accepted!');
  } else {
    throw new Error('CASE 1 FAILED');
  }

  // =========================================================================
  // CASE 2: Hospital accepts first -> Donor can STILL accept
  // =========================================================================
  console.log('\n--- CASE 2: Hospital accepts first -> Donor can still accept ---');
  const req2 = await Request.create({
    requesterId: recipient._id,
    bloodGroup: 'B+',
    unitsNeeded: 1,
    urgency: 'emergency',
    location: { address: 'Wai, Satara, 412803' }
  });

  // Hospital accepts first
  const hospResp2 = mockReqRes({
    params: { requestId: req2._id.toString() },
    body: { response: 'accepted' },
    user: { id: hospital._id.toString(), role: 'hospital' }
  });
  await respondToRequest(hospResp2.req, hospResp2.res);
  console.log('Hospital response status:', hospResp2.getStatus());

  // Donor accepts second
  const donorResp2 = mockReqRes({
    params: { requestId: req2._id.toString() },
    body: { response: 'accepted' },
    user: { id: donor1._id.toString(), role: 'donor' }
  });
  await respondToRequest(donorResp2.req, donorResp2.res);
  console.log('Donor response status:', donorResp2.getStatus());

  const updatedReq2 = await Request.findById(req2._id);
  console.log('Responses on req2:', updatedReq2.responses.length);
  if (hospResp2.getStatus() === 200 && donorResp2.getStatus() === 200 && updatedReq2.responses.length === 2) {
    console.log('>>> CASE 2 PASSED: Donor accepted after hospital accepted first!');
  } else {
    throw new Error('CASE 2 FAILED');
  }

  // =========================================================================
  // CASE 3: Multiple donors respond -> All recorded separately
  // =========================================================================
  console.log('\n--- CASE 3: Multiple donors respond ---');
  const donor2Resp = mockReqRes({
    params: { requestId: req2._id.toString() },
    body: { response: 'accepted' },
    user: { id: donor2._id.toString(), role: 'donor' }
  });
  await respondToRequest(donor2Resp.req, donor2Resp.res);
  console.log('Donor 2 response status:', donor2Resp.getStatus());

  const updatedReq2Multi = await Request.findById(req2._id);
  console.log('Responses count on req2 (Hospital + 2 Donors):', updatedReq2Multi.responses.length);
  if (updatedReq2Multi.responses.length === 3) {
    console.log('>>> CASE 3 PASSED: Multiple donors recorded separately!');
  } else {
    throw new Error('CASE 3 FAILED');
  }

  // =========================================================================
  // CASE 4: Insufficient hospital stock -> Blocked with 409
  // =========================================================================
  console.log('\n--- CASE 4: Insufficient hospital stock ---');
  const reqEmpty = await Request.create({
    requesterId: recipient._id,
    bloodGroup: 'AB-', // Available is 0
    unitsNeeded: 2,
    urgency: 'routine',
    location: { address: 'Wai, Satara, 412803' }
  });

  const hospEmptyResp = mockReqRes({
    params: { requestId: reqEmpty._id.toString() },
    body: { response: 'accepted' },
    user: { id: hospital._id.toString(), role: 'hospital' }
  });
  await respondToRequest(hospEmptyResp.req, hospEmptyResp.res);
  console.log('Empty stock hospital response status:', hospEmptyResp.getStatus(), hospEmptyResp.getData()?.code);
  if (hospEmptyResp.getStatus() === 409 && hospEmptyResp.getData()?.code === 'INSUFFICIENT_STOCK') {
    console.log('>>> CASE 4 PASSED: Insufficient stock correctly blocked with 409 INSUFFICIENT_STOCK!');
  } else {
    throw new Error('CASE 4 FAILED');
  }

  // =========================================================================
  // CASE 5: Recipient chooses one response -> Selected marked, others cancelled, stock released
  // =========================================================================
  console.log('\n--- CASE 5: Recipient chooses one response (Donor chosen over Hospital) ---');
  // On req1, we had donor1 and hospital. Let recipient choose donor1!
  const selectDonorChoice = mockReqRes({
    params: { requestId: req1._id.toString() },
    body: { responderId: donor1._id.toString(), responderType: 'donor' },
    user: { id: recipient._id.toString(), role: 'recipient' }
  });
  await selectFulfillmentOption(selectDonorChoice.req, selectDonorChoice.res);
  console.log('Select fulfillment status:', selectDonorChoice.getStatus());

  const req1Chosen = await Request.findById(req1._id);
  console.log('Fulfillment chosen:', req1Chosen.fulfillmentChosen);
  console.log('Selected responder:', req1Chosen.selectedResponderType, req1Chosen.selectedResponderId);

  const donor1RespStatus = req1Chosen.responses.find(r => r.responderId.toString() === donor1._id.toString())?.status;
  const hospitalRespStatus = req1Chosen.responses.find(r => r.responderId.toString() === hospital._id.toString())?.status;
  console.log('Donor 1 status:', donor1RespStatus, '| Hospital status:', hospitalRespStatus);

  const invAfterDonorChosen = await BloodInventory.findOne({ hospitalId: hospital._id, bloodGroup: 'B+' });
  console.log('Hospital B+ stock after unselected release: available =', invAfterDonorChosen.unitsAvailable, 'reserved =', invAfterDonorChosen.unitsReserved);

  // Attempting to select AGAIN should be blocked
  const duplicateChoice = mockReqRes({
    params: { requestId: req1._id.toString() },
    body: { responderId: hospital._id.toString(), responderType: 'hospital' },
    user: { id: recipient._id.toString(), role: 'recipient' }
  });
  await selectFulfillmentOption(duplicateChoice.req, duplicateChoice.res);
  console.log('Duplicate selection attempt status (should be 400):', duplicateChoice.getStatus());

  if (
    selectDonorChoice.getStatus() === 200 &&
    req1Chosen.fulfillmentChosen === true &&
    donor1RespStatus === 'selected' &&
    hospitalRespStatus === 'cancelled' &&
    invAfterDonorChosen.unitsReserved === 1 && // 1 reserved from req2, req1 reserved unit refunded!
    duplicateChoice.getStatus() === 400
  ) {
    console.log('>>> CASE 5 PASSED: Recipient choice locks request, cancels other responders, refunds unselected stock, and blocks additional choices!');
  } else {
    throw new Error('CASE 5 FAILED');
  }

  // =========================================================================
  // CASE 6: Request cancelled -> Reserved stock released safely
  // =========================================================================
  console.log('\n--- CASE 6: Request cancelled -> Reserved stock released safely ---');
  // req2 still has a hospital reservation
  const invBeforeCancel = await BloodInventory.findOne({ hospitalId: hospital._id, bloodGroup: 'B+' });
  console.log('Stock before cancel: reserved =', invBeforeCancel.unitsReserved, 'available =', invBeforeCancel.unitsAvailable);

  const cancelReq = mockReqRes({
    params: { requestId: req2._id.toString() },
    body: { status: 'cancelled' },
    user: { id: recipient._id.toString(), role: 'recipient' }
  });
  await updateRequestStatus(cancelReq.req, cancelReq.res);
  console.log('Cancel request status:', cancelReq.getStatus());

  const invAfterCancel = await BloodInventory.findOne({ hospitalId: hospital._id, bloodGroup: 'B+' });
  console.log('Stock after cancel: reserved =', invAfterCancel.unitsReserved, 'available =', invAfterCancel.unitsAvailable);

  if (cancelReq.getStatus() === 200 && invAfterCancel.unitsReserved === 0 && invAfterCancel.unitsAvailable === 10) {
    console.log('>>> CASE 6 PASSED: Request cancellation safely released all reserved units back to available stock!');
  } else {
    throw new Error('CASE 6 FAILED');
  }

  // Clean up test documents
  await Request.deleteMany({ _id: { $in: [req1._id, req2._id, reqEmpty._id] } });
  console.log('\n✓ Cleaned up test requests.');
  console.log('\nALL 6 VERIFICATION CASES PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nVerification Error:', err);
  process.exit(1);
});
