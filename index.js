const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

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
        const fiveMinutesPassed = (currentTime - lastNotificationTime) >= 3 * 60 * 1000;

        if (isFirstFall || fiveMinutesPassed) {
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
            console.log("Notifikasi berhasil dikirim");

            await sensorDataRef.child("notified").set(true);
            lastNotificationTime = currentTime;
          } else {
            console.log("FCM Token tidak ditemukan");
          }
        } else {
          console.log("Status masih jatuh, menunggu 3 menit sebelum kirim notifikasi lagi");
        }
      } else {
        console.log("Status tidak jatuh");
      }

      previousStatus = status;
    } else {
      console.log("Tidak ada data sensor");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

setInterval(checkStatus, 1000);
