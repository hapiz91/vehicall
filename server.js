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

app.use(session({
  secret: process.env.SESSION_SECRET || 'vehicall_admin_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 3
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get("/parts", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "parts.html"));
});

app.get("/garage.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "garage.html"));
});

app.get("/fleet-management.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "fleet-management.html"));
});

app.get('/fleet-forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-forgot-password.html'));
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  return res.redirect('/admin-login.html');
}

app.get('/fleet-users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-users.html'));
});

function requireFleet(req, res, next) {
  if (req.session && req.session.fleetLoggedIn && req.session.fleetCompanyId) return next();

  return res.status(401).json({
    success: false,
    message: 'Fleet login required'
  });
}

/* PAGE ROUTES */
app.get('/fleet-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-register.html'));
});

app.get('/fleet-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-login.html'));
});

app.get('/fleet-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-dashboard.html'));
});

app.get('/fleet-vehicles', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-vehicles.html'));
});

app.get('/fleet-drivers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-drivers.html'));
});

app.get('/fleet-fuel-cards', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-fuel-cards.html'));
});

app.get('/fleet-fuel-statements', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-fuel-statements.html'));
});

app.get('/driver-trip', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver-trip.html'));
});

app.get('/driver-fuel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver-fuel.html'));
});

app.get('/fleet-assignments', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-assignments.html'));
});

app.get('/fleet-fuel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-fuel.html'));
});

app.get('/fleet-daily-trips', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-daily-trips.html'));
});

app.get('/fleet-checklist', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-checklist.html'));
});

app.get('/fleet-incidents', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-incidents.html'));
});

app.get('/fleet-fines', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-fines.html'));
});

app.get('/fleet-maintenance', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-maintenance.html'));
});

app.get('/fleet-reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-reports.html'));
});

app.get('/fleet-upgrade', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-upgrade.html'));
});

app.get('/admin-fleet', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-fleet.html'));
});


/* PLANS */
const plans = {
  Welcome: {
    label: 'Welcome Plan',
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

const fleetPackages = {
  starter: {
    label: 'Starter Fleet',
    vehicleLimit: 10,
    branchLimit: 1,
    managerLimit: 1
  },
  business: {
    label: 'Business Fleet',
    vehicleLimit: 50,
    branchLimit: 3,
    managerLimit: 5
  },
  enterprise: {
    label: 'Enterprise Fleet',
    vehicleLimit: 100,
    branchLimit: 10,
    managerLimit: 10
  }
};

/* HELPERS */
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

function getFleetPackageDetails(packageType) {
  return fleetPackages[packageType] || fleetPackages.starter;
}

function generateQrId(vehicleNumber) {
  const cleanVehicle = String(vehicleNumber || '').replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VHCL-${cleanVehicle}-${randomPart}`;
}

function generateFleetQrId(vehicleNumber) {
  const cleanVehicle = String(vehicleNumber || '').replace(/[^A-Z0-9]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FLT-${cleanVehicle}-${randomPart}`;
}

function cleanMobile(mobile) {
  return String(mobile || '').replace(/\D/g, '');
}

function normalizeVehicleNumber(vehicleNumber) {
  return String(vehicleNumber || '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/_/g, '-');
}

function buildOmanVehicleNumber(plateCode, plateNumber) {
  const code = String(plateCode || '').toUpperCase().trim();
  const number = String(plateNumber || '').replace(/\D/g, '').trim();
  if (!code || !number) return '';
  return `${code}-${number}`;
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
  if (Array.isArray(user.contacts) && user.contacts.length > 0) return user.contacts;
  return [makePrimaryContact(user.name, user.mobile)];
}

function formatAlert(type) {
  switch (type) {
    case 'EMERGENCY': return '🚨 Emergency / Accident';
    case 'BLOCKING': return '🚗 Your Car is Blocking';
    case 'LIGHTS_ON': return '💡 Lights ON';
    case 'NOT_LOCKED': return '🔓 Vehicle Not Locked';
    case 'NEED_ATTENTION': return '⚠️ Vehicle Needs Attention';
    case 'RASH_DRIVING': return '⚠️ Rash / Unsafe Driving';
    case 'WRONG_PARKING': return '🚫 Wrong Parking';
    case 'VEHICLE_DAMAGE': return '🔧 Vehicle Damage';
    case 'BREAKDOWN': return '🛠 Vehicle Breakdown';
    default: return type;
  }
}

function formatFleetAlert(type) {
  const fleetAlertTypes = {
    WRONG_PARKING: '🚫 Wrong / Unsafe Parking',
    BLOCKING_ACCESS: '🚗 Vehicle Blocking Access',
    RASH_DRIVING: '⚠️ Rash / Unsafe Driving',
    VEHICLE_DAMAGE: '🔧 Vehicle Damage Noticed',
    BREAKDOWN: '🛠 Vehicle Breakdown',
    EMERGENCY: '🚨 Emergency / Accident',
    DELIVERY_COMPLAINT: '📦 Delivery / Service Complaint',
    GENERAL_FEEDBACK: '💬 General Fleet Feedback'
  };

  return fleetAlertTypes[type] || null;
}
/* =========================================================
   PERSONAL SMART ALERT SYSTEM
========================================================= */

app.post('/register', async (req, res) => {
  try {
    let {
      name,
      mobile,
      plateCode,
      plateNumber,
      vehicleNumber,
      password,
      agreements
    } = req.body;

    vehicleNumber = buildOmanVehicleNumber(plateCode, plateNumber) || normalizeVehicleNumber(vehicleNumber);

    if (!name || !mobile || !vehicleNumber || !password) {
      return res.status(400).json({
        message: 'Name, mobile, plate code, plate number and password are required'
      });
    }

    if (
      !agreements ||
      agreements.privacyPolicy !== true ||
      agreements.termsConditions !== true ||
      agreements.consentLiability !== true
    ) {
      return res.status(400).json({
        message: 'All agreements must be accepted before registration.'
      });
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
  // USER DETAILS
  name,
  mobile,
  vehicleNumber,
  plateCode: plateCode || '',
  plateNumber: plateNumber || '',
  password: hashedPassword,

  // QR SYSTEM
  qr_id,
  qr_generated: false,
  alertUrl: '',

  // PLAN DETAILS
  plan: 'Welcome',
  billingCycle: 'free-trial',
  packageSaved: true,
  paymentStatus: 'free-trial',

  // PLAN LIMITS
  price: 0,
  alertsUsed: 0,
  alertsLimit: welcomeDetails.alertsLimit,

  // PLAN VALIDITY
  planStart: now,
  planEnd: addMonths(now, welcomeDetails.validityMonths),

  // CONTACT SYSTEM
  contactsLimit: welcomeDetails.contactsLimit,
  locationEnabled: false,
  contacts: [makePrimaryContact(name, mobile)],

  // AGREEMENT & COMPLIANCE
  agreements: {
    privacyPolicy: {
      accepted: true,
      acceptedAt: agreements.privacyPolicyAcceptedAt || now,
      version: agreements.agreementVersion || 'v1.0'
    },

    termsConditions: {
      accepted: true,
      acceptedAt: agreements.termsConditionsAcceptedAt || now,
      version: agreements.agreementVersion || 'v1.0'
    },

    consentLiability: {
      accepted: true,
      acceptedAt: agreements.consentLiabilityAcceptedAt || now,
      version: agreements.agreementVersion || 'v1.0'
    }
  },

  // TRA / AUDIT STRUCTURE
  compliance: {
    registrationSource: 'web',
    agreementVersion: agreements.agreementVersion || 'v1.0',
    country: 'Oman',
    dataUsePurpose: 'Vehicle QR alert notification service'
  },

  // ACCOUNT TYPE
  accountType: 'individual',
  companyId: null,
  accountStatus: 'active',

  // CREATED DATE
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

app.post('/login', async (req, res) => {
  try {
    let { vehicleNumber, password } = req.body;

    if (!vehicleNumber || !password) {
      return res.status(400).json({
        message: 'Vehicle number and password are required'
      });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

    const userDoc = await db.collection('users').doc(vehicleNumber).get();

    if (!userDoc.exists) {
      return res.status(401).json({ message: 'Invalid login' });
    }

    const user = userDoc.data();

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        message: 'Your account is suspended. Please contact Vehicall support.'
      });
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

app.get('/owner/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = normalizeVehicleNumber(req.params.vehicleNumber);
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

app.get('/owner-alerts/:vehicleNumber', async (req, res) => {
  try {
    const vehicleNumber = normalizeVehicleNumber(req.params.vehicleNumber);

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

app.post('/update-plan', async (req, res) => {
  try {
    let { vehicleNumber, plan, billingCycle } = req.body;

    if (!vehicleNumber || !plan) {
      return res.status(400).json({ message: 'Vehicle number and plan are required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/update-contacts', async (req, res) => {
  try {
    let { vehicleNumber, contacts } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/generate-qr', async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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
      source: 'personal',
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

app.post('/reset-password', async (req, res) => {
  try {
    let { vehicleNumber, mobile, newPassword } = req.body;

    if (!vehicleNumber || !mobile || !newPassword) {
      return res.status(400).json({
        message: 'Vehicle number, mobile number and new password are required'
      });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);
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
/* =========================================================
   FLEET MANAGEMENT SYSTEM
========================================================= */

app.post('/api/fleet/register', async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      mobile,
      email,
      password
    } = req.body;

    if (!companyName || !contactPerson || !mobile || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const existing = await db.collection('fleetCompanies')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        success: false,
        message: 'Fleet company already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const packageData = getFleetPackageDetails('starter');
    const now = new Date().toISOString();

    const companyRef = await db.collection('fleetCompanies').add({
      companyName,
      contactPerson,
      mobile: cleanMobile(mobile),
      email: email.toLowerCase().trim(),
      password: hashedPassword,

      packageType: 'starter',
      packageLabel: packageData.label,
      vehicleLimit: packageData.vehicleLimit,
      branchLimit: packageData.branchLimit,
      managerLimit: packageData.managerLimit,

      alertOption: 'without_alerts',
      alertsEnabled: false,

      usedVehicles: 0,
      activeDrivers: 0,

      paymentStatus: 'pending',
      status: 'pending',
      approved: false,

      createdAt: now
    });

    res.json({
      success: true,
      message: 'Fleet registration submitted successfully',
      companyId: companyRef.id
    });

  } catch (err) {
    console.error('Fleet register error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet registration error'
    });
  }
});

app.post('/api/fleet/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    email = String(email).toLowerCase().trim();

    const companySnapshot = await db.collection('fleetCompanies')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (companySnapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid fleet login'
      });
    }

    const companyDoc = companySnapshot.docs[0];
    const companyId = companyDoc.id;
    const company = companyDoc.data();

    const validPassword = await bcrypt.compare(password, company.password || '');

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid fleet login'
      });
    }

    if (company.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Fleet account suspended'
      });
    }

    if (company.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Fleet company dashboard is not active yet. Please contact Vehicall Admin.'
      });
    }

    req.session.fleetLoggedIn = true;
    req.session.fleetCompanyId = companyId;
    req.session.fleetUserId = companyId;

    res.json({
      success: true,
      message: 'Fleet login successful',
      companyId,
      company
    });

  } catch (err) {
    console.error('Fleet login error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet login error'
    });
  }
});

app.post('/api/fleet/reset-password', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success:false,
        message:'Email and password required'
      });
    }

    email = String(email).toLowerCase().trim();

    const snapshot = await db.collection('fleetCompanies')
      .where('email','==',email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        success:false,
        message:'Fleet account not found'
      });
    }

    const doc = snapshot.docs[0];
    const hashedPassword = await bcrypt.hash(password,10);

    await db.collection('fleetCompanies').doc(doc.id).update({
      password: hashedPassword,
      passwordResetAt: new Date().toISOString()
    });

    res.json({
      success:true,
      message:'Fleet password reset successfully'
    });

  } catch(err) {
    console.error(err);
    res.status(500).json({
      success:false,
      message:'Fleet password reset error'
    });
  }
});

app.post('/api/fleet/users', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    let { name, email, mobile, password, role, status } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and role are required'
      });
    }

    email = String(email).toLowerCase().trim();

    const existing = await db.collection('fleetUsers')
      .where('companyId', '==', companyId)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const permissionsByRole = {
      fleet_owner: {
        vehicles: true, drivers: true, assignments: true, checklist: true,
        fuel: true, maintenance: true, incidents: true, reports: true, users: true
      },
      fleet_manager: {
        vehicles: true, drivers: true, assignments: true, checklist: true,
        fuel: true, maintenance: true, incidents: true, reports: true, users: false
      },
      dispatcher: {
        vehicles: true, drivers: true, assignments: true, checklist: true,
        fuel: false, maintenance: false, incidents: true, reports: false, users: false
      },
      maintenance_officer: {
        vehicles: true, drivers: false, assignments: false, checklist: true,
        fuel: true, maintenance: true, incidents: true, reports: false, users: false
      },
      driver: {
        vehicles: false, drivers: false, assignments: true, checklist: true,
        fuel: true, maintenance: false, incidents: true, reports: false, users: false
      },
      viewer: {
        vehicles: true, drivers: true, assignments: true, checklist: true,
        fuel: true, maintenance: true, incidents: true, reports: true, users: false
      }
    };

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection('fleetUsers').add({
      companyId,
      name,
      email,
      mobile: cleanMobile(mobile),
      password: hashedPassword,
      role,
      permissions: permissionsByRole[role] || permissionsByRole.viewer,
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Fleet user created successfully'
    });

  } catch (err) {
    console.error('Fleet user create error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet user create error'
    });
  }
});

app.get('/api/fleet/users', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetUsers')
      .where('companyId', '==', companyId)
      .get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });

    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      users
    });

  } catch (err) {
    console.error('Fleet users fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet users fetch error'
    });
  }
});

app.get('/api/fleet/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/fleet-login');
  });
});

app.get('/api/fleet/dashboard-data', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const companyDoc = await db.collection('fleetCompanies').doc(companyId).get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fleet company not found'
      });
    }

    const company = companyDoc.data();

let loggedUserRole = 'fleet_owner';

let loggedUserPermissions = {
  vehicles: true,
  drivers: true,
  assignments: true,
  checklist: true,
  fuel: true,
  maintenance: true,
  incidents: true,
  reports: true,
  users: true
};

if (req.session.fleetUserId && req.session.fleetUserId !== companyId) {
  const fleetUserDoc = await db.collection('fleetUsers')
    .doc(req.session.fleetUserId)
    .get();

  if (fleetUserDoc.exists) {
    const fleetUser = fleetUserDoc.data();
    loggedUserRole = fleetUser.role || 'viewer';
    loggedUserPermissions = fleetUser.permissions || {};
  }
}

    const vehicleSnapshot = await db.collection('fleetVehicles')
      .where('companyId', '==', companyId)
      .get();

    const driverSnapshot = await db.collection('fleetDrivers')
      .where('companyId', '==', companyId)
      .get();

    const assignmentSnapshot = await db.collection('fleetAssignments')
      .where('companyId', '==', companyId)
      .get();

    const incidentSnapshot = await db.collection('fleetIncidents')
      .where('companyId', '==', companyId)
      .get();

    const stats = {
      totalVehicles: vehicleSnapshot.size,
      activeDrivers: driverSnapshot.size,
      activeAssignments: assignmentSnapshot.size,
      incidents: incidentSnapshot.size,
      complianceAlerts: 0
    };

    res.json({
      success: true,
      company: {
        id: companyId,
        companyName: company.companyName,
        packageType: company.packageType,
        packageLabel: company.packageLabel,
        vehicleLimit: company.vehicleLimit,
        usedVehicles: vehicleSnapshot.size,
        alertOption: company.alertOption || 'without_alerts',
        alertsEnabled: !!company.alertsEnabled,
        status: company.status || 'active'
      },
user: {
  role: loggedUserRole,
  permissions: loggedUserPermissions
},
      stats
    });

  } catch (err) {
    console.error('Fleet dashboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet dashboard error'
    });
  }
});

app.post('/api/fleet/request-upgrade', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    let {
      packageType,
      alertOption,
      billingCycle,
      remarks
    } = req.body;

    if (!packageType || !alertOption) {
      return res.status(400).json({
        success: false,
        message: 'Package type and alert option are required'
      });
    }

    packageType = String(packageType).toLowerCase().trim();

    const packageData = getFleetPackageDetails(packageType);

    const companyDoc = await db.collection('fleetCompanies').doc(companyId).get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fleet company not found'
      });
    }

    const company = companyDoc.data();
    const now = new Date().toISOString();

    const requestRef = await db.collection('fleetUpgradeRequests').add({
      companyId,

      companyName: company.companyName || '',
      companyEmail: company.email || '',
      companyMobile: company.mobile || '',

      currentPackageType: company.packageType || '',
      currentPackageLabel: company.packageLabel || '',

      requestedPackageType: packageType,
      requestedPackageLabel: packageData.label,
      requestedVehicleLimit: packageData.vehicleLimit,
      requestedBranchLimit: packageData.branchLimit,
      requestedManagerLimit: packageData.managerLimit,

      requestedAlertOption: alertOption,
      requestedAlertsEnabled: alertOption === 'with_alerts',

      billingCycle: billingCycle || 'monthly',
      remarks: remarks || '',

      status: 'pending',
      paymentStatus: 'pending',

      createdAt: now,
      updatedAt: now
    });

    await db.collection('fleetCompanies').doc(companyId).update({
      upgradeRequestStatus: 'pending',
      lastUpgradeRequestId: requestRef.id,
      lastUpgradeRequestedAt: now
    });

    res.json({
      success: true,
      message: 'Upgrade request submitted successfully'
    });

  } catch (err) {
    console.error('Fleet upgrade request error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet upgrade request error'
    });
  }
});

app.post('/api/fleet/vehicles', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    let {
  plateCode,
  plateNumber,
  vehicleType,
  brand,
  model,
  year,
  color,
  mulkiyaExpiry,
  insuranceExpiry,
  ownershipType,
  rentalCompanyName,
  rentalAgreementNo,
  rentalStartDate,
  rentalExpiryDate,
  vehicleCategory
} = req.body;

    const vehicleNumber = buildOmanVehicleNumber(plateCode, plateNumber);

    if (!vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Plate code and plate number required'
      });
    }

    const companyDoc = await db.collection('fleetCompanies').doc(companyId).get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fleet company not found'
      });
    }

    const company = companyDoc.data();

    const vehicleSnapshot = await db.collection('fleetVehicles')
      .where('companyId', '==', companyId)
      .get();

    if (vehicleSnapshot.size >= (company.vehicleLimit || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle limit reached. Please upgrade package.'
      });
    }

    const now = new Date().toISOString();

    await db.collection('fleetVehicles').add({
      companyId,

      plateCode,
      plateNumber,

      vehicleNumber,
      vehicleType,
      brand,
      model,
      year,
      color,

      mulkiyaExpiry,
      insuranceExpiry,

ownershipType: ownershipType || 'Company Owned',
rentalCompanyName: ownershipType === 'Rented' ? (rentalCompanyName || '') : '',
rentalAgreementNo: ownershipType === 'Rented' ? (rentalAgreementNo || '') : '',
rentalStartDate: ownershipType === 'Rented' ? (rentalStartDate || '') : '',
rentalExpiryDate: ownershipType === 'Rented' ? (rentalExpiryDate || '') : '',

vehicleCategory: vehicleCategory || 'normal',

      qr_id: generateFleetQrId(vehicleNumber),
      qr_generated: false,

      status: vehicleCategory === 'replacement' ? 'available_replacement' : 'active',
      createdAt: now
    });

    res.json({
      success: true,
      message: 'Fleet vehicle added successfully'
    });

  } catch (err) {
    console.error('Fleet vehicle add error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet vehicle add error'
    });
  }
});

app.get('/api/fleet/vehicles', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetVehicles')
      .where('companyId', '==', companyId)
      .get();

    const vehicles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    vehicles.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      vehicles
    });

  } catch (err) {
    console.error('Fleet vehicle fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet vehicle fetch error'
    });
  }
});

app.post('/api/fleet/vehicles/:vehicleId/generate-qr', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { vehicleId } = req.params;

    const vehicleRef = db.collection('fleetVehicles').doc(vehicleId);
    const vehicleDoc = await vehicleRef.get();

    if (!vehicleDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fleet vehicle not found'
      });
    }

    const vehicle = vehicleDoc.data();

    if (vehicle.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized fleet vehicle'
      });
    }

    const companyDoc = await db.collection('fleetCompanies').doc(companyId).get();
    const company = companyDoc.data();

    if (!company.alertsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Vehicall public alerts are not enabled for this fleet package'
      });
    }

    const alertUrl = `${req.protocol}://${req.get('host')}/fleet-alert.html?qr=${vehicle.qr_id}`;

    const qrImage = await QRCode.toDataURL(alertUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#081827',
        light: '#FFFFFF'
      }
    });

    await vehicleRef.update({
      qr_generated: true,
      qrGeneratedAt: new Date().toISOString(),
      alertUrl
    });

    res.json({
      success: true,
      qrImage,
      alertUrl,
      qr_id: vehicle.qr_id
    });

  } catch (err) {
    console.error('Fleet QR generation error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet QR generation error'
    });
  }
});
/* FLEET DRIVERS */
app.post('/api/fleet/drivers', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    let {
      driverName,
      employeeId,
      mobile,
      licenseNumber,
      licenseExpiry,
      status,
      createLogin,
      loginEmail,
      loginPassword,
      confirmPassword
    } = req.body;

    if (!driverName || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Driver name and mobile are required'
      });
    }

    mobile = cleanMobile(mobile);
    const now = new Date().toISOString();

    if (createLogin === 'yes') {
      if (!loginEmail || !loginPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Login email, password and confirm password are required'
        });
      }

      loginEmail = String(loginEmail).toLowerCase().trim();

      if (loginPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Login password and confirm password do not match'
        });
      }

      if (loginPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Login password must be at least 6 characters'
        });
      }

      const existingUser = await db.collection('fleetUsers')
        .where('companyId', '==', companyId)
        .where('email', '==', loginEmail)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        return res.status(400).json({
          success: false,
          message: 'A fleet user already exists with this login email'
        });
      }
    }

    const driverRef = await db.collection('fleetDrivers').add({
      companyId,
      driverName,
      employeeId: employeeId || '',
      mobile,
      licenseNumber: licenseNumber || '',
      licenseExpiry: licenseExpiry || '',
      status: status || 'active',

      assignedVehicleId: '',
      assignedVehicleNumber: '',

      loginEnabled: false,
      linkedUserId: '',

      createdAt: now,
      updatedAt: now
    });

    let linkedUserId = '';

    if (createLogin === 'yes') {
      const permissions = {
        vehicles: false,
        drivers: false,
        assignments: true,
        checklist: true,
        fuel: true,
        maintenance: false,
        incidents: true,
        reports: false,
        users: false
      };

      const hashedPassword = await bcrypt.hash(loginPassword, 10);

      const userRef = await db.collection('fleetUsers').add({
        companyId,
        linkedDriverId: driverRef.id,

        name: driverName,
        email: loginEmail,
        mobile,
        password: hashedPassword,

        role: 'driver',
        permissions,
        status: status === 'active' ? 'active' : 'inactive',

        createdAt: now,
        updatedAt: now
      });

      linkedUserId = userRef.id;

      await driverRef.update({
        loginEnabled: true,
        linkedUserId,
        loginEmail,
        updatedAt: now
      });
    }

    res.json({
      success: true,
      message: createLogin === 'yes'
        ? 'Driver and login user created successfully'
        : 'Driver added successfully',
      driverId: driverRef.id,
      linkedUserId
    });

  } catch (err) {
    console.error('Fleet driver add error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet driver add error'
    });
  }
});

app.get('/api/fleet/drivers', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetDrivers')
      .where('companyId', '==', companyId)
      .get();

    const drivers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    drivers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      drivers
    });

  } catch (err) {
    console.error('Fleet driver fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet driver fetch error'
    });
  }
});

app.put('/api/fleet/drivers/:driverId', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { driverId } = req.params;

    const {
      driverName,
      employeeId,
      mobile,
      licenseNumber,
      licenseExpiry,
      status
    } = req.body;

    if (!driverName || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Driver name and mobile are required'
      });
    }

    const driverRef = db.collection('fleetDrivers').doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists || driverDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    await driverRef.update({
      driverName,
      employeeId: employeeId || '',
      mobile: cleanMobile(mobile),
      licenseNumber: licenseNumber || '',
      licenseExpiry: licenseExpiry || '',
      status: status || 'active',
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Driver updated successfully'
    });

  } catch (err) {
    console.error('Driver update error:', err);
    res.status(500).json({
      success: false,
      message: 'Driver update error'
    });
  }
});

app.get('/driver-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver-login.html'));
});

app.get('/driver-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver-dashboard.html'));
});

app.get('/driver-incident', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver-incident.html'));
});

function requireDriver(req, res, next) {
  if (req.session && req.session.driverLoggedIn && req.session.driverUserId) return next();

  return res.status(401).json({
    success: false,
    message: 'Driver login required'
  });
}

/* =========================================================
   DRIVER PORTAL SYSTEM
========================================================= */

app.post('/api/driver/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    email = String(email).toLowerCase().trim();

    const snapshot = await db.collection('fleetUsers')
      .where('email', '==', email)
      .where('role', '==', 'driver')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid driver login'
      });
    }

    const driverDoc = snapshot.docs[0];
    const driverUser = driverDoc.data();

    if (driverUser.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Driver account is not active'
      });
    }

    const validPassword = await bcrypt.compare(password, driverUser.password || '');

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid driver login'
      });
    }

    const companyDoc = await db.collection('fleetCompanies')
      .doc(driverUser.companyId)
      .get();

    if (!companyDoc.exists || companyDoc.data().status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Fleet company is not active'
      });
    }

    req.session.driverLoggedIn = true;
    req.session.driverUserId = driverDoc.id;
    req.session.driverCompanyId = driverUser.companyId;
    req.session.driverRole = 'driver';

    req.session.fleetLoggedIn = true;
    req.session.fleetCompanyId = driverUser.companyId;
    req.session.fleetUserId = driverDoc.id;

    res.json({
      success: true,
      message: 'Driver login successful'
    });

  } catch (err) {
    console.error('Driver login error:', err);
    res.status(500).json({
      success: false,
      message: 'Driver login error'
    });
  }
});

app.get('/api/driver/dashboard', requireDriver, async (req, res) => {
  try {
    const driverUserId = req.session.driverUserId;
    const companyId = req.session.driverCompanyId;

    const driverUserDoc = await db.collection('fleetUsers').doc(driverUserId).get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driverUser = driverUserDoc.data();

    const companyDoc = await db.collection('fleetCompanies').doc(companyId).get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const company = companyDoc.data();

    const driverSnapshot = await db.collection('fleetDrivers')
      .where('companyId', '==', companyId)
      .where('mobile', '==', cleanMobile(driverUser.mobile))
      .limit(1)
      .get();

    let assignedVehicle = {
  vehicleNumber: 'Not assigned',
  status: '-'
};

let workingVehicle = {
  vehicleNumber: 'Not assigned',
  status: '-',
  useType: 'original'
};

let driverRecordId = '';

    if (!driverSnapshot.empty) {
      const driverRecordDoc = driverSnapshot.docs[0];
      const driverRecord = driverRecordDoc.data();
      driverRecordId = driverRecordDoc.id;

      if (driverRecord.assignedVehicleId) {
        const vehicleDoc = await db.collection('fleetVehicles')
          .doc(driverRecord.assignedVehicleId)
          .get();

        if (vehicleDoc.exists) {
  const vehicle = vehicleDoc.data();

  assignedVehicle = {
    vehicleId: driverRecord.assignedVehicleId,
    vehicleNumber: vehicle.vehicleNumber || 'Not assigned',
    status: vehicle.status || '-'
  };

  workingVehicle = {
    vehicleId: driverRecord.assignedVehicleId,
    vehicleNumber: vehicle.vehicleNumber || 'Not assigned',
    status: vehicle.status || '-',
    useType: 'original'
  };

  if (driverRecord.activeReplacementId) {
    const replacementDoc = await db.collection('fleetReplacements')
      .doc(driverRecord.activeReplacementId)
      .get();

    if (
      replacementDoc.exists &&
      replacementDoc.data().companyId === companyId &&
      replacementDoc.data().status === 'active'
    ) {
      const replacement = replacementDoc.data();

      workingVehicle = {
        vehicleId: '',
        vehicleNumber: replacement.replacementVehicleNumber || 'Replacement Vehicle',
        status: 'active_replacement',
        useType: 'replacement',
        replacementId: driverRecord.activeReplacementId,
        originalVehicleId: replacement.originalVehicleId || '',
        originalVehicleNumber: replacement.originalVehicleNumber || ''
      };
    }
  }
}
      }
    }

    let openTrips = 0;
    let openIncidents = 0;

    if (driverRecordId) {
      const tripsSnapshot = await db.collection('fleetDailyTrips')
        .where('companyId', '==', companyId)
        .where('driverId', '==', driverRecordId)
        .where('status', '==', 'active')
        .get();

      const incidentsSnapshot = await db.collection('fleetIncidents')
        .where('companyId', '==', companyId)
        .where('driverId', '==', driverRecordId)
        .get();

      openTrips = tripsSnapshot.size;
      openIncidents = incidentsSnapshot.docs.filter(doc => doc.data().status !== 'closed').length;
    }

    res.json({
      success: true,
      driver: {
        id: driverUserId,
        name: driverUser.name,
        email: driverUser.email,
        mobile: driverUser.mobile
      },
      company: {
        companyName: company.companyName
      },
      assignedVehicle,
workingVehicle,
stats: {
        openTrips,
        openIncidents
      }
    });

  } catch (err) {
    console.error('Driver dashboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Driver dashboard error'
    });
  }
});

app.get('/api/driver/my-active-trip', requireDriver, async (req, res) => {
  try {
    const companyId = req.session.driverCompanyId;
    const driverUserId = req.session.driverUserId;

    const driverUserDoc = await db.collection('fleetUsers').doc(driverUserId).get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({ success: false, message: 'Driver user not found' });
    }

    const driverUser = driverUserDoc.data();
    const linkedDriverId = driverUser.linkedDriverId || '';

    if (!linkedDriverId) {
      return res.json({ success: true, trip: null });
    }

    const snapshot = await db.collection('fleetDailyTrips')
      .where('companyId', '==', companyId)
      .where('driverId', '==', linkedDriverId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: true, trip: null });
    }

    res.json({
      success: true,
      trip: {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      }
    });

  } catch (err) {
    console.error('Driver active trip error:', err);
    res.status(500).json({ success: false, message: 'Driver active trip error' });
  }
});

app.post('/api/driver/start-trip', requireDriver, async (req, res) => {
  try {
    const companyId = req.session.driverCompanyId;
    const driverUserId = req.session.driverUserId;
    const { openingKm, openingFuel, openingNotes } = req.body;

    if (!openingKm) {
      return res.status(400).json({ success: false, message: 'Opening KM is required' });
    }

    const driverUserDoc = await db.collection('fleetUsers').doc(driverUserId).get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({ success: false, message: 'Driver user not found' });
    }

    const driverUser = driverUserDoc.data();
    const linkedDriverId = driverUser.linkedDriverId || '';

    if (!linkedDriverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver account is not linked to driver profile'
      });
    }

    const driverDoc = await db.collection('fleetDrivers').doc(linkedDriverId).get();

    if (!driverDoc.exists || driverDoc.data().companyId !== companyId) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    const driver = driverDoc.data();

    if (!driver.assignedVehicleId) {
      return res.status(400).json({
        success: false,
        message: 'No vehicle assigned to this driver'
      });
    }

    const existingTrip = await db.collection('fleetDailyTrips')
      .where('companyId', '==', companyId)
      .where('driverId', '==', linkedDriverId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existingTrip.empty) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active trip. Please close it first.'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(driver.assignedVehicleId).get();

    if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({ success: false, message: 'Assigned vehicle not found' });
    }

    const vehicle = vehicleDoc.data();
    const now = new Date().toISOString();

    await db.collection('fleetDailyTrips').add({
      companyId,
      vehicleId: driver.assignedVehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      driverId: linkedDriverId,
      driverName: driver.driverName,
      shift: 'Driver Portal',
      tripDate: now.slice(0, 10),
      openingKm,
      openingFuel: openingFuel || '',
      openingTyre: '',
      openingLights: '',
      openingDamage: '',
      openingNotes: openingNotes || '',
      closingKm: '',
      closingFuel: '',
      closingNotes: '',
      status: 'active',
      source: 'driver_portal',
      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Trip started successfully for your assigned vehicle'
    });

  } catch (err) {
    console.error('Driver start trip error:', err);
    res.status(500).json({ success: false, message: 'Driver start trip error' });
  }
});

app.post('/api/driver/close-trip', requireDriver, async (req, res) => {
  try {
    const companyId = req.session.driverCompanyId;
    const driverUserId = req.session.driverUserId;
    const { closingKm, closingFuel, closingNotes } = req.body;

    if (!closingKm) {
      return res.status(400).json({ success: false, message: 'Closing KM is required' });
    }

    const driverUserDoc = await db.collection('fleetUsers').doc(driverUserId).get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({ success: false, message: 'Driver user not found' });
    }

    const driverUser = driverUserDoc.data();
    const linkedDriverId = driverUser.linkedDriverId || '';

    const activeTrip = await db.collection('fleetDailyTrips')
      .where('companyId', '==', companyId)
      .where('driverId', '==', linkedDriverId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (activeTrip.empty) {
      return res.status(404).json({
        success: false,
        message: 'No active trip found'
      });
    }

    await activeTrip.docs[0].ref.update({
      closingKm,
      closingFuel: closingFuel || '',
      closingNotes: closingNotes || '',
      status: 'closed',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Trip closed successfully'
    });

  } catch (err) {
    console.error('Driver close trip error:', err);
    res.status(500).json({ success: false, message: 'Driver close trip error' });
  }
});

app.post('/api/driver/fuel', requireDriver, async (req, res) => {
  try {

    const companyId = req.session.driverCompanyId;
    const driverUserId = req.session.driverUserId;

    const {
  entryType,
  fuelType,
  liters,
  amount,
  odometerReading,
  fuelStation,
  paymentMethod,
  fuelCardId,
  openCardReason,
  receiptNo,
  remarks
} = req.body;

    if (!amount) {
      return res.status(400).json({
        success:false,
        message:'Amount is required'
      });
    }

    const driverUserDoc = await db.collection('fleetUsers')
      .doc(driverUserId)
      .get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({
        success:false,
        message:'Driver user not found'
      });
    }

    const driverUser = driverUserDoc.data();

    const linkedDriverId = driverUser.linkedDriverId || '';

    if (!linkedDriverId) {
      return res.status(400).json({
        success:false,
        message:'Driver account not linked properly'
      });
    }

    const driverDoc = await db.collection('fleetDrivers')
      .doc(linkedDriverId)
      .get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success:false,
        message:'Driver profile not found'
      });
    }

    const driver = driverDoc.data();

    if (!driver.assignedVehicleId) {
      return res.status(400).json({
        success:false,
        message:'No vehicle assigned to driver'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles')
  .doc(driver.assignedVehicleId)
  .get();

if (!vehicleDoc.exists) {
  return res.status(404).json({
    success:false,
    message:'Assigned vehicle not found'
  });
}

const vehicle = vehicleDoc.data();

let fuelVehicleId = driver.assignedVehicleId;
let fuelVehicleNumber = vehicle.vehicleNumber;
let vehicleUseType = 'original';
let replacementRecordId = '';
let originalVehicleId = '';
let originalVehicleNumber = '';

if (driver.activeReplacementId) {
  const replacementDoc = await db.collection('fleetReplacements')
    .doc(driver.activeReplacementId)
    .get();

  if (
    replacementDoc.exists &&
    replacementDoc.data().companyId === companyId &&
    replacementDoc.data().status === 'active'
  ) {
    const replacement = replacementDoc.data();

    fuelVehicleId = '';
    fuelVehicleNumber = replacement.replacementVehicleNumber || vehicle.vehicleNumber;
    vehicleUseType = 'replacement';
    replacementRecordId = driver.activeReplacementId;
    originalVehicleId = replacement.originalVehicleId || driver.assignedVehicleId;
    originalVehicleNumber = replacement.originalVehicleNumber || vehicle.vehicleNumber;
  }
}

const cardVehicleId = originalVehicleId || fuelVehicleId;

let fuelCardData = {
  fuelCardId: "",
  fuelCardNumber: "",
  fuelCardType: "",
  usedOpenCard: false
};

if (paymentMethod === "Company Card") {
  try {
    fuelCardData = await getFuelCardForEntry(companyId, cardVehicleId, fuelCardId);
  } catch (cardErr) {
    return res.status(400).json({
      success: false,
      message: cardErr.message
    });
  }

  if (!fuelCardData.fuelCardId) {
    return res.status(400).json({
      success: false,
      message: "Fuel card is required when payment method is Company Card"
    });
  }

  if (fuelCardData.usedOpenCard && !openCardReason) {
    return res.status(400).json({
      success: false,
      message: "Open card reason is required"
    });
  }
}

const now = new Date().toISOString();

await db.collection('fleetFuelLogs').add({

  companyId,

  vehicleId: fuelVehicleId,
  vehicleNumber: fuelVehicleNumber,

  vehicleUseType,
  replacementRecordId,
  originalVehicleId,
  originalVehicleNumber,

      driverId: linkedDriverId,
      driverName: driver.driverName,

      entryType: entryType || 'Fuel',
      fuelType: fuelType || '',
      liters: Number(liters || 0),
      amount: Number(amount || 0),
      odometerReading: odometerReading || '',
      fuelStation: fuelStation || '',
      paymentMethod: paymentMethod || '',

fuelCardId: fuelCardData.fuelCardId,
fuelCardNumber: fuelCardData.fuelCardNumber,
fuelCardType: fuelCardData.fuelCardType,
usedOpenCard: fuelCardData.usedOpenCard,
openCardReason: fuelCardData.usedOpenCard ? openCardReason : '',

receiptNo: receiptNo || '',
      remarks: remarks || '',

      source: 'driver_portal',

      createdBy: driverUserId,
      createdByRole: 'driver',

      lastModifiedBy: driverUserId,
      lastModifiedByRole: 'driver',

      correctionReason: '',
      editHistory: [],

      status: 'pending_approval',
      approvalStatus: 'pending',
      approvedBy: '',
      approvedAt: '',
      rejectedBy: '',
      rejectedAt: '',
      rejectionReason: '',

      createdAt: now,
      updatedAt: now,
      modifiedAt: now
    });

    res.json({
      success:true,
      message:'Fuel entry saved successfully'
    });

  } catch(err){

    console.error('Driver fuel entry error:', err);

    res.status(500).json({
      success:false,
      message:'Driver fuel entry error'
    });
  }
});

app.post('/api/driver/incident', requireDriver, async (req, res) => {
  try {

    const {
      incidentType,
      priority,
      location,
      description
    } = req.body;

    if (!incidentType || !description) {
      return res.status(400).json({
        success: false,
        message: 'Incident type and description are required'
      });
    }

    const driverId = req.session.driverId;
    const companyId = req.session.fleetCompanyId;

    const driverDoc = await db.collection('fleetDrivers').doc(driverId).get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = driverDoc.data();

    let assignedVehicle = null;

    const assignmentSnap = await db.collection('fleetAssignments')
      .where('companyId', '==', companyId)
      .where('driverId', '==', driverId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!assignmentSnap.empty) {
      assignedVehicle = assignmentSnap.docs[0].data();
    }

    const incidentData = {
      companyId,

      driverId,
      driverName: driver.driverName || '',

      vehicleId: assignedVehicle?.vehicleId || '',
      vehicleNumber: assignedVehicle?.vehicleNumber || '',

      incidentType,
      priority: priority || 'medium',
      location: location || '',
      description,

      status: 'open',

      createdBy: driverId,
      createdByRole: 'driver',

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection('fleetIncidents').add(incidentData);

    res.json({
      success: true,
      message: 'Incident submitted successfully',
      incidentId: docRef.id
    });

  } catch (err) {
    console.error('Driver incident error:', err);

    res.status(500).json({
      success: false,
      message: 'Unable to submit incident'
    });
  }
});

/* DRIVER FUEL APPROVAL SYSTEM */

app.post('/api/fleet/fuel/:fuelId/approve', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const fuelId = req.params.fuelId;

    const fuelRef = db.collection('fleetFuelLogs').doc(fuelId);
    const fuelDoc = await fuelRef.get();

    if (!fuelDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fuel entry not found'
      });
    }

    const fuel = fuelDoc.data();

    if (fuel.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized fuel entry'
      });
    }

    if (fuel.approvalStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Fuel entry already approved'
      });
    }

    const now = new Date().toISOString();

    await fuelRef.update({
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: req.session.fleetUserId || companyId,
      approvedAt: now,
      lastModifiedBy: req.session.fleetUserId || companyId,
      lastModifiedByRole: 'fleet_admin',
      modifiedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fuel entry approved successfully'
    });

  } catch (err) {
    console.error('Fuel approve error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel approve error'
    });
  }
});


app.post('/api/fleet/fuel/:fuelId/reject', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const fuelId = req.params.fuelId;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const fuelRef = db.collection('fleetFuelLogs').doc(fuelId);
    const fuelDoc = await fuelRef.get();

    if (!fuelDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fuel entry not found'
      });
    }

    const fuel = fuelDoc.data();

    if (fuel.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized fuel entry'
      });
    }

    const now = new Date().toISOString();

    await fuelRef.update({
      status: 'rejected',
      approvalStatus: 'rejected',
      rejectedBy: req.session.fleetUserId || companyId,
      rejectedAt: now,
      rejectionReason,
      lastModifiedBy: req.session.fleetUserId || companyId,
      lastModifiedByRole: 'fleet_admin',
      modifiedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fuel entry rejected successfully'
    });

  } catch (err) {
    console.error('Fuel reject error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel reject error'
    });
  }
});

app.post('/api/fleet/fuel/:fuelId/update', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const fuelId = req.params.fuelId;

    const {
      entryType,
      fuelType,
      liters,
      amount,
      odometerReading,
      fuelStation,
      paymentMethod,
      receiptNo,
      remarks,
      correctionReason
    } = req.body;

    if (!correctionReason) {
      return res.status(400).json({
        success: false,
        message: 'Correction reason is required'
      });
    }

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    const fuelRef = db.collection('fleetFuelLogs').doc(fuelId);
    const fuelDoc = await fuelRef.get();

    if (!fuelDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fuel entry not found'
      });
    }

    const oldData = fuelDoc.data();

    if (oldData.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized fuel entry'
      });
    }

    if (oldData.approvalStatus === 'approved' || oldData.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Approved fuel entry cannot be modified'
      });
    }

    const now = new Date().toISOString();

    const historyItem = {
      modifiedBy: req.session.fleetUserId || companyId,
      modifiedByRole: 'fleet_admin',
      modifiedAt: now,
      correctionReason,
      oldData
    };

    await fuelRef.update({
      entryType: entryType || oldData.entryType || 'Fuel',
      fuelType: fuelType || '',
      liters: Number(liters || 0),
      amount: Number(amount || 0),
      odometerReading: odometerReading || '',
      fuelStation: fuelStation || '',
      paymentMethod: paymentMethod || oldData.paymentMethod || '',
      receiptNo: receiptNo || '',
      remarks: remarks || '',

      correctionReason,
      editHistory: [...(oldData.editHistory || []), historyItem],

      status: oldData.status || 'pending_approval',
      approvalStatus: oldData.approvalStatus || 'pending',

      lastModifiedBy: req.session.fleetUserId || companyId,
      lastModifiedByRole: 'fleet_admin',
      modifiedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fuel entry updated successfully'
    });

  } catch (err) {
    console.error('Fuel update error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel update error'
    });
  }
});

app.get('/api/driver/logout', (req, res) => {
  req.session.driverLoggedIn = false;
  req.session.driverUserId = null;
  req.session.driverCompanyId = null;

  req.session.fleetLoggedIn = false;
  req.session.fleetCompanyId = null;
  req.session.fleetUserId = null;

  res.redirect('/driver-login');
});

/* FLEET ASSIGNMENTS */
app.post('/api/fleet/assignments', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      vehicleId,
      driverId,
      assignmentDate,
      shift,
      openingKm,
      notes
    } = req.body;

    if (!vehicleId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle and driver are required'
      });
    }

    const vehicleRef = db.collection('fleetVehicles').doc(vehicleId);
    const driverRef = db.collection('fleetDrivers').doc(driverId);

    const vehicleDoc = await vehicleRef.get();
    const driverDoc = await driverRef.get();

    if (!vehicleDoc.exists || !driverDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle or driver not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const driver = driverDoc.data();

    if (vehicle.companyId !== companyId || driver.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized assignment'
      });
    }

    const now = new Date().toISOString();

    const assignmentRef = await db.collection('fleetAssignments').add({
      companyId,

      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,

      driverId,
      driverName: driver.driverName,
      driverMobile: driver.mobile || '',

      assignmentDate: assignmentDate || now,
      shift: shift || '',
      openingKm: openingKm || '',
      notes: notes || '',

      status: 'active',

      createdAt: now,
      updatedAt: now
    });

    await vehicleRef.update({
      assignedDriverId: driverId,
      assignedDriverName: driver.driverName,
      currentAssignmentId: assignmentRef.id,
      updatedAt: now
    });

    await driverRef.update({
      assignedVehicleId: vehicleId,
      assignedVehicleNumber: vehicle.vehicleNumber,
      currentAssignmentId: assignmentRef.id,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Vehicle assigned to driver successfully'
    });

  } catch (err) {
    console.error('Fleet assignment error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet assignment error'
    });
  }
});

app.get('/api/fleet/assignments', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetAssignments')
      .where('companyId', '==', companyId)
      .get();

    const assignments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    assignments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      assignments
    });

  } catch (err) {
    console.error('Fleet assignments fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet assignments fetch error'
    });
  }
});

/* FLEET CHECKLIST */
app.post('/api/fleet/checklists', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      checklistDate,
      vehicleId,
      driverId,
      checklistType,
      openingKm,
      closingKm,
      kmUsed,
      tireCheck,
      brakeCheck,
      lightsCheck,
      fuelLevel,
      damageFound,
      safetyConfirmed,
      damageNotes,
      remarks
    } = req.body;

    if (!checklistDate || !vehicleId || !driverId || !closingKm) {
      return res.status(400).json({
        success: false,
        message: 'Checklist date, vehicle, driver and closing KM are required'
      });
    }

    if (Number(closingKm) < Number(openingKm || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Closing KM cannot be less than opening KM'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();
    const driverDoc = await db.collection('fleetDrivers').doc(driverId).get();

    if (!vehicleDoc.exists || !driverDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle or driver not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const driver = driverDoc.data();

    if (vehicle.companyId !== companyId || driver.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized checklist'
      });
    }

    const now = new Date().toISOString();

    await db.collection('fleetChecklists').add({
      companyId,

      checklistDate,
      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,

      driverId,
      driverName: driver.driverName,

      checklistType: checklistType || 'closing',

      openingKm: Number(openingKm || 0),
      closingKm: Number(closingKm || 0),
      kmUsed: Number(kmUsed || (Number(closingKm) - Number(openingKm || 0))),

      tireCheck: !!tireCheck,
      brakeCheck: !!brakeCheck,
      lightsCheck: !!lightsCheck,

      fuelLevel: fuelLevel || '',
      damageFound: !!damageFound,
      safetyConfirmed: !!safetyConfirmed,

      damageNotes: damageNotes || '',
      remarks: remarks || '',

      createdBy: req.session.fleetUserId || companyId,
      createdByRole: 'fleet_admin',

      createdAt: now,
      updatedAt: now
    });

    await db.collection('fleetVehicles').doc(vehicleId).update({
      currentKm: Number(closingKm || 0),
      lastChecklistDate: checklistDate,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Daily checklist saved successfully'
    });

  } catch (err) {
    console.error('Fleet checklist error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet checklist error'
    });
  }
});

app.get('/api/fleet/checklists', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetChecklists')
      .where('companyId', '==', companyId)
      .get();

    const checklists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    checklists.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      checklists
    });

  } catch (err) {
    console.error('Fleet checklist fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet checklist fetch error'
    });
  }
});
/* FLEET INCIDENTS */
app.post('/api/fleet/incidents', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      vehicleId,
      driverId,
      incidentType,
      priority,
      description,
      location,
      incidentDate
    } = req.body;

    if (!incidentType || !description) {
      return res.status(400).json({
        success: false,
        message: 'Incident type and description are required'
      });
    }

    let vehicleNumber = '';
    let driverName = '';

    if (vehicleId) {
      const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();
      if (vehicleDoc.exists && vehicleDoc.data().companyId === companyId) {
        vehicleNumber = vehicleDoc.data().vehicleNumber || '';
      }
    }

    if (driverId) {
      const driverDoc = await db.collection('fleetDrivers').doc(driverId).get();
      if (driverDoc.exists && driverDoc.data().companyId === companyId) {
        driverName = driverDoc.data().driverName || '';
      }
    }

    const now = new Date().toISOString();

    const incidentRef = await db.collection('fleetIncidents').add({
      companyId,
      vehicleId: vehicleId || '',
      vehicleNumber,
      driverId: driverId || '',
      driverName,
      incidentType,
      priority: priority || 'medium',
      description,
      location: location || '',
      incidentDate: incidentDate || now,
      status: 'open',
      source: 'internal',
      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Incident created successfully',
      incidentId: incidentRef.id
    });

  } catch (err) {
    console.error('Incident error:', err);
    res.status(500).json({
      success: false,
      message: 'Incident error'
    });
  }
});

app.get('/api/fleet/incidents', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetIncidents')
      .where('companyId', '==', companyId)
      .get();

    const incidents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    incidents.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      incidents
    });

  } catch (err) {
    console.error('Fleet incidents fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Incident list error'
    });
  }
});

app.post('/api/fleet/incidents/:incidentId/close', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { incidentId } = req.params;
    const { resolutionNotes } = req.body;

    const incidentRef = db.collection('fleetIncidents').doc(incidentId);
    const incidentDoc = await incidentRef.get();

    if (!incidentDoc.exists || incidentDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    await incidentRef.update({
      status: 'closed',
      resolutionNotes: resolutionNotes || '',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Incident closed successfully'
    });

  } catch (err) {
    console.error('Close incident error:', err);
    res.status(500).json({
      success: false,
      message: 'Close incident error'
    });
  }
});

/* FLEET MAINTENANCE */
app.post('/api/fleet/maintenance', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      vehicleId,
      maintenanceType,
      serviceDate,
      nextDueDate,
      currentKm,
      workshopName,
      cost,
      downtime,
      ownershipType,
      rentalCompanyName,
      maintenanceResponsibility,
      rentalAgreementExpiry,
      notes,
      status
    } = req.body;

    if (!vehicleId || !maintenanceType) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle and maintenance type are required'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();

    if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Fleet vehicle not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const now = new Date().toISOString();

    const maintenanceRef = await db.collection('fleetMaintenance').add({
      companyId,

      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,

      maintenanceType,
      serviceDate: serviceDate || '',
      nextDueDate: nextDueDate || '',
      currentKm: currentKm || '',
      workshopName: workshopName || '',
      cost: Number(cost || 0),
      downtime: downtime || 'No',

      ownershipType: ownershipType || 'Company Owned',
      rentalCompanyName: rentalCompanyName || '',
      maintenanceResponsibility: maintenanceResponsibility || 'Customer Company',
      rentalAgreementExpiry: rentalAgreementExpiry || '',

      notes: notes || '',
      status: status || 'pending',

      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Maintenance record saved successfully',
      maintenanceId: maintenanceRef.id
    });

  } catch (err) {
    console.error('Maintenance error:', err);
    res.status(500).json({
      success: false,
      message: 'Maintenance error'
    });
  }
});

app.get('/fleet-replacements', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fleet-replacements.html'));
});

app.get('/api/fleet/maintenance', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetMaintenance')
      .where('companyId', '==', companyId)
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      records
    });

  } catch (err) {
    console.error('Maintenance fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Maintenance fetch error'
    });
  }
});

/* FLEET REPLACEMENT VEHICLES */

app.post('/api/fleet/replacements', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
  originalVehicleId,
  originalVehicleEndKm,
  originalVehicleSentDate,
  replacementVehicleNumber,
  rentalCompanyName,
  reason,
  replacementStartKm,
  expectedReturnDate,
  assignNow,
  assignedDriverId,
  notes
} = req.body;

    if (!originalVehicleId || !originalVehicleEndKm || !replacementVehicleNumber || !rentalCompanyName || !replacementStartKm) {
      return res.status(400).json({
        success: false,
        message: 'Original vehicle, original end KM, replacement vehicle number, rental company and replacement start KM are required'
      });
    }

    const originalVehicleDoc = await db.collection('fleetVehicles').doc(originalVehicleId).get();

    if (!originalVehicleDoc.exists || originalVehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Original vehicle not found'
      });
    }

    const originalVehicle = originalVehicleDoc.data();

    let assignedDriverName = '';
    let finalStatus = 'available';

    if (assignNow === 'yes' && assignedDriverId) {
      const driverDoc = await db.collection('fleetDrivers').doc(assignedDriverId).get();

      if (!driverDoc.exists || driverDoc.data().companyId !== companyId) {
        return res.status(404).json({
          success: false,
          message: 'Selected driver not found'
        });
      }

      assignedDriverName = driverDoc.data().driverName || '';
      finalStatus = 'active';
    }

    const now = new Date().toISOString();

    const replacementRef = await db.collection('fleetReplacements').add({
      companyId,

      originalVehicleId,
      originalVehicleNumber: originalVehicle.vehicleNumber || '',

      replacementVehicleNumber: String(replacementVehicleNumber || '').toUpperCase().trim(),
      rentalCompanyName,
      reason: reason || 'Original vehicle under service',

      originalVehicleEndKm: Number(originalVehicleEndKm || 0),
originalVehicleSentDate: originalVehicleSentDate || now.slice(0, 10),
originalVehicleReturnKm: '',
originalVehicleReturnDate: '',
originalVehicleReturnNotes: '',

replacementStartKm: Number(replacementStartKm || 0),
replacementEndKm: '',
replacementTotalKmUsed: '',

expectedReturnDate: expectedReturnDate || '',
replacementReturnedDate: '',
replacementReturnNotes: '',
replacementReturnType: '',

      assignNow: assignNow === 'yes',
      assignedDriverId: assignNow === 'yes' ? assignedDriverId : '',
      assignedDriverName,

      status: finalStatus, // available / active / returned

      notes: notes || '',

      createdBy: req.session.fleetUserId || companyId,
      createdByRole: 'fleet_admin',
      createdAt: now,
      updatedAt: now
    });

    if (assignNow === 'yes' && assignedDriverId) {
      await db.collection('fleetDrivers').doc(assignedDriverId).update({
        activeReplacementId: replacementRef.id,
        activeReplacementVehicleNumber: String(replacementVehicleNumber || '').toUpperCase().trim(),
        updatedAt: now
      });
    }

await db.collection('fleetVehicles').doc(originalVehicleId).update({
  status: 'under_service',
  currentKm: Number(originalVehicleEndKm || 0),
  activeReplacementId: replacementRef.id,
  activeReplacementVehicleNumber: String(replacementVehicleNumber || '').toUpperCase().trim(),
  updatedAt: now
});

    res.json({
      success: true,
      message: finalStatus === 'active'
        ? 'Replacement vehicle received and assigned successfully'
        : 'Replacement vehicle received successfully',
      replacementId: replacementRef.id
    });

  } catch (err) {
    console.error('Replacement vehicle create error:', err);
    res.status(500).json({
      success: false,
      message: 'Replacement vehicle create error'
    });
  }
});


app.get('/api/fleet/replacements', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetReplacements')
      .where('companyId', '==', companyId)
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      records
    });

  } catch (err) {
    console.error('Replacement vehicle fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Replacement vehicle fetch error'
    });
  }
});


app.post('/api/fleet/replacements/:replacementId/assign', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { replacementId } = req.params;
    const { assignedDriverId } = req.body;

    if (!assignedDriverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver is required'
      });
    }

    const replacementRef = db.collection('fleetReplacements').doc(replacementId);
    const replacementDoc = await replacementRef.get();

    if (!replacementDoc.exists || replacementDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Replacement record not found'
      });
    }

    const replacement = replacementDoc.data();

    if (replacement.status === 'returned') {
      return res.status(400).json({
        success: false,
        message: 'Returned replacement vehicle cannot be assigned'
      });
    }

    const driverRef = db.collection('fleetDrivers').doc(assignedDriverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists || driverDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = driverDoc.data();
    const now = new Date().toISOString();

    await replacementRef.update({
      assignedDriverId,
      assignedDriverName: driver.driverName || '',
      status: 'active',
      assignedAt: now,
      assignedBy: req.session.fleetUserId || companyId,
      updatedAt: now
    });

    await driverRef.update({
      activeReplacementId: replacementId,
      activeReplacementVehicleNumber: replacement.replacementVehicleNumber || '',
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Replacement vehicle assigned successfully'
    });

  } catch (err) {
    console.error('Replacement assign error:', err);
    res.status(500).json({
      success: false,
      message: 'Replacement assign error'
    });
  }
});

app.post('/api/fleet/replacements/:replacementId/receive-original', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { replacementId } = req.params;

    const {
      originalVehicleReturnKm,
      originalVehicleReturnDate,
      originalVehicleReturnNotes
    } = req.body;

    if (!originalVehicleReturnKm) {
      return res.status(400).json({
        success: false,
        message: 'Original vehicle return KM is required'
      });
    }

    const replacementRef = db.collection('fleetReplacements').doc(replacementId);
    const replacementDoc = await replacementRef.get();

    if (!replacementDoc.exists || replacementDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Replacement record not found'
      });
    }

    const replacement = replacementDoc.data();
    const now = new Date().toISOString();

    await replacementRef.update({
      originalVehicleReturnKm: Number(originalVehicleReturnKm || 0),
      originalVehicleReturnDate: originalVehicleReturnDate || now.slice(0, 10),
      originalVehicleReturnNotes: originalVehicleReturnNotes || '',
      originalVehicleReceivedBack: true,
      originalVehicleReceivedAt: now,
      originalVehicleReceivedBy: req.session.fleetUserId || companyId,
      updatedAt: now
    });

    await db.collection('fleetVehicles').doc(replacement.originalVehicleId).update({
      status: 'active',
      currentKm: Number(originalVehicleReturnKm || 0),
      activeReplacementId: '',
      activeReplacementVehicleNumber: '',
      serviceReturnedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Original vehicle received back successfully'
    });

  } catch (err) {
    console.error('Receive original vehicle error:', err);
    res.status(500).json({
      success: false,
      message: 'Receive original vehicle error'
    });
  }
});


app.post('/api/fleet/replacements/:replacementId/return', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { replacementId } = req.params;
    const { replacementEndKm, replacementReturnedDate, replacementReturnNotes, replacementReturnType } = req.body;

    if (!replacementEndKm) {
      return res.status(400).json({
        success: false,
        message: 'Return KM is required'
      });
    }

    const replacementRef = db.collection('fleetReplacements').doc(replacementId);
    const replacementDoc = await replacementRef.get();

    if (!replacementDoc.exists || replacementDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Replacement record not found'
      });
    }

    const replacement = replacementDoc.data();

    const startKm = Number(replacement.replacementStartKm || 0);
const finalEndKm = Number(replacementEndKm || 0);

    if (finalEndKm < startKm) {
      return res.status(400).json({
        success: false,
        message: 'Return KM cannot be less than start KM'
      });
    }

    const now = new Date().toISOString();

    await replacementRef.update({
  replacementEndKm: finalEndKm,
  replacementTotalKmUsed: finalEndKm - startKm,
  replacementReturnedDate: replacementReturnedDate || now.slice(0, 10),
  replacementReturnNotes: replacementReturnNotes || '',
  replacementReturnType: replacementReturnType || 'permanent_return',
  status: 'returned',
      returnedAt: now,
      returnedBy: req.session.fleetUserId || companyId,
      updatedAt: now
    });

    if (replacement.assignedDriverId) {
      await db.collection('fleetDrivers').doc(replacement.assignedDriverId).update({
        activeReplacementId: '',
        activeReplacementVehicleNumber: '',
        updatedAt: now
      });
    }

    res.json({
      success: true,
      message: 'Replacement vehicle returned successfully'
    });

  } catch (err) {
    console.error('Replacement return error:', err);
    res.status(500).json({
      success: false,
      message: 'Replacement return error'
    });
  }
});

/* FLEET TRAFFIC FINE ATTRIBUTION */

app.post('/api/fleet/fines/match', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { vehicleId, fineDateTime } = req.body;

    if (!vehicleId || !fineDateTime) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle and fine date/time are required'
      });
    }

    const fineTime = new Date(fineDateTime);

    const assignmentsSnap = await db.collection('fleetAssignments')
      .where('companyId', '==', companyId)
      .where('vehicleId', '==', vehicleId)
      .get();

    let matched = null;

    assignmentsSnap.docs.forEach(doc => {
      const a = doc.data();

      const start = a.startTime ? new Date(a.startTime) : null;
      const end = a.endTime ? new Date(a.endTime) : null;

      if (start && end && fineTime >= start && fineTime <= end) {
        matched = {
          assignmentId: doc.id,
          driverId: a.driverId || '',
          driverName: a.driverName || '',
          vehicleNumber: a.vehicleNumber || '',
          matchSource: 'assignment_time'
        };
      }

      if (!matched && a.status === 'active') {
        matched = {
          assignmentId: doc.id,
          driverId: a.driverId || '',
          driverName: a.driverName || '',
          vehicleNumber: a.vehicleNumber || '',
          matchSource: 'active_assignment'
        };
      }
    });

    if (matched) {
      return res.json({
        success: true,
        matched: true,
        match: matched
      });
    }

    res.json({
      success: true,
      matched: false,
      message: 'No matching driver found. Please select driver manually.'
    });

  } catch (err) {
    console.error('Fine match error:', err);
    res.status(500).json({
      success: false,
      message: 'Fine match error'
    });
  }
});


app.post('/api/fleet/fines', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      vehicleId,
      fineDateTime,
      fineType,
      fineAmount,
      fineNumber,
      location,
      description,
      responsibleDriverId,
      responsibleDriverName,
      matchedAssignmentId,
      attributionStatus,
      supervisorRemarks
    } = req.body;

    if (!vehicleId || !fineDateTime || !fineType) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle, fine date/time and fine type are required'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();

    if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const now = new Date().toISOString();

    await db.collection('fleetTrafficFines').add({
      companyId,

      vehicleId,
      vehicleNumber: vehicle.vehicleNumber || '',

      fineDateTime,
      fineType,
      fineAmount: Number(fineAmount || 0),
      fineNumber: fineNumber || '',
      location: location || '',
      description: description || '',

      responsibleDriverId: responsibleDriverId || '',
      responsibleDriverName: responsibleDriverName || '',
      matchedAssignmentId: matchedAssignmentId || '',

      attributionStatus: attributionStatus || 'unmatched',
      status: 'pending',

      supervisorRemarks: supervisorRemarks || '',

      createdBy: req.session.fleetUserId || companyId,
      createdByRole: 'fleet_admin',
      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Traffic fine saved successfully'
    });

  } catch (err) {
    console.error('Fine save error:', err);
    res.status(500).json({
      success: false,
      message: 'Fine save error'
    });
  }
});

app.post('/api/fleet/fines/:fineId/update', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { fineId } = req.params;

    const {
      vehicleId,
      fineDateTime,
      fineType,
      fineAmount,
      fineNumber,
      location,
      description,
      responsibleDriverId,
      responsibleDriverName,
      attributionStatus,
      status,
      correctionReason
    } = req.body;

    if (!correctionReason) {
      return res.status(400).json({
        success: false,
        message: 'Correction reason is required'
      });
    }

    if (!vehicleId || !fineDateTime || !fineType) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle, fine date/time and fine type are required'
      });
    }

    const fineRef = db.collection('fleetTrafficFines').doc(fineId);
    const fineDoc = await fineRef.get();

    if (!fineDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Traffic fine not found'
      });
    }

    const oldData = fineDoc.data();

    if (oldData.companyId !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized traffic fine'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();

    if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const now = new Date().toISOString();

    const historyItem = {
      modifiedBy: req.session.fleetUserId || companyId,
      modifiedByRole: 'fleet_admin',
      modifiedAt: now,
      correctionReason,
      oldData
    };

    await fineRef.update({
      vehicleId,
      vehicleNumber: vehicle.vehicleNumber || '',

      fineDateTime,
      fineType,
      fineAmount: Number(fineAmount || 0),
      fineNumber: fineNumber || '',
      location: location || '',
      description: description || '',

      responsibleDriverId: responsibleDriverId || '',
      responsibleDriverName: responsibleDriverName || '',

      attributionStatus: attributionStatus || 'manual',
      status: status || oldData.status || 'pending',

      correctionReason,
      editHistory: [...(oldData.editHistory || []), historyItem],

      lastModifiedBy: req.session.fleetUserId || companyId,
      lastModifiedByRole: 'fleet_admin',
      modifiedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Traffic fine updated successfully'
    });

  } catch (err) {
    console.error('Fine update error:', err);
    res.status(500).json({
      success: false,
      message: 'Traffic fine update error'
    });
  }
});

/* FLEET FUEL CARD MASTER */

app.post('/api/fleet/fuel-cards', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      fuelCompany,
      cardNumber,
      cardType,
      assignedVehicleId,
      monthlyLimit,
      status,
      remarks
    } = req.body;

    if (!fuelCompany || !cardNumber || !cardType) {
      return res.status(400).json({
        success: false,
        message: 'Fuel company, card number and card type are required'
      });
    }

    if (cardType === 'dedicated' && !assignedVehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Dedicated card must be assigned to a vehicle'
      });
    }

    let assignedVehicleNumber = '';

    if (assignedVehicleId) {
      const vehicleDoc = await db.collection('fleetVehicles').doc(assignedVehicleId).get();

      if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
        return res.status(404).json({
          success: false,
          message: 'Assigned vehicle not found'
        });
      }

      assignedVehicleNumber = vehicleDoc.data().vehicleNumber || '';
    }

    const existingSnap = await db.collection('fleetFuelCards')
      .where('companyId', '==', companyId)
      .where('cardNumber', '==', String(cardNumber).trim())
      .get();

    if (!existingSnap.empty) {
      return res.status(400).json({
        success: false,
        message: 'This fuel card number already exists'
      });
    }

    const now = new Date().toISOString();

    await db.collection('fleetFuelCards').add({
      companyId,

      fuelCompany,
      cardNumber: String(cardNumber).trim(),
      cardType, // dedicated / open

      assignedVehicleId: cardType === 'dedicated' ? assignedVehicleId : '',
      assignedVehicleNumber: cardType === 'dedicated' ? assignedVehicleNumber : '',

      monthlyLimit: Number(monthlyLimit || 0),
      status: status || 'active',
      remarks: remarks || '',

      createdBy: req.session.fleetUserId || companyId,
      createdByRole: 'fleet_admin',
      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fuel card created successfully'
    });

  } catch (err) {
    console.error('Fuel card create error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel card create error'
    });
  }
});


app.get('/api/fleet/fuel-cards', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetFuelCards')
      .where('companyId', '==', companyId)
      .get();

    const cards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    cards.sort((a, b) => {
      if (a.cardType === b.cardType) {
        return String(a.cardNumber).localeCompare(String(b.cardNumber));
      }
      return a.cardType === 'dedicated' ? -1 : 1;
    });

    res.json({
      success: true,
      cards
    });

  } catch (err) {
    console.error('Fuel card fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel card fetch error'
    });
  }
});


app.post('/api/fleet/fuel-cards/:cardId/status', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { cardId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'lost', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid card status'
      });
    }

    const cardRef = db.collection('fleetFuelCards').doc(cardId);
    const cardDoc = await cardRef.get();

    if (!cardDoc.exists || cardDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Fuel card not found'
      });
    }

    await cardRef.update({
      status,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Fuel card status updated'
    });

  } catch (err) {
    console.error('Fuel card status error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel card status error'
    });
  }
});


app.get('/api/fleet/fuel-cards/options/:vehicleId', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { vehicleId } = req.params;

    const snapshot = await db.collection('fleetFuelCards')
      .where('companyId', '==', companyId)
      .where('status', '==', 'active')
      .get();

    const cards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const assignedCards = cards.filter(c =>
      c.cardType === "dedicated" && c.assignedVehicleId === vehicleId
    );

    const openCards = cards.filter(c => c.cardType === "open");

    res.json({
      success: true,
      assignedCards,
      openCards
    });

  } catch (err) {
    console.error("Fuel card options error:", err);
    res.status(500).json({
      success: false,
      message: "Fuel card options error"
    });
  }
});


app.get('/api/driver/fuel-card-options', requireDriver, async (req, res) => {
  try {
    const companyId = req.session.driverCompanyId;
    const driverUserId = req.session.driverUserId;

    const driverUserDoc = await db.collection('fleetUsers').doc(driverUserId).get();

    if (!driverUserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Driver user not found'
      });
    }

    const driverUser = driverUserDoc.data();
    const linkedDriverId = driverUser.linkedDriverId || '';

    if (!linkedDriverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver account is not linked'
      });
    }

    const driverDoc = await db.collection('fleetDrivers').doc(linkedDriverId).get();

    if (!driverDoc.exists || driverDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Driver profile not found'
      });
    }

    const driver = driverDoc.data();

    if (!driver.assignedVehicleId) {
      return res.status(400).json({
        success: false,
        message: 'No vehicle assigned'
      });
    }

    const vehicleId = driver.assignedVehicleId;

    const snapshot = await db.collection('fleetFuelCards')
      .where('companyId', '==', companyId)
      .where('status', '==', 'active')
      .get();

    const cards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const assignedCards = cards.filter(c =>
      c.cardType === "dedicated" && c.assignedVehicleId === vehicleId
    );

    const openCards = cards.filter(c => c.cardType === "open");

    res.json({
      success: true,
      assignedCards,
      openCards
    });

  } catch (err) {
    console.error("Driver fuel card options error:", err);
    res.status(500).json({
      success: false,
      message: "Driver fuel card options error"
    });
  }
});

async function getFuelCardForEntry(companyId, vehicleId, selectedFuelCardId) {
  if (!selectedFuelCardId) {
    return {
      fuelCardId: "",
      fuelCardNumber: "",
      fuelCardType: "",
      usedOpenCard: false
    };
  }

  const cardDoc = await db.collection("fleetFuelCards").doc(selectedFuelCardId).get();

  if (!cardDoc.exists || cardDoc.data().companyId !== companyId) {
    throw new Error("Selected fuel card not found");
  }

  const card = cardDoc.data();

  if (card.status !== "active") {
    throw new Error("Selected fuel card is not active");
  }

  if (card.cardType === "dedicated" && card.assignedVehicleId !== vehicleId) {
    throw new Error("This dedicated card is not assigned to this vehicle");
  }

  return {
    fuelCardId: selectedFuelCardId,
    fuelCardNumber: card.cardNumber || "",
    fuelCardType: card.cardType || "",
    usedOpenCard: card.cardType === "open"
  };
}

/* FUEL SUPPLIER STATEMENT RECONCILIATION */

app.post('/api/fleet/fuel-statements', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      fuelCompany,
      invoiceNo,
      statementMonth,
      invoiceDate,
      dueDate,
      totalAmount,
      vatAmount,
      remarks
    } = req.body;

    if (!fuelCompany || !invoiceNo || !statementMonth) {
      return res.status(400).json({
        success: false,
        message: 'Fuel company, invoice number and statement month are required'
      });
    }

    const now = new Date().toISOString();

    const statementRef = await db.collection('fleetFuelStatements').add({
      companyId,
      fuelCompany,
      invoiceNo,
      statementMonth,
      invoiceDate: invoiceDate || '',
      dueDate: dueDate || '',
      totalAmount: Number(totalAmount || 0),
      vatAmount: Number(vatAmount || 0),
      remarks: remarks || '',
      status: 'open',
      createdBy: req.session.fleetUserId || companyId,
      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fuel statement created successfully',
      statementId: statementRef.id
    });

  } catch (err) {
    console.error('Fuel statement create error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel statement create error'
    });
  }
});


app.get('/api/fleet/fuel-statements', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetFuelStatements')
      .where('companyId', '==', companyId)
      .get();

    const statements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    statements.sort((a,b)=>new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      statements
    });

  } catch (err) {
    console.error('Fuel statements fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel statements fetch error'
    });
  }
});


app.post('/api/fleet/fuel-statement-lines', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
      statementId,
      cardNumber,
      vehicleNumber,
      transactionDateTime,
      station,
      product,
      liters,
      amount,
      vatAmount,
      odometer
    } = req.body;

    if (!statementId || !cardNumber || !transactionDateTime || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Statement, card number, transaction date/time and amount are required'
      });
    }

    const statementDoc = await db.collection('fleetFuelStatements').doc(statementId).get();

    if (!statementDoc.exists || statementDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Fuel statement not found'
      });
    }

    const now = new Date().toISOString();

    const lineRef = await db.collection('fleetFuelStatementLines').add({
      companyId,
      statementId,

      fuelCompany: statementDoc.data().fuelCompany || '',
      invoiceNo: statementDoc.data().invoiceNo || '',
      statementMonth: statementDoc.data().statementMonth || '',

      cardNumber: String(cardNumber || '').trim(),
      vehicleNumber: String(vehicleNumber || '').toUpperCase().trim(),
      transactionDateTime,
      station: station || '',
      product: product || '',
      liters: Number(liters || 0),
      amount: Number(amount || 0),
      vatAmount: Number(vatAmount || 0),
      odometer: odometer || '',

      reconciliationStatus: 'pending',
      matchedFuelLogId: '',
      mismatchReason: '',
      manualNotes: '',

      createdAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Statement line added successfully',
      lineId: lineRef.id
    });

  } catch (err) {
    console.error('Statement line create error:', err);
    res.status(500).json({
      success: false,
      message: 'Statement line create error'
    });
  }
});


app.get('/api/fleet/fuel-statement-lines/:statementId', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { statementId } = req.params;

    const snapshot = await db.collection('fleetFuelStatementLines')
      .where('companyId', '==', companyId)
      .where('statementId', '==', statementId)
      .get();

    const lines = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    lines.sort((a,b)=>new Date(b.transactionDateTime || 0) - new Date(a.transactionDateTime || 0));

    res.json({
      success: true,
      lines
    });

  } catch (err) {
    console.error('Statement lines fetch error:', err);
    res.status(500).json({
      success: false,
      message: 'Statement lines fetch error'
    });
  }
});


app.post('/api/fleet/fuel-statement-lines/:lineId/reconcile', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { lineId } = req.params;

    const lineRef = db.collection('fleetFuelStatementLines').doc(lineId);
    const lineDoc = await lineRef.get();

    if (!lineDoc.exists || lineDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success: false,
        message: 'Statement line not found'
      });
    }

    const line = lineDoc.data();

    const fuelSnap = await db.collection('fleetFuelLogs')
      .where('companyId', '==', companyId)
      .get();

    const fuelLogs = fuelSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const lineAmount = Number(line.amount || 0);
    const lineLiters = Number(line.liters || 0);
    const lineCard = String(line.cardNumber || '').trim();
    const lineVehicle = String(line.vehicleNumber || '').replace(/\s+/g,'').toUpperCase();

    let bestMatch = null;

    for (const log of fuelLogs) {
      const logCard = String(log.fuelCardNumber || '').trim();
      const logVehicle = String(log.vehicleNumber || '').replace(/\s+/g,'').toUpperCase();
      const logAmount = Number(log.amount || 0);
      const logLiters = Number(log.liters || 0);

      const cardMatch = logCard && logCard === lineCard;
      const vehicleMatch = lineVehicle && logVehicle && logVehicle === lineVehicle;
      const amountMatch = Math.abs(logAmount - lineAmount) <= 0.050;
      const litersMatch = !lineLiters || Math.abs(logLiters - lineLiters) <= 0.100;

      if (cardMatch && amountMatch && litersMatch) {
        bestMatch = {
          id: log.id,
          status: vehicleMatch ? 'matched' : 'matched_card_amount_vehicle_mismatch',
          mismatchReason: vehicleMatch ? '' : 'Card and amount matched, but vehicle number is different'
        };
        break;
      }
    }

    if (bestMatch) {
      await lineRef.update({
        reconciliationStatus: bestMatch.status,
        matchedFuelLogId: bestMatch.id,
        mismatchReason: bestMatch.mismatchReason,
        reconciledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: bestMatch.status === 'matched'
          ? 'Statement line matched successfully'
          : 'Statement line matched with warning',
        status: bestMatch.status
      });
    }

    await lineRef.update({
      reconciliationStatus: 'unmatched',
      matchedFuelLogId: '',
      mismatchReason: 'No matching fuel entry found by card, amount and liters',
      reconciledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'No matching fuel entry found',
      status: 'unmatched'
    });

  } catch (err) {
    console.error('Fuel reconciliation error:', err);
    res.status(500).json({
      success: false,
      message: 'Fuel reconciliation error'
    });
  }
});

app.post('/api/fleet/fuel-statements/:statementId/auto-reconcile', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { statementId } = req.params;

    const linesSnap = await db.collection('fleetFuelStatementLines')
      .where('companyId', '==', companyId)
      .where('statementId', '==', statementId)
      .get();

    const fuelSnap = await db.collection('fleetFuelLogs')
      .where('companyId', '==', companyId)
      .get();

    const fuelLogs = fuelSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    let matched = 0;
    let unmatched = 0;
    let warnings = 0;
    let openCardUsage = 0;
    let duplicates = 0;

    const seenKeys = {};

    for (const lineDoc of linesSnap.docs) {
      const line = lineDoc.data();

      const lineAmount = Number(line.amount || 0);
      const lineLiters = Number(line.liters || 0);
      const lineCard = String(line.cardNumber || '').trim();
      const lineVehicle = String(line.vehicleNumber || '').replace(/\s+/g, '').toUpperCase();
      const lineKey = `${lineCard}_${line.transactionDateTime}_${lineAmount}`;

      if (seenKeys[lineKey]) {
        duplicates++;

        await lineDoc.ref.update({
          reconciliationStatus: 'duplicate',
          mismatchReason: 'Duplicate transaction found in supplier statement',
          updatedAt: new Date().toISOString()
        });

        continue;
      }

      seenKeys[lineKey] = true;

      let bestMatch = null;

      for (const log of fuelLogs) {
        const logCard = String(log.fuelCardNumber || '').trim();
        const logVehicle = String(log.vehicleNumber || '').replace(/\s+/g, '').toUpperCase();
        const logAmount = Number(log.amount || 0);
        const logLiters = Number(log.liters || 0);

        const cardMatch = logCard && logCard === lineCard;
        const vehicleMatch = lineVehicle && logVehicle && logVehicle === lineVehicle;
        const amountMatch = Math.abs(logAmount - lineAmount) <= 0.050;
        const litersMatch = !lineLiters || Math.abs(logLiters - lineLiters) <= 0.100;

        if (cardMatch && amountMatch && litersMatch) {
          bestMatch = {
            id: log.id,
            usedOpenCard: !!log.usedOpenCard,
            status: vehicleMatch ? 'matched' : 'matched_card_amount_vehicle_mismatch',
            mismatchReason: vehicleMatch ? '' : 'Card and amount matched, but vehicle number is different'
          };
          break;
        }
      }

      if (bestMatch) {
        if (bestMatch.usedOpenCard) openCardUsage++;

        if (bestMatch.status === 'matched') {
          matched++;
        } else {
          warnings++;
        }

        await lineDoc.ref.update({
          reconciliationStatus: bestMatch.status,
          matchedFuelLogId: bestMatch.id,
          mismatchReason: bestMatch.mismatchReason,
          usedOpenCard: bestMatch.usedOpenCard,
          reconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      } else {
        unmatched++;

        await lineDoc.ref.update({
          reconciliationStatus: 'unmatched',
          matchedFuelLogId: '',
          mismatchReason: 'No matching fuel entry found by card, amount and liters',
          reconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    await db.collection('fleetFuelStatements').doc(statementId).update({
      lastAutoReconciledAt: new Date().toISOString(),
      reconciliationSummary: {
        matched,
        unmatched,
        warnings,
        duplicates,
        openCardUsage
      },
      status: unmatched === 0 && warnings === 0 && duplicates === 0
        ? 'fully_reconciled'
        : 'under_review',
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Auto reconciliation completed',
      summary: {
        matched,
        unmatched,
        warnings,
        duplicates,
        openCardUsage
      }
    });

  } catch (err) {
    console.error('Auto reconciliation error:', err);
    res.status(500).json({
      success: false,
      message: 'Auto reconciliation error'
    });
  }
});

/* FLEET REPORTS */
app.get('/api/fleet/reports/:reportType', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;
    const { reportType } = req.params;

    const allowedReports = {
  vehicles: 'fleetVehicles',
  drivers: 'fleetDrivers',
  assignments: 'fleetAssignments',
  checklists: 'fleetChecklists',
  maintenance: 'fleetMaintenance',
  fuelStatements: 'fleetFuelStatements',
  fuelStatementLines: 'fleetFuelStatementLines',
  fuel: 'fleetFuelLogs',
  fines: 'fleetTrafficFines'
};

    const collectionName = allowedReports[reportType];

    if (!collectionName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    const snapshot = await db.collection(collectionName)
      .where('companyId', '==', companyId)
      .get();

    const rows = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      reportType,
      rows
    });

  } catch (err) {
    console.error('Fleet report error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet report error'
    });
  }
});

/* FLEET FUEL / OIL MANAGEMENT */

app.post('/api/fleet/fuel', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const {
  vehicleId,
  driverId,
  entryType,
  fuelType,
  liters,
  amount,
  odometerReading,
  fuelStation,
  paymentMethod,
  fuelCardId,
  openCardReason,
  receiptNo,
  entryDate,
  remarks
} = req.body;

    if (!vehicleId || !entryType || !amount) {
      return res.status(400).json({
        success:false,
        message:'Vehicle, entry type and amount are required'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles').doc(vehicleId).get();

    if (!vehicleDoc.exists || vehicleDoc.data().companyId !== companyId) {
      return res.status(404).json({
        success:false,
        message:'Vehicle not found'
      });
    }

    let driverName = '';

    if (driverId) {
      const driverDoc = await db.collection('fleetDrivers').doc(driverId).get();
      if (driverDoc.exists && driverDoc.data().companyId === companyId) {
        driverName = driverDoc.data().driverName || '';
      }
    }

    const vehicle = vehicleDoc.data();
    const now = new Date().toISOString();

let fuelCardData = {
  fuelCardId: "",
  fuelCardNumber: "",
  fuelCardType: "",
  usedOpenCard: false
};

if (paymentMethod === "Company Card") {
  try {
    fuelCardData = await getFuelCardForEntry(companyId, vehicleId, fuelCardId);
  } catch (cardErr) {
    return res.status(400).json({
      success: false,
      message: cardErr.message
    });
  }

  if (!fuelCardData.fuelCardId) {
    return res.status(400).json({
      success: false,
      message: "Fuel card is required when payment method is Company Card"
    });
  }

  if (fuelCardData.usedOpenCard && !openCardReason) {
    return res.status(400).json({
      success: false,
      message: "Open card reason is required"
    });
  }
}

    await db.collection('fleetFuelLogs').add({
      companyId,

      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,

      driverId: driverId || '',
      driverName,

      entryType,
      fuelType: fuelType || '',
      liters: Number(liters || 0),
      amount: Number(amount || 0),
      odometerReading: odometerReading || '',
      fuelStation: fuelStation || '',
      paymentMethod: paymentMethod || '',

fuelCardId: fuelCardData.fuelCardId,
fuelCardNumber: fuelCardData.fuelCardNumber,
fuelCardType: fuelCardData.fuelCardType,
usedOpenCard: fuelCardData.usedOpenCard,
openCardReason: fuelCardData.usedOpenCard ? openCardReason : '',

receiptNo: receiptNo || '',
      entryDate: entryDate || '',

      remarks: remarks || '',

      createdAt: now,
      updatedAt: now
    });

    res.json({
      success:true,
      message:'Fuel / oil entry saved successfully'
    });

  } catch(err) {
    console.error('Fleet fuel save error:', err);
    res.status(500).json({
      success:false,
      message:'Fleet fuel save error'
    });
  }
});

app.get('/api/fleet/fuel', requireFleet, async (req, res) => {
  try {
    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetFuelLogs')
      .where('companyId','==',companyId)
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    records.sort((a,b)=>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json({
      success:true,
      records
    });

  } catch(err) {
    console.error('Fleet fuel fetch error:', err);
    res.status(500).json({
      success:false,
      message:'Fleet fuel fetch error'
    });
  }
});

/* DAILY TRIPS SYSTEM */

app.post('/api/fleet/daily-trips', requireFleet, async (req, res) => {
  try {

    const companyId = req.session.fleetCompanyId;

    const {
      vehicleId,
      driverId,
      shift,
      tripDate,
      openingKm,
      openingFuel,
      openingTyre,
      openingLights,
      openingDamage,
      openingNotes
    } = req.body;

    if (!vehicleId || !driverId || !openingKm) {
      return res.status(400).json({
        success:false,
        message:'Vehicle, driver and opening KM required'
      });
    }

    const vehicleDoc = await db.collection('fleetVehicles')
      .doc(vehicleId)
      .get();

    const driverDoc = await db.collection('fleetDrivers')
      .doc(driverId)
      .get();

    if (!vehicleDoc.exists || !driverDoc.exists) {
      return res.status(404).json({
        success:false,
        message:'Vehicle or driver not found'
      });
    }

    const vehicle = vehicleDoc.data();
    const driver = driverDoc.data();

    const now = new Date().toISOString();

    await db.collection('fleetDailyTrips').add({

      companyId,

      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,

      driverId,
      driverName: driver.driverName,

      shift: shift || '',
      tripDate: tripDate || '',

      openingKm,
      openingFuel,
      openingTyre,
      openingLights,
      openingDamage,
      openingNotes,

      closingKm:'',
      closingFuel:'',
      closingNotes:'',

      status:'active',

      createdAt: now,
      updatedAt: now
    });

    res.json({
      success:true,
      message:'Daily trip started successfully'
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:'Daily trip create error'
    });
  }
});

app.get('/api/fleet/daily-trips', requireFleet, async (req, res) => {
  try {

    const companyId = req.session.fleetCompanyId;

    const snapshot = await db.collection('fleetDailyTrips')
      .where('companyId','==',companyId)
      .get();

    const trips = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    trips.sort((a,b)=>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json({
      success:true,
      trips
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:'Daily trips fetch error'
    });
  }
});

app.post('/api/fleet/daily-trips/:tripId/close', requireFleet, async (req, res) => {
  try {

    const companyId = req.session.fleetCompanyId;

    const { tripId } = req.params;

    const {
      closingKm,
      closingFuel,
      closingNotes
    } = req.body;

    const tripRef = db.collection('fleetDailyTrips').doc(tripId);

    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success:false,
        message:'Trip not found'
      });
    }

    const trip = tripDoc.data();

    if (trip.companyId !== companyId) {
      return res.status(403).json({
        success:false,
        message:'Unauthorized trip'
      });
    }

    await tripRef.update({

      closingKm: closingKm || '',
      closingFuel: closingFuel || '',
      closingNotes: closingNotes || '',

      status:'closed',

      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success:true,
      message:'Daily trip closed successfully'
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:'Daily trip closing error'
    });
  }
});

/* =========================================================
   FLEET PUBLIC ALERT SYSTEM
========================================================= */

app.get('/fleet-owner/:qr_id', async (req, res) => {
  try {
    const qr_id = req.params.qr_id;

    const vehicleSnapshot = await db.collection('fleetVehicles')
      .where('qr_id', '==', qr_id)
      .limit(1)
      .get();

    if (vehicleSnapshot.empty) {
      return res.status(404).json({
        message: 'Fleet vehicle not found'
      });
    }

    const vehicle = vehicleSnapshot.docs[0].data();

    const companyDoc = await db.collection('fleetCompanies')
      .doc(vehicle.companyId)
      .get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        message: 'Fleet company not found'
      });
    }

    const company = companyDoc.data();

    if (company.status !== 'active' || !company.alertsEnabled) {
      return res.status(400).json({
        message: 'Fleet alert service is not active for this company'
      });
    }

    res.json({
      companyName: company.companyName,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType,
      qr_id: vehicle.qr_id,
      alertsEnabled: company.alertsEnabled
    });

  } catch (err) {
    console.error('Fleet owner error:', err);
    res.status(500).json({
      message: 'Fleet owner data error'
    });
  }
});

app.post('/send-fleet-alert', async (req, res) => {
  try {
    const { qr_id, alert_type, location } = req.body;

    if (!qr_id || !alert_type) {
      return res.status(400).json({
        success: false,
        message: 'QR ID and alert type are required'
      });
    }

    const alertLabel = formatFleetAlert(alert_type);

    if (!alertLabel) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fleet alert type selected'
      });
    }

    const vehicleSnapshot = await db.collection('fleetVehicles')
      .where('qr_id', '==', qr_id)
      .limit(1)
      .get();

    if (vehicleSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'No active fleet vehicle found for this QR'
      });
    }

    const vehicleRef = vehicleSnapshot.docs[0].ref;
    const vehicleDocId = vehicleSnapshot.docs[0].id;
    const vehicle = vehicleSnapshot.docs[0].data();

    const companyDoc = await db.collection('fleetCompanies')
      .doc(vehicle.companyId)
      .get();

    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Fleet company not found'
      });
    }

    const company = companyDoc.data();

    if (company.status !== 'active' || !company.alertsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Fleet alert service is not active for this company'
      });
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    let responsibleDriverId = '';
    let responsibleDriverName = '';
    let responsibleDriverMobile = '';
    let responsibilitySource = 'not_assigned';
    let activeTripId = '';

    const activeTripSnapshot = await db.collection('fleetDailyTrips')
      .where('companyId', '==', vehicle.companyId)
      .where('vehicleId', '==', vehicleDocId)
      .where('status', '==', 'active')
      .get();

    let activeTrip = null;

    if (!activeTripSnapshot.empty) {
      const activeTrips = activeTripSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => !t.tripDate || t.tripDate === today)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      if (activeTrips.length) {
        activeTrip = activeTrips[0];
      }
    }

    if (activeTrip) {
      activeTripId = activeTrip.id;
      responsibleDriverId = activeTrip.driverId || '';
      responsibleDriverName = activeTrip.driverName || '';
      responsibilitySource = 'active_daily_trip';

      if (responsibleDriverId) {
        const tripDriverDoc = await db.collection('fleetDrivers')
          .doc(responsibleDriverId)
          .get();

        if (
          tripDriverDoc.exists &&
          tripDriverDoc.data().companyId === vehicle.companyId
        ) {
          responsibleDriverMobile = cleanMobile(tripDriverDoc.data().mobile || '');
          responsibleDriverName = tripDriverDoc.data().driverName || responsibleDriverName;
        }
      }
    }

    if (!responsibleDriverId && vehicle.assignedDriverId) {
      const driverDoc = await db.collection('fleetDrivers')
        .doc(vehicle.assignedDriverId)
        .get();

      if (
        driverDoc.exists &&
        driverDoc.data().companyId === vehicle.companyId
      ) {
        const driver = driverDoc.data();

        responsibleDriverId = vehicle.assignedDriverId;
        responsibleDriverName = driver.driverName || vehicle.assignedDriverName || '';
        responsibleDriverMobile = cleanMobile(driver.mobile || '');
        responsibilitySource = 'vehicle_master_assignment';
      }
    }

    const notifySupervisor =
      company.fleetAlertSupervisorNotify === undefined
        ? true
        : !!company.fleetAlertSupervisorNotify;

    const supervisorMobile = notifySupervisor
      ? cleanMobile(company.fleetAlertSupervisorMobile || company.mobile || '')
      : '';

    const driverMessage = responsibleDriverMobile
      ? `Vehicall Fleet Alert

Vehicle: ${vehicle.vehicleNumber}
Alert: ${alertLabel}
Responsibility Source: ${responsibilitySource}
Action Required: Please attend to the vehicle immediately.

- Vehicall Fleet`
      : '';

    const supervisorMessage = supervisorMobile
      ? `Vehicall Fleet Alert

Company: ${company.companyName}
Vehicle: ${vehicle.vehicleNumber}
Alert: ${alertLabel}
Responsible Driver: ${responsibleDriverName || 'Not Assigned'}
Source: ${responsibilitySource}
Time: ${new Date().toLocaleString()}

- Vehicall Fleet`
      : '';

    const alertRef = await db.collection('fleetAlerts').add({
      companyId: vehicle.companyId,

      qr_id,
      vehicleId: vehicleDocId,
      vehicleNumber: vehicle.vehicleNumber,

      alertType: alert_type,
      alertLabel,

      responsibleDriverId,
      responsibleDriverName,
      responsibleDriverMobile,
      responsibilitySource,
      activeTripId,

      supervisorNotify: notifySupervisor,
      supervisorMobile,

      driverMessage,
      supervisorMessage,

      driverNotified: false,
      supervisorNotified: false,

      location: location || '',
      source: 'public_fleet_qr',
      status: 'created',

      createdAt: now,
      updatedAt: now
    });

    await db.collection('fleetIncidents').add({
      companyId: vehicle.companyId,

      vehicleId: vehicleDocId,
      vehicleNumber: vehicle.vehicleNumber,

      driverId: responsibleDriverId,
      driverName: responsibleDriverName,

      incidentType: alertLabel,
      priority: alert_type === 'EMERGENCY' ? 'high' : 'medium',

      description: alertLabel,
      location: location || '',
      incidentDate: now,

      status: 'open',
      source: 'public_fleet_qr',
      alertId: alertRef.id,

      responsibilitySource,
      activeTripId,

      createdAt: now,
      updatedAt: now
    });

    await vehicleRef.update({
      lastFleetAlertAt: now,
      lastFleetAlertType: alert_type,
      lastFleetAlertResponsibleDriverId: responsibleDriverId,
      lastFleetAlertResponsibleDriverName: responsibleDriverName,
      lastFleetAlertResponsibilitySource: responsibilitySource
    });

    res.json({
      success: true,
      message: 'Fleet alert created successfully',
      vehicleNumber: vehicle.vehicleNumber,
      issue: alertLabel,

      responsibleDriverName,
      responsibilitySource,

      driverNotificationReady: !!responsibleDriverMobile,
      driverMobile: responsibleDriverMobile || '',

      supervisorNotificationReady: !!supervisorMobile,
      supervisorMobile: supervisorMobile || ''
    });

  } catch (err) {
    console.error('Fleet alert error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet alert error'
    });
  }
});

/* =========================================================
   ADMIN SYSTEM
========================================================= */

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

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

app.get('/admin/dashboard-data', requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const alertsSnapshot = await db.collection('alerts').get();
    const fleetCompaniesSnapshot = await db.collection('fleetCompanies').get();
    const fleetVehiclesSnapshot = await db.collection('fleetVehicles').get();
    const fleetIncidentsSnapshot = await db.collection('fleetIncidents').get();

    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const alerts = alertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const fleetCompanies = fleetCompaniesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const fleetVehicles = fleetVehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const fleetIncidents = fleetIncidentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      totalUsers: users.length,
      totalAlerts: alerts.length,
      qrGenerated: users.filter(u => u.qr_generated).length,
      expiredPlans: users.filter(u => u.planEnd && new Date() > new Date(u.planEnd)).length,

      planCounts: {
        Welcome: users.filter(u => u.plan === 'Welcome').length,
        Basic: users.filter(u => u.plan === 'Basic').length,
        Plus: users.filter(u => u.plan === 'Plus').length,
        Premium: users.filter(u => u.plan === 'Premium').length
      },

      fleetStats: {
        totalFleetCompanies: fleetCompanies.length,
        activeFleetCompanies: fleetCompanies.filter(c => c.status === 'active').length,
        pendingFleetCompanies: fleetCompanies.filter(c => c.status === 'pending').length,
        totalFleetVehicles: fleetVehicles.length,
        openFleetIncidents: fleetIncidents.filter(i => i.status !== 'closed').length
      },

      recentUsers: users
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10),

      recentAlerts: alerts
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10),

      recentFleetCompanies: fleetCompanies
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10)
    });

  } catch (err) {
    console.error('Admin dashboard data error:', err);
    res.status(500).json({ message: 'Admin dashboard data error' });
  }
});

app.get('/admin/users-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (err) {
    console.error('Admin users data error:', err);
    res.status(500).json({ message: 'Admin users data error' });
  }
});

app.get('/admin/alerts-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('alerts').get();
    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    alerts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(alerts);
  } catch (err) {
    console.error('Admin alerts data error:', err);
    res.status(500).json({ message: 'Admin alerts data error' });
  }
});

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

app.post('/admin/reset-alerts', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/admin/extend-plan', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, months } = req.body;

    if (!vehicleNumber || !months) {
      return res.status(400).json({ message: 'Vehicle number and months are required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);
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

app.post('/admin/change-plan', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, plan, billingCycle } = req.body;

    if (!vehicleNumber || !plan) {
      return res.status(400).json({ message: 'Vehicle number and plan are required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/admin/update-user-status', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, status } = req.body;

    if (!vehicleNumber || !status) {
      return res.status(400).json({ message: 'Vehicle number and status are required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/admin/update-qr-status', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber, qrStatus } = req.body;

    if (!vehicleNumber || typeof qrStatus !== 'boolean') {
      return res.status(400).json({ message: 'Vehicle number and QR status are required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

app.post('/admin/regenerate-qr', requireAdmin, async (req, res) => {
  try {
    let { vehicleNumber } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    vehicleNumber = normalizeVehicleNumber(vehicleNumber);

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

/* ADMIN FLEET MANAGEMENT */
app.get('/admin/fleet-companies-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('fleetCompanies').get();

    const companies = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password;

      return {
        id: doc.id,
        ...data
      };
    });

    companies.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(companies);

  } catch (err) {
    console.error('Admin fleet companies error:', err);
    res.status(500).json([]);
  }
});

app.get('/admin/fleet-upgrade-requests', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('fleetUpgradeRequests')
      .where('status', '==', 'pending')
      .get();

    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(requests);

  } catch (err) {
    console.error('Admin fleet upgrade requests error:', err);
    res.status(500).json([]);
  }
});

app.post('/admin/fleet/approve-upgrade', requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Upgrade request ID is required'
      });
    }

    const requestRef = db.collection('fleetUpgradeRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade request not found'
      });
    }

    const request = requestDoc.data();

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This upgrade request is already processed'
      });
    }

    const now = new Date().toISOString();

    await db.collection('fleetCompanies').doc(request.companyId).update({
      packageType: request.requestedPackageType,
      packageLabel: request.requestedPackageLabel,
      vehicleLimit: request.requestedVehicleLimit,
      branchLimit: request.requestedBranchLimit,
      managerLimit: request.requestedManagerLimit,

      alertOption: request.requestedAlertOption,
      alertsEnabled: !!request.requestedAlertsEnabled,

      paymentStatus: 'confirmed',
      upgradeRequestStatus: 'approved',
      lastApprovedUpgradeRequestId: requestId,
      packageUpgradedAt: now,
      lastAdminAction: `Fleet package upgraded to ${request.requestedPackageLabel}`
    });

    await requestRef.update({
      status: 'approved',
      paymentStatus: 'confirmed',
      approvedAt: now,
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Fleet upgrade approved and package updated successfully'
    });

  } catch (err) {
    console.error('Approve fleet upgrade error:', err);
    res.status(500).json({
      success: false,
      message: 'Approve fleet upgrade error'
    });
  }
});

app.post('/admin/fleet/reject-upgrade', requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Upgrade request ID is required'
      });
    }

    const requestRef = db.collection('fleetUpgradeRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade request not found'
      });
    }

    const request = requestDoc.data();
    const now = new Date().toISOString();

    await requestRef.update({
      status: 'rejected',
      paymentStatus: 'rejected',
      rejectedAt: now,
      updatedAt: now
    });

    if (request.companyId) {
      await db.collection('fleetCompanies').doc(request.companyId).update({
        upgradeRequestStatus: 'rejected',
        lastRejectedUpgradeRequestId: requestId,
        lastAdminAction: 'Fleet upgrade request rejected',
        lastUpdatedAt: now
      });
    }

    res.json({
      success: true,
      message: 'Fleet upgrade request rejected'
    });

  } catch (err) {
    console.error('Reject fleet upgrade error:', err);
    res.status(500).json({
      success: false,
      message: 'Reject fleet upgrade error'
    });
  }
});

app.post('/admin/fleet/approve', requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    await db.collection('fleetCompanies').doc(companyId).update({
      status: 'active',
      paymentStatus: 'confirmed',
      approved: true,
      activatedAt: new Date().toISOString(),
      lastAdminAction: 'Fleet company approved and activated'
    });

    res.json({
      success: true,
      message: 'Fleet company approved and activated successfully'
    });

  } catch (err) {
    console.error('Fleet approve error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet approve error'
    });
  }
});

app.post('/admin/fleet/update-status', requireAdmin, async (req, res) => {
  try {
    const { companyId, status } = req.body;

    if (!companyId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Company ID and status are required'
      });
    }

    if (!['active', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fleet company status'
      });
    }

    await db.collection('fleetCompanies').doc(companyId).update({
      status,
      statusUpdatedAt: new Date().toISOString(),
      lastAdminAction: `Fleet company status changed to ${status}`
    });

    res.json({
      success: true,
      message: `Fleet company ${status} successfully`
    });

  } catch (err) {
    console.error('Fleet status update error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet status update error'
    });
  }
});

app.post('/admin/fleet/change-package', requireAdmin, async (req, res) => {
  try {
    const { companyId, packageType, alertOption } = req.body;

    if (!companyId || !packageType) {
      return res.status(400).json({
        success: false,
        message: 'Company ID and package type are required'
      });
    }

    const cleanPackage = String(packageType).toLowerCase().trim();

    if (!fleetPackages[cleanPackage]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fleet package selected'
      });
    }

    const packageDetails = getFleetPackageDetails(cleanPackage);

    const updateData = {
      packageType: cleanPackage,
      packageLabel: packageDetails.label,
      vehicleLimit: packageDetails.vehicleLimit,
      branchLimit: packageDetails.branchLimit,
      managerLimit: packageDetails.managerLimit,
      packageChangedAt: new Date().toISOString(),
      lastAdminAction: `Fleet package changed to ${packageDetails.label}`
    };

    if (alertOption && ['with_alerts', 'without_alerts'].includes(alertOption)) {
      updateData.alertOption = alertOption;
      updateData.alertsEnabled = alertOption === 'with_alerts';
    }

    await db.collection('fleetCompanies').doc(companyId).update(updateData);

    res.json({
      success: true,
      message: 'Fleet package updated successfully'
    });

  } catch (err) {
    console.error('Fleet package change error:', err);
    res.status(500).json({
      success: false,
      message: 'Fleet package change error'
    });
  }
});

app.get('/admin/fleet-vehicles-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('fleetVehicles').get();

    const vehicles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    vehicles.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(vehicles);

  } catch (err) {
    console.error('Admin fleet vehicles error:', err);
    res.status(500).json([]);
  }
});

app.get('/admin/fleet-incidents-data', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('fleetIncidents').get();

    const incidents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    incidents.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json(incidents);

  } catch (err) {
    console.error('Admin fleet incidents error:', err);
    res.status(500).json([]);
  }
});

/* SERVER START */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});