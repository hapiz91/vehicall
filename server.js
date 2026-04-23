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

// Register user
app.post('/register', (req, res) => {
  let { name, mobile, vehicleNumber, password } = req.body;

  if (!name || !mobile || !vehicleNumber || !password) {
    return res.status(400).json({ message: 'All fields are required' });
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
    qr_id,
    packageSaved: false,
    qr_generated: false,
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
    return res.status(400).json({ message: 'Vehicle number and password are required' });
  }

  vehicleNumber = vehicleNumber.toUpperCase().trim();

  const user = users.find(
    (u) =>
      u.vehicleNumber.toUpperCase() === vehicleNumber &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid vehicle number or password' });
  }

  res.json({
    message: 'Login successful',
    vehicleNumber: user.vehicleNumber,
    name: user.name,
    plan: user.plan,
    qr_id: user.qr_id,
    packageSaved: user.packageSaved,
    qr_generated: user.qr_generated
  });
});

// Update package
app.post('/update-plan', (req, res) => {
  let { vehicleNumber, plan } = req.body;

  if (!vehicleNumber || !plan) {
    return res.status(400).json({ message: 'Vehicle number and plan are required' });
  }

  vehicleNumber = vehicleNumber.toUpperCase().trim();

  const user = users.find(
    (u) => u.vehicleNumber.toUpperCase() === vehicleNumber
  );

  if (!user) {
    return res.status(404).json({ message: 'Vehicle owner not found' });
  }

  user.plan = plan;
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
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const user = users.find(
      (u) => u.vehicleNumber.toUpperCase() === vehicleNumber
    );

    if (!user) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    if (!user.packageSaved || !user.plan) {
      return res.status(400).json({ message: 'Please save package first' });
    }

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
    res.status(500).json({ message: 'Error generating QR' });
  }
});

// Send alert
app.post('/send-alert', (req, res) => {
  const { qr_id, alert_type } = req.body;

  if (!qr_id || !alert_type) {
    return res.status(400).json({ message: 'QR ID and alert type are required' });
  }

  const user = users.find((u) => u.qr_id === qr_id);

  if (!user) {
    return res.status(404).json({ message: 'No active vehicle found for this QR' });
  }

  console.log('🚗 Alert received');
  console.log('QR:', qr_id);
  console.log('Type:', alert_type);
  console.log('Send to:', user.mobile);

  res.json({
    message: `Alert sent to ${user.name}`
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