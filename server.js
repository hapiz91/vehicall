const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

// Fake database
const vehicles = {
    "123": { name: "Hafeez", phone: "79117236" },
    "456": { name: "Praveen", phone: "79117459" }
};

// Dynamic route
app.get("/vehicle/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Alert API
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

    console.log("🚗 Alert:", type);
    console.log("👤 Owner:", vehicle.name);
    console.log("📞 Phone:", vehicle.phone);
    console.log("📲 WhatsApp:", whatsappLink);

    res.json({
        success: true,
        link: whatsappLink
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});