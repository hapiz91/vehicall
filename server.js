const express = require('express');
const path = require('path');
const QRCode = require('qrcode');

const app = express();

app.use(express.json());

// Home page -> login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static('public'));

// Temporary in-memory storage
const users = [];

// Generate unique QR ID automatically
function generateQrId(vehicleNumber) {
  const cleanVehicle = vehicleNumber.replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VHCL-${cleanVehicle}-${randomPart}`;
}

// Format alert text
function formatAlert(type) {
  switch (type) {
    case 'EMERGENCY':
      return '🚨 Emergency / Accident';
    case 'BLOCKING':
      return '🚗 Your Car is Blocking';
    case 'LIGHTS_ON':
      return '💡 Lights ON';
    case 'NOT_LOCKED':
      return '🔓 Vehicle Not Locked';
    case 'NEED_ATTENTION':
      return '⚠️ Vehicle Needs Attention';
    default:
      return type;
  }
}

// Register user
app.post('/register', (req, res) => {
  let {
    name,
    mobile,
    vehicleNumber,
    password,
    consentAccepted,
    consentAcceptedAt,
    acceptedDocuments
  } = req.body;

  if (!name || !mobile || !vehicleNumber || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!consentAccepted) {
    return res.status(400).json({
      message: 'You must accept Privacy Policy, Terms & Conditions, and WhatsApp Consent to register'
    });
  }

  vehicleNumber = vehicleNumber.toUpperCase().trim();

  const existingUser = users.find(
    (u) => u.vehicleNumber.toUpperCase() === vehicleNumber
  );

  if (existingUser) {
    return res.status(400).json({ message: 'Vehicle number already registered' });
  }

  const qr_id = generateQrId(vehicleNumber);

  const newUser = {
    name,
    mobile,
    vehicleNumber,
    password,

    plan: '',
    billingCycle: '',
    packageSaved: false,

    qr_id,
    qr_generated: false,

    paymentStatus: 'pending',

    consentAccepted: true,
    consentAcceptedAt: consentAcceptedAt || new Date().toISOString(),
    acceptedDocuments: acceptedDocuments || [
      'Privacy Policy',
      'Terms & Conditions',
      'WhatsApp & Notification Consent'
    ],

    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  res.json({
    message: 'Registration successful',
    vehicleNumber,
    qr_id,
    plan: ''
  });
});

// Login user
app.post('/login', (req, res) => {
  let { vehicleNumber, password } = req.body;

  if (!vehicleNumber || !password) {
    return res.status(400).json({
      message: 'Vehicle number and password are required'
    });
  }

  vehicleNumber = vehicleNumber.toUpperCase().trim();

  const user = users.find(
    (u) =>
      u.vehicleNumber.toUpperCase() === vehicleNumber &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: 'Invalid vehicle number or password'
    });
  }

  res.json({
    message: 'Login successful',
    vehicleNumber: user.vehicleNumber,
    name: user.name,
    plan: user.plan,
    billingCycle: user.billingCycle,
    qr_id: user.qr_id,
    packageSaved: user.packageSaved,
    qr_generated: user.qr_generated
  });
});

// Save / update package
app.post('/update-plan', (req, res) => {
  let { vehicleNumber, plan, billingCycle } = req.body;

  if (!vehicleNumber || !plan) {
    return res.status(400).json({
      message: 'Vehicle number and plan are required'
    });
  }

  vehicleNumber = vehicleNumber.toUpperCase().trim();

  const user = users.find(
    (u) => u.vehicleNumber.toUpperCase() === vehicleNumber
  );

  if (!user) {
    return res.status(404).json({
      message: 'Vehicle owner not found'
    });
  }

  user.plan = plan;
  user.billingCycle = billingCycle || 'monthly';
  user.packageSaved = true;

  res.json({
    message: 'Package saved successfully',
    user
  });
});

// Generate QR image
app.post('/generate-qr', async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({
        message: 'Vehicle number is required'
      });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const user = users.find(
      (u) => u.vehicleNumber.toUpperCase() === vehicleNumber
    );

    if (!user) {
      return res.status(404).json({
        message: 'Vehicle owner not found'
      });
    }

    if (!user.packageSaved || !user.plan) {
      return res.status(400).json({
        message: 'Please save package first'
      });
    }

    // FUTURE PAYMENT RULE - KEEP COMMENTED FOR NOW
    /*
    if (!user.paymentStatus || user.paymentStatus !== 'paid') {
      return res.status(400).json({
        message: 'Payment required before generating QR'
      });
    }
    */

    const alertUrl = `${req.protocol}://${req.get('host')}/alert.html?qr=${user.qr_id}`;

    const qrImage = await QRCode.toDataURL(alertUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0B1F3A',
        light: '#FFFFFF'
      }
    });

    user.qr_generated = true;

    res.json({
      message: 'QR generated successfully',
      qr_id: user.qr_id,
      qrImage
    });
  } catch (error) {
    console.error('QR generate error:', error);
    res.status(500).json({
      message: 'Error generating QR'
    });
  }
});

// Send alert
app.post('/send-alert', (req, res) => {
  const { qr_id, alert_type } = req.body;

  if (!qr_id || !alert_type) {
    return res.status(400).json({
      message: 'QR ID and alert type are required'
    });
  }

  const user = users.find((u) => u.qr_id === qr_id);

  if (!user) {
    return res.status(404).json({
      message: 'No active vehicle found for this QR'
    });
  }

  const now = new Date().toLocaleString();

  const alertMessage = `Vehicall Alert

Vehicle: ${user.vehicleNumber}
Issue: ${formatAlert(alert_type)}
Time: ${now}`;

  console.log('==============================');
  console.log('Vehicall Alert');
  console.log('Vehicle:', user.vehicleNumber);
  console.log('QR:', qr_id);
  console.log('Type:', formatAlert(alert_type));
  console.log('Send to:', user.mobile);
  console.log('Time:', now);
  console.log('==============================');

  res.json({
    message: alertMessage
  });
});

// Debug users
app.get('/debug-users', (req, res) => {
  res.json(users);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});