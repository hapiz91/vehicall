const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { db } = require('./firebase');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'vehicall_admin_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 3
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) {
    return next();
  }
  return res.redirect('/admin-login.html');
}

const plans = {
  Welcome: {
    label: 'Welcome Plan',
    free: true,
    validityMonths: 2,
    alertsLimit: 3,
    contactsLimit: 1,
    locationEnabled: false,
    price: 0
  },
  Basic: {
    monthly: { validityMonths: 1, price: 0.3 },
    yearly: { validityMonths: 12, price: 2.5 },
    alertsLimit: 3,
    contactsLimit: 1,
    locationEnabled: false
  },
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
  if (plan === 'Welcome') {
    return {
      price: 0,
      validityMonths: plans.Welcome.validityMonths,
      alertsLimit: plans.Welcome.alertsLimit,
      contactsLimit: plans.Welcome.contactsLimit,
      locationEnabled: plans.Welcome.locationEnabled
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

function cleanMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '');
}

function makePrimaryContact(name, mobile) {
  return {
    name: name || 'Primary Contact',
    mobile: cleanMobile(mobile),
    active: true,
    primary: true
  };
}

function normalizeContacts(user) {
  if (Array.isArray(user.contacts) && user.contacts.length > 0) {
    return user.contacts;
  }

  return [
    makePrimaryContact(user.name, user.mobile)
  ];
}

/* REGISTER */
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
    mobile = cleanMobile(mobile);

    const userRef = db.collection('users').doc(vehicleNumber);
    const existingUser = await userRef.get();

    if (existingUser.exists) {
      return res.status(400).json({ message: 'Vehicle already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const qr_id = generateQrId(vehicleNumber);

    const now = new Date().toISOString();
    const welcomeDetails = getPlanDetails('Welcome', 'trial');

    await userRef.set({
      name,
      mobile,
      vehicleNumber,
      password: hashedPassword,

      qr_id,
      qr_generated: false,
      alertUrl: '',

      plan: 'Welcome',
      billingCycle: 'free-trial',
      packageSaved: true,
      paymentStatus: 'free-trial',

      price: 0,
      alertsUsed: 0,
      alertsLimit: welcomeDetails.alertsLimit,
      planStart: now,
      planEnd: addMonths(now, welcomeDetails.validityMonths),

      contactsLimit: welcomeDetails.contactsLimit,
      locationEnabled: false,
      contacts: [makePrimaryContact(name, mobile)],

      consentAccepted: true,
      consentAcceptedAt: consentAcceptedAt || now,
      acceptedDocuments: acceptedDocuments || [],

      accountType: 'individual',
      companyId: null,
      accountStatus: 'active',

      createdAt: now
    });

    res.json({
      message: 'Registration successful. Welcome Plan activated for 2 months.',
      vehicleNumber,
      qr_id,
      plan: 'Welcome'
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Register error' });
  }
});

/* LOGIN */
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
      return res.status(401).json({ message: 'Invalid login' });
    }

    const user = userDoc.data();

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ message: 'Your account is suspended. Please contact Vehicall support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid login' });
    }

    res.json(user);

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login error' });
  }
});

/* OWNER DATA */
app.get('/owner/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = req.params.vehicleNumber.toUpperCase().trim();
    const userDoc = await db.collection('users').doc(vehicleNumber).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    const user = userDoc.data();
    user.contacts = normalizeContacts(user);

    res.json(user);

  } catch (err) {
    console.error('Owner error:', err);
    res.status(500).json({ message: 'Owner data error' });
  }
});

/* RECENT ALERTS */
app.get('/owner-alerts/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = req.params.vehicleNumber.toUpperCase().trim();

    const snapshot = await db.collection('alerts')
      .where('vehicleNumber', '==', vehicleNumber)
      .limit(10)
      .get();

    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    alerts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(alerts);

  } catch (err) {
    console.error('Alerts fetch error:', err);
    res.status(500).json({ message: 'Alerts error' });
  }
});

/* UPDATE PLAN */
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

    if (plan === 'Welcome') {
      return res.status(400).json({ message: 'Welcome Plan is only for new registration' });
    }

    billingCycle = billingCycle || 'monthly';

    const detail = getPlanDetails(plan, billingCycle);
    const now = new Date().toISOString();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Vehicle owner not found' });
    }

    const oldUser = userDoc.data();
    const oldContacts = normalizeContacts(oldUser);
    const contactsAllowed = oldContacts.slice(0, detail.contactsLimit);

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
      contacts: contactsAllowed,
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

/* UPDATE CONTACTS */
app.post('/update-contacts', async (req, res) => {
  try {
    let { vehicleNumber, contacts } = req.body;

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
    const limit = user.contactsLimit || 1;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: 'Invalid contacts data' });
    }

    if (contacts.length > limit) {
      return res.status(400).json({
        message: `Your plan allows only ${limit} contact(s)`
      });
    }

    const cleanedContacts = contacts.map((c, index) => ({
      name: c.name || (index === 0 ? 'Primary Contact' : `Contact ${index + 1}`),
      mobile: cleanMobile(c.mobile),
      active: index === 0 ? true : !!c.active,
      primary: index === 0
    }));

    if (!cleanedContacts[0] || !cleanedContacts[0].mobile) {
      return res.status(400).json({ message: 'Primary contact is required' });
    }

    await userRef.update({
      contacts: cleanedContacts,
      mobile: cleanedContacts[0].mobile,
      contactsUpdatedAt: new Date().toISOString()
    });

    res.json({
      message: 'Contacts updated successfully',
      contacts: cleanedContacts
    });

  } catch (err) {
    console.error('Contact update error:', err);
    res.status(500).json({ message: 'Contact update error' });
  }
});

/* GENERATE QR */
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

/* SEND ALERT */
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

    const userRef = snapshot.docs[0].ref;
    const user = snapshot.docs[0].data();

    if (!user.qr_generated) {
      return res.status(400).json({ message: 'QR is not active yet' });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(400).json({
        message: 'This vehicle alert service is currently suspended.'
      });
    }

    if (user.planEnd && new Date() > new Date(user.planEnd)) {
      return res.status(400).json({ message: 'Plan expired. Please renew.' });
    }

    if ((user.alertsUsed || 0) >= (user.alertsLimit || 0)) {
      return res.status(400).json({
        message: 'Alert limit reached. Please renew or upgrade.'
      });
    }

    const contacts = normalizeContacts(user);
    const activeContacts = contacts.filter(c => c.primary || c.active);

    const now = new Date().toLocaleString();

    const alertMessage = `Vehicall Alert

Vehicle: ${user.vehicleNumber}
Issue: ${formatAlert(alert_type)}
Time: ${now}`;

    await db.collection('alerts').add({
      qr_id,
      vehicleNumber: user.vehicleNumber,
      ownerMobile: user.mobile,
      contacts: activeContacts,
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
      contacts: activeContacts,
      mobile: activeContacts[0]?.mobile || user.mobile
    });

  } catch (err) {
    console.error('Alert error:', err);
    res.status(500).json({ message: 'Alert error' });
  }
});

/* ADMIN LOGIN */
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUsername && password === adminPassword) {
      req.session.adminLoggedIn = true;
      req.session.adminUsername = username;

      return res.json({
        success: true,
        message: 'Admin login successful'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid admin login'
    });

  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Admin login error' });
  }
});

/* ADMIN LOGOUT */
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

/* ADMIN DASHBOARD DATA */
app.get('/admin/dashboard-data', requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const alertsSnapshot = await db.collection('alerts').get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const alerts = alertsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const totalUsers = users.length;
    const totalAlerts = alerts.length;
    const qrGenerated = users.filter(u => u.qr_generated).length;
    const expiredPlans = users.filter(u => u.planEnd && new Date() > new Date(u.planEnd)).length;

    const planCounts = {
      Welcome: users.filter(u => u.plan === 'Welcome').length,
      Basic: users.filter(u => u.plan === 'Basic').length,
      Plus: users.filter(u => u.plan === 'Plus').length,
      Premium: users.filter(u => u.plan === 'Premium').length
    };

    res.json({
      totalUsers,
      totalAlerts,
      qrGenerated,
      expiredPlans,
      planCounts,
      recentUsers: users
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10),
      recentAlerts: alerts
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10)
    });

  } catch (err) {
    console.error('Admin dashboard data error:', err);
    res.status(500).json({ message: 'Admin dashboard data error' });
  }
});

/* ADMIN USERS DATA */
app.get('/admin/users-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);

  } catch (err) {
    console.error('Admin users data error:', err);
    res.status(500).json({ message: 'Admin users data error' });
  }
});

/* ADMIN ALERT LOGS DATA */
app.get('/admin/alerts-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('alerts').get();

    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    alerts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(alerts);

  } catch (err) {
    console.error('Admin alerts data error:', err);
    res.status(500).json({ message: 'Admin alerts data error' });
  }
});

/* ADMIN QR MANAGEMENT DATA */
app.get('/admin/qr-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();

    const qrList = snapshot.docs.map(doc => {
      const user = doc.data();

      return {
        id: doc.id,
        vehicleNumber: user.vehicleNumber || doc.id,
        name: user.name || '',
        mobile: user.mobile || '',
        plan: user.plan || '',
        qr_id: user.qr_id || '',
        qr_generated: !!user.qr_generated,
        alertUrl: user.alertUrl || '',
        alertsUsed: user.alertsUsed || 0,
        alertsLimit: user.alertsLimit || 0,
        planEnd: user.planEnd || '',
        createdAt: user.createdAt || ''
      };
    });

    qrList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(qrList);

  } catch (err) {
    console.error('Admin QR data error:', err);
    res.status(500).json({ message: 'Admin QR data error' });
  }
});

/* ADMIN RESET USER ALERTS */
app.post('/admin/reset-alerts', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await userRef.update({
      alertsUsed: 0,
      alertsResetAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Alerts reset successfully'
    });

  } catch (err) {
    console.error('Admin reset alerts error:', err);
    res.status(500).json({ message: 'Reset alerts error' });
  }
});

/* ADMIN EXTEND USER PLAN */
app.post('/admin/extend-plan', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, months } = req.body;

    if (!vehicleNumber || !months) {
      return res.status(400).json({ message: 'Vehicle number and months are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();
    months = Number(months);

    if (months <= 0) {
      return res.status(400).json({ message: 'Invalid month value' });
    }

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userDoc.data();

    const baseDate = user.planEnd && new Date(user.planEnd) > new Date()
      ? user.planEnd
      : new Date().toISOString();

    const newPlanEnd = addMonths(baseDate, months);

    await userRef.update({
      planEnd: newPlanEnd,
      planExtendedAt: new Date().toISOString(),
      lastAdminAction: `Plan extended by ${months} month(s)`
    });

    res.json({
      success: true,
      message: `Plan extended by ${months} month(s)`,
      planEnd: newPlanEnd
    });

  } catch (err) {
    console.error('Admin extend plan error:', err);
    res.status(500).json({ message: 'Extend plan error' });
  }
});

/* ADMIN CHANGE USER PLAN */
app.post('/admin/change-plan', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, plan, billingCycle } = req.body;

    if (!vehicleNumber || !plan) {
      return res.status(400).json({ message: 'Vehicle number and plan are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    if (!plans[plan]) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    billingCycle = billingCycle || 'monthly';

    const detail = getPlanDetails(plan, billingCycle);
    const now = new Date().toISOString();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userDoc.data();
    const oldContacts = normalizeContacts(user);
    const contactsAllowed = oldContacts.slice(0, detail.contactsLimit);

    await userRef.update({
      plan,
      billingCycle,
      price: detail.price,
      alertsLimit: detail.alertsLimit,
      alertsUsed: 0,
      contactsLimit: detail.contactsLimit,
      locationEnabled: detail.locationEnabled,
      contacts: contactsAllowed,
      planStart: now,
      planEnd: addMonths(now, detail.validityMonths),
      paymentStatus: 'admin-updated',
      lastAdminAction: `Plan changed to ${plan}`
    });

    res.json({
      success: true,
      message: `Plan changed to ${plan}`
    });

  } catch (err) {
    console.error('Admin change plan error:', err);
    res.status(500).json({ message: 'Change plan error' });
  }
});

/* ADMIN UPDATE USER STATUS */
app.post('/admin/update-user-status', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, status } = req.body;

    if (!vehicleNumber || !status) {
      return res.status(400).json({ message: 'Vehicle number and status are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await userRef.update({
      accountStatus: status,
      statusUpdatedAt: new Date().toISOString(),
      lastAdminAction: `Account ${status}`
    });

    res.json({
      success: true,
      message: `User ${status} successfully`
    });

  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ message: 'Status update error' });
  }
});

/* ADMIN UPDATE QR STATUS */
app.post('/admin/update-qr-status', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, qrStatus } = req.body;

    if (!vehicleNumber || typeof qrStatus !== 'boolean') {
      return res.status(400).json({ message: 'Vehicle number and QR status are required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await userRef.update({
      qr_generated: qrStatus,
      qrStatusUpdatedAt: new Date().toISOString(),
      lastAdminAction: qrStatus ? 'QR activated' : 'QR disabled'
    });

    res.json({
      success: true,
      message: qrStatus ? 'QR activated successfully' : 'QR disabled successfully'
    });

  } catch (err) {
    console.error('Admin QR status update error:', err);
    res.status(500).json({ message: 'QR status update error' });
  }
});

/* ADMIN REGENERATE QR */
app.post('/admin/regenerate-qr', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newQrId = generateQrId(vehicleNumber);
    const alertUrl = `${req.protocol}://${req.get('host')}/alert.html?qr=${newQrId}`;

    await userRef.update({
      qr_id: newQrId,
      qr_generated: true,
      alertUrl,
      qrRegeneratedAt: new Date().toISOString(),
      lastAdminAction: 'QR regenerated'
    });

    res.json({
      success: true,
      message: 'QR regenerated successfully',
      qr_id: newQrId,
      alertUrl
    });

  } catch (err) {
    console.error('Admin regenerate QR error:', err);
    res.status(500).json({ message: 'Regenerate QR error' });
  }
});

/* RESET PASSWORD */
app.post('/reset-password', async (req, res) => {
  try {
    let { vehicleNumber, mobile, newPassword } = req.body;

    if (!vehicleNumber || !mobile || !newPassword) {
      return res.status(400).json({
        message: 'Vehicle number, mobile number and new password are required'
      });
    }

    vehicleNumber = vehicleNumber.toUpperCase().trim();
    mobile = cleanMobile(mobile);

    const userRef = db.collection('users').doc(vehicleNumber);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        message: 'Vehicle account not found'
      });
    }

    const user = userDoc.data();
    const registeredMobile = cleanMobile(user.mobile);

    if (registeredMobile !== mobile) {
      return res.status(401).json({
        message: 'Mobile number does not match registered vehicle account'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await userRef.update({
      password: hashedPassword,
      passwordResetAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });

  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({
      message: 'Password reset error'
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});