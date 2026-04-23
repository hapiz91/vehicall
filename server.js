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
        const qrImage = await QRCode.toDataURL(vehicleUrl, {
            width: 350,
            margin: 2
        });

        res.send(`
            <html>
                <head>
                    <title>Vehicall QR</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            margin: 0;
                            font-family: Arial, sans-serif;
                            background: #071a33;
                            color: white;
                            text-align: center;
                            padding: 30px 20px;
                        }

                        .card {
                            max-width: 800px;
                            margin: auto;
                            background: #0d2547;
                            border-radius: 18px;
                            padding: 30px;
                            box-shadow: 0 0 20px rgba(0,0,0,0.25);
                        }

                        .logo {
                            width: 100px;
                            margin-bottom: 10px;
                        }

                        h1 {
                            margin: 10px 0;
                            font-size: 42px;
                        }

                        h2 {
                            font-size: 24px;
                            margin-bottom: 20px;
                        }

                        .highlight {
                            color: #ffbf2f;
                        }

                        .qr-box {
                            background: white;
                            display: inline-block;
                            padding: 18px;
                            border-radius: 16px;
                            margin: 20px 0;
                        }

                        .sub {
                            font-size: 20px;
                            margin-top: 10px;
                        }

                        .note {
                            color: #ffbf2f;
                            font-size: 18px;
                            font-weight: bold;
                            margin-top: 6px;
                        }

                        .url-box {
                            margin: 25px auto;
                            padding: 16px;
                            max-width: 650px;
                            background: #10294d;
                            border-radius: 10px;
                            font-size: 22px;
                            word-break: break-word;
                        }

                        .btn-row {
                            margin-top: 20px;
                        }

                        .btn {
                            display: inline-block;
                            margin: 10px;
                            padding: 16px 28px;
                            border-radius: 12px;
                            text-decoration: none;
                            font-size: 20px;
                            font-weight: bold;
                            color: white;
                            border: none;
                            cursor: pointer;
                        }

                        .download-btn {
                            background: #2d6cdf;
                        }

                        .print-btn {
                            background: #2fa866;
                        }

                        .sticker-preview {
                            margin-top: 40px;
                            background: #0b1f3c;
                            padding: 25px;
                            border-radius: 16px;
                        }

                        .sticker-box {
                            margin: 20px auto;
                            background: white;
                            color: #071a33;
                            max-width: 700px;
                            border-radius: 18px;
                            padding: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 20px;
                            flex-wrap: wrap;
                        }

                        .sticker-left {
                            flex: 1;
                            min-width: 220px;
                            text-align: left;
                        }

                        .sticker-left img {
                            width: 80px;
                            margin-bottom: 10px;
                        }

                        .sticker-title {
                            font-size: 36px;
                            font-weight: bold;
                        }

                        .sticker-sub {
                            font-size: 18px;
                            margin-top: 12px;
                            line-height: 1.4;
                        }

                        .sticker-note {
                            margin-top: 18px;
                            font-size: 18px;
                            font-weight: bold;
                        }

                        .sticker-right {
                            flex: 1;
                            min-width: 220px;
                            text-align: center;
                        }

                        .sticker-right img {
                            max-width: 220px;
                        }

                        .footer-line {
                            margin-top: 20px;
                            font-size: 18px;
                            color: #ffbf2f;
                            font-weight: bold;
                        }

                        @media print {
                            body {
                                background: white;
                                color: black;
                                padding: 0;
                            }

                            .btn-row,
                            .url-box,
                            .sub,
                            .note,
                            h2 {
                                display: none;
                            }

                            .card {
                                box-shadow: none;
                                background: white;
                                color: black;
                                max-width: 100%;
                                border-radius: 0;
                            }

                            .sticker-preview {
                                background: white;
                                padding: 0;
                            }

                            h1 {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <img src="/logo.png" alt="Vehicall Logo" class="logo">
                        <h1>Vehicall QR Code</h1>
                        <h2>Vehicle ID: <span class="highlight">${vehicleId}</span></h2>

                        <div class="qr-box">
                            <img src="${qrImage}" alt="QR Code">
                        </div>

                        <div class="sub">Scan to notify vehicle owner</div>
                        <div class="note">No phone number shared</div>

                        <div class="url-box">${vehicleUrl}</div>

                        <div class="btn-row">
                            <a class="btn download-btn" href="${qrImage}" download="vehicall-${vehicleId}.png">
                                Download QR (PNG)
                            </a>

                            <button class="btn print-btn" onclick="window.print()">
                                Print / Sticker Layout
                            </button>
                        </div>

                        <div class="sticker-preview">
                            <h2>Sticker Preview</h2>

                            <div class="sticker-box">
                                <div class="sticker-left">
                                    <img src="/logo.png" alt="Vehicall Logo">
                                    <div class="sticker-title">VEHICALL</div>
                                    <div class="sticker-sub">
                                        Scan to notify<br>
                                        vehicle owner
                                    </div>
                                    <div class="sticker-note">
                                        No phone number shared
                                    </div>
                                </div>

                                <div class="sticker-right">
                                    <img src="${qrImage}" alt="Sticker QR">
                                </div>
                            </div>

                            <div class="footer-line">
                                www.vehicallapp.com
                            </div>
                        </div>
                    </div>
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