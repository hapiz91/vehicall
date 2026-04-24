const admin = require('firebase-admin');

let serviceAccount;

// 🔹 If running on Render (environment variable exists)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Fix private key formatting (important for Render)
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
    process.exit(1);
  }
} 
// 🔹 If running locally
else {
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { db };