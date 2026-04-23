const express = require("express");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* --------------------------
   TEMP VEHICLE DATA (for testing)
-------------------------- */
const vehicles = {
    "123": { name: "Hafeez", phone: "79117236" },
    "456": { name: "Praveen", phone: "79117459" },
    "999": { name: "Test User", phone: "79111111" }
};

/* --------------------------
   VEHICLE PAGE
-------------------------- */
app.get("/vehicle/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* --------------------------
   ALERT API
-------------------------- */
app.post("/alert", (req, res) => {
    const { type, vehicleId } = req.body;

    const vehicle = vehicles[vehicleId];

    if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
    }

    const message = `🚗 Vehicall Alert
Issue: ${type}
Time: ${new Date().toLocaleString()}`;

    const whatsappLink = `https://wa.me/968${vehicle.phone}?text=${encodeURIComponent(message)}`;

    res.json({
        success: true,
        link: whatsappLink
    });
});

/* --------------------------
   QR GENERATOR
-------------------------- */
app.get("/qr/:id", async (req, res) => {
    const vehicleId = req.params.id;
    const vehicleUrl = `https://www.vehicallapp.com/vehicle/${vehicleId}`;

    try {
        const qrImage = await QRCode.toDataURL(vehicleUrl);

        res.send(`
            <html>
                <head>
                    <title>Vehicall QR</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                </head>
                <body style="text-align:center;font-family:Arial;background:#0a1a2f;color:white;padding:20px;">
                    <h1>Vehicall QR Code</h1>
                    <p><strong>Vehicle ID:</strong> ${vehicleId}</p>
                    
                    <div style="background:white;display:inline-block;padding:15px;border-radius:10px;">
                        <img src="${qrImage}" />
                    </div>

                    <p style="margin-top:20px;">${vehicleUrl}</p>

                    <hr style="margin:20px;">
                    <p>Scan to notify vehicle owner</p>
                </body>
            </html>
        `);

    } catch (err) {
        res.status(500).send("Error generating QR");
    }
});

/* --------------------------
   ADMIN (BASIC FORM)
-------------------------- */
app.get("/admin", (req, res) => {
    res.send(`
        <h2>Add Vehicle</h2>
        <form method="POST" action="/admin/add-vehicle">
            Vehicle Code: <input name="code"/><br/>
            Name: <input name="name"/><br/>
            Phone: <input name="phone"/><br/>
            <button type="submit">Save</button>
        </form>
    `);
});

app.post("/admin/add-vehicle", (req, res) => {
    const { code, name, phone } = req.body;

    vehicles[code] = {
        name: name,
        phone: phone
    };

    res.send(`Vehicle ${code} added successfully`);
});

/* --------------------------
   START SERVER
-------------------------- */
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});