const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { db } = require('./firebase');

const app = express();

app.use(express.json());

// Home page -> login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static('public'));

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
app.post('/register', async (req, res) => {
  try {
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

    const userRef = db.collection('users').doc(vehicleNumber);
    const existingUser = await userRef.get();

    if (existingUser.exists) {
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

    await userRef.set(newUser);

    res.json({
      message: 'Registration successful',
      vehicleNumber,
      qr_id,
      plan: ''
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login user
app.post('/login', async (req, res) => {
  try {
    let { vehicleNumber, password } = req.body;

    if (!vehicleNumber || !password) {
      return res.status(400).json({
        message: 'Vehicle number and password are required'
      });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userDoc = await db.collection('users').doc(vehicleNumber).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        message: 'Invalid vehicle number or password'
      });
    }

    const user = userDoc.data();

    if (user.password !== password) {
      return res.status(401).json({
        message: 'Invalid vehicle number or password'
      });
    }

    res.json({
      message: 'Login successful',
      vehicleNumber: user.vehicleNumber,
      name: user.name,
      plan: user.plan || '',
      billingCycle: user.billingCycle || '',
      qr_id: user.qr_id,
      packageSaved: user.packageSaved || false,
      qr_generated: user.qr_generated || false
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Save / update package
app.post('/update-plan', async (req, res) => {
  try {
    let { vehicleNumber, plan, billingCycle } = req.body;

    if (!vehicleNumber || !plan) {
      return res.status(400).json({
        message: 'Vehicle number and plan are required'
      });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        message: 'Vehicle owner not found'
      });
    }

    await userRef.update({
      plan,
      billingCycle: billingCycle || 'monthly',
      packageSaved: true,
      packageSavedAt: new Date().toISOString()
    });

    const updatedUser = await userRef.get();

    res.json({
      message: 'Package saved successfully',
      user: updatedUser.data()
    });

  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ message: 'Server error while saving package' });
  }
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

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        message: 'Vehicle owner not found'
      });
    }

    const user = userDoc.data();

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

    await userRef.update({
      qr_generated: true,
      qrGeneratedAt: new Date().toISOString(),
      alertUrl
    });

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
app.post('/send-alert', async (req, res) => {
  try {
    const { qr_id, alert_type } = req.body;

    if (!qr_id || !alert_type) {
      return res.status(400).json({
        message: 'QR ID and alert type are required'
      });
    }

    const snapshot = await db.collection('users')
      .where('qr_id', '==', qr_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        message: 'No active vehicle found for this QR'
      });
    }

    const user = snapshot.docs[0].data();

    const now = new Date().toLocaleString();

    const alertMessage = `Vehicall Alert

Vehicle: ${user.vehicleNumber}
Issue: ${formatAlert(alert_type)}
Time: ${now}`;

    await db.collection('alerts').add({
      qr_id,
      vehicleNumber: user.vehicleNumber,
      ownerMobile: user.mobile,
      alertType: alert_type,
      alertLabel: formatAlert(alert_type),
      message: alertMessage,
      status: 'created',
      createdAt: new Date().toISOString()
    });

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

  } catch (error) {
    console.error('Send alert error:', error);
    res.status(500).json({ message: 'Server error while sending alert' });
  }
});

// Debug users
app.get('/debug-users', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Debug alerts
app.get('/debug-alerts', async (req, res) => {
  try {
    const snapshot = await db.collection('alerts')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(alerts);
  } catch (error) {
    console.error('Debug alerts error:', error);
    res.status(500).json({ message: 'Error fetching alerts' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});