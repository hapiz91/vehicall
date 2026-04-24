const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { db } = require('./firebase');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static('public'));

const plans = {
  Basic: { validityMonths: 3, alertsLimit: 3, contactsLimit: 1, locationEnabled: false, price: 1 },
  Plus: {
    monthly: { validityMonths: 1, price: 0.5 },
    yearly: { validityMonths: 12, price: 5 },
    alertsLimit: 10,
    contactsLimit: 2,
    locationEnabled: true
  },
  Premium: {
    monthly: { validityMonths: 1, price: 1 },
    yearly: { validityMonths: 12, price: 10 },
    alertsLimit: 30,
    contactsLimit: 3,
    locationEnabled: true
  }
};

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function getPlanDetails(plan, billingCycle) {
  if (plan === 'Basic') {
    return {
      price: plans.Basic.price,
      validityMonths: plans.Basic.validityMonths,
      alertsLimit: plans.Basic.alertsLimit,
      contactsLimit: plans.Basic.contactsLimit,
      locationEnabled: plans.Basic.locationEnabled
    };
  }

  const cycle = billingCycle || 'monthly';
  return {
    price: plans[plan][cycle].price,
    validityMonths: plans[plan][cycle].validityMonths,
    alertsLimit: plans[plan].alertsLimit,
    contactsLimit: plans[plan].contactsLimit,
    locationEnabled: plans[plan].locationEnabled
  };
}

function generateQrId(vehicleNumber) {
  const cleanVehicle = vehicleNumber.replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VHCL-${cleanVehicle}-${randomPart}`;
}

function formatAlert(type) {
  switch (type) {
    case 'EMERGENCY': return '🚨 Emergency / Accident';
    case 'BLOCKING': return '🚗 Your Car is Blocking';
    case 'LIGHTS_ON': return '💡 Lights ON';
    case 'NOT_LOCKED': return '🔓 Vehicle Not Locked';
    case 'NEED_ATTENTION': return '⚠️ Vehicle Needs Attention';
    default: return type;
  }
}

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
      return res.status(400).json({ message: 'Consent required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const existingUser = await userRef.get();

    if (existingUser.exists) {
      return res.status(400).json({ message: 'Vehicle already registered' });
    }

    const qr_id = generateQrId(vehicleNumber);

    await userRef.set({
      name,
      mobile,
      vehicleNumber,
      password,
      qr_id,
      qr_generated: false,
      alertUrl: '',
      plan: '',
      billingCycle: '',
      packageSaved: false,
      paymentStatus: 'pending',
      alertsUsed: 0,
      alertsLimit: 0,
      planStart: null,
      planEnd: null,
      contactsLimit: 1,
      locationEnabled: false,
      consentAccepted: true,
      consentAcceptedAt: consentAcceptedAt || new Date().toISOString(),
      acceptedDocuments: acceptedDocuments || [],
      createdAt: new Date().toISOString()
    });

    res.json({
      message: 'Registration successful',
      vehicleNumber,
      qr_id,
      plan: ''
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Register error' });
  }
});

app.post('/login', async (req, res) => {
  try {
    let { vehicleNumber, password } = req.body;

    if (!vehicleNumber || !password) {
      return res.status(400).json({ message: 'Vehicle number and password are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userDoc = await db.collection('users').doc(vehicleNumber).get();

    if (!userDoc.exists) {
      return res.status(401).json({ message: 'Invalid login' });
    }

    const user = userDoc.data();

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid login' });
    }

    res.json(user);

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login error' });
  }
});

app.get('/owner/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = req.params.vehicleNumber.toUpperCase().trim();
    const userDoc = await db.collection('users').doc(vehicleNumber).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    res.json(userDoc.data());

  } catch (err) {
    console.error('Owner error:', err);
    res.status(500).json({ message: 'Owner data error' });
  }
});

app.get('/owner-alerts/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = req.params.vehicleNumber.toUpperCase().trim();

    const snapshot = await db.collection('alerts')
      .where('vehicleNumber', '==', vehicleNumber)
      .limit(10)
      .get();

    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(alerts);

  } catch (err) {
    console.error('Alerts fetch error:', err);
    res.status(500).json({ message: 'Alerts error' });
  }
});

app.post('/update-plan', async (req, res) => {
  try {
    let { vehicleNumber, plan, billingCycle } = req.body;

    if (!vehicleNumber || !plan) {
      return res.status(400).json({ message: 'Vehicle number and plan are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    if (!plans[plan]) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    if (plan === 'Basic') {
      billingCycle = '3-months';
    } else {
      billingCycle = billingCycle || 'monthly';
    }

    const detail = getPlanDetails(plan, billingCycle);
    const now = new Date().toISOString();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    await userRef.update({
      plan,
      billingCycle,
      packageSaved: true,
      paymentStatus: 'pending',
      price: detail.price,
      alertsLimit: detail.alertsLimit,
      alertsUsed: 0,
      contactsLimit: detail.contactsLimit,
      locationEnabled: detail.locationEnabled,
      planStart: now,
      planEnd: addMonths(now, detail.validityMonths),
      packageSavedAt: now,
      lastRenewedAt: now
    });

    const updated = await userRef.get();

    res.json({
      message: 'Package updated successfully',
      user: updated.data()
    });

  } catch (err) {
    console.error('Plan update error:', err);
    res.status(500).json({ message: 'Plan update error' });
  }
});

app.post('/generate-qr', async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    const user = userDoc.data();

    if (!user.packageSaved || !user.plan) {
      return res.status(400).json({ message: 'Please save package first' });
    }

    const alertUrl = `${req.protocol}://${req.get('host')}/alert.html?qr=${user.qr_id}`;

    const qrImage = await QRCode.toDataURL(alertUrl, {
      width: 360,
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

  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ message: 'QR generation error' });
  }
});

app.post('/send-alert', async (req, res) => {
  try {
    const { qr_id, alert_type } = req.body;

    if (!qr_id || !alert_type) {
      return res.status(400).json({ message: 'QR ID and alert type are required' });
    }

    const snapshot = await db.collection('users')
      .where('qr_id', '==', qr_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'No active vehicle found for this QR' });
    }

    const userRef = snapshot.docs[0].ref;
    const user = snapshot.docs[0].data();

    if (!user.qr_generated) {
      return res.status(400).json({ message: 'QR is not active yet' });
    }

    if (user.planEnd && new Date() > new Date(user.planEnd)) {
      return res.status(400).json({ message: 'Plan expired. Please renew.' });
    }

    if ((user.alertsUsed || 0) >= (user.alertsLimit || 0)) {
      return res.status(400).json({ message: 'Alert limit reached. Please renew or upgrade.' });
    }

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

    await userRef.update({
      alertsUsed: (user.alertsUsed || 0) + 1,
      lastAlertAt: new Date().toISOString()
    });

 res.json({
  message: alertMessage,
  vehicleNumber: user.vehicleNumber,
  issue: formatAlert(alert_type),
  mobile: user.mobile   // ✅ FIX
});

  } catch (err) {
    console.error('Alert error:', err);
    res.status(500).json({ message: 'Alert error' });
  }
});

app.get('/debug-users', async (req, res) => {
  const snapshot = await db.collection('users').get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

app.get('/debug-alerts', async (req, res) => {
  const snapshot = await db.collection('alerts').get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});