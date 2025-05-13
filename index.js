const admin = require("firebase-admin");

if (!process.env.FIREBASE_CONFIG_JSON) {
  console.error("❌ FIREBASE_CONFIG_JSON is not set!");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fall-detection-1-c2dae-default-rtdb.firebaseio.com/"
});

const db = admin.database();
const sensorDataRef = db.ref("/sensor_data");

let previousStatus = null;
let lastNotificationTime = 0;

async function checkStatus() {
  try {
    const snapshot = await sensorDataRef.once("value");
    const data = snapshot.val();

    if (data) {
      const status = data.status;
      const currentTime = Date.now();

      if (status && status.toLowerCase().includes("jatuh")) {
        const isFirstFall = previousStatus && !previousStatus.toLowerCase().includes("jatuh");
        const threeMinutesPassed = (currentTime - lastNotificationTime) >= 3 * 60 * 1000;

        if (isFirstFall || threeMinutesPassed) {
          const fcmTokenSnapshot = await sensorDataRef.child("fcmToken").once("value");
          const fcmToken = fcmTokenSnapshot.val();

          if (fcmToken) {
            const message = {
              notification: {
                title: "🚨 Fall Detected!",
                body: "Seseorang terjatuh! Segera cek!",
              },
              data: {
                title: "🚨 Fall Detected!",
                body: "Seseorang terjatuh! Segera cek!",
              },
              token: fcmToken,
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  channelId: "FALL_GUARD_NOTIFICATION",
                  visibility: "public",
                },
              },
            };

            await admin.messaging().send(message);
            console.log("✅ Notifikasi berhasil dikirim");

            await sensorDataRef.child("notified").set(true);
            lastNotificationTime = currentTime;
          } else {
            console.log("⚠️ FCM Token tidak ditemukan");
          }
        } else {
          console.log("⌛ Status masih jatuh, menunggu 3 menit sebelum kirim notifikasi lagi");
        }
      } else {
        console.log("✅ Status tidak jatuh");
      }

      previousStatus = status;
    } else {
      console.log("⚠️ Tidak ada data sensor");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

setInterval(checkStatus, 1000);

const express = require("express");
const app = express();

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Service berjalan di port ${PORT}`);
});
