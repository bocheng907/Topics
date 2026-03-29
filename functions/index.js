/* global Intl */
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

setGlobalOptions({maxInstances: 10});

initializeApp();
const db = getFirestore();

function getTaipeiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getTaipeiHHMM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

async function getUserPushTokens(userIds) {
  const tokens = [];

  for (const uid of userIds) {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("devices")
      .where("enabled", "==", true)
      .get();

    snap.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) {
        tokens.push(String(data.expoPushToken));
      }
    });
  }

  return [...new Set(tokens)];
}

async function sendExpoPush(tokens, title, body, data) {
  if (!tokens.length) {
    return {success: false, reason: "no_tokens"};
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const text = await res.text();
  return {
    success: true,
    response: text,
  };
}

// 測試用：.../sendTestPush?uid=你的uid
exports.sendTestPush = onRequest(async (req, res) => {
  try {
    const uid = String(req.query.uid || "");

    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    const tokens = await getUserPushTokens([uid]);

    if (!tokens.length) {
      res.status(404).send("No push tokens found for this user");
      return;
    }

    const result = await sendExpoPush(
      tokens,
      "測試通知🔥",
      "你已經成功打通推播系統了",
      {type: "test_push"}
    );

    res.status(200).json({
      ok: true,
      uid,
      tokens,
      result,
    });
  } catch (error) {
    console.error("[sendTestPush] error =", error);
    res.status(500).send(String(error));
  }
});

// 每分鐘檢查一次用藥提醒
exports.sendMedicationReminders = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeZone: "Asia/Taipei",
  },
  async () => {
    try {
      const hhmm = getTaipeiHHMM();
      const today = getTaipeiDateString();

      console.log("[medication] now =", hhmm, today);

      const snap = await db
        .collection("medication_reminders")
        .where("enabled", "==", true)
        .where("scheduleTime", "==", hhmm)
        .get();

      console.log("[medication] matched reminders =", snap.size);

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        // 同一天同一筆只送一次
        if (data.lastSentDate === today) {
          console.log("[medication] already sent today:", docSnap.id);
          continue;
        }

        const notifyUserIds = Array.isArray(data.notifyUserIds) ?
          data.notifyUserIds :
          [];

        const tokens = await getUserPushTokens(notifyUserIds);

        if (!tokens.length) {
          console.log("[medication] no tokens for reminder:", docSnap.id);
          continue;
        }

        const title = "用藥提醒";
        const body =
          `${data.medicineName || "藥物"} ${data.doseText || ""}，現在該服用了`;

        const result = await sendExpoPush(
          tokens,
          title,
          body,
          {
            type: "medication_reminder",
            reminderId: docSnap.id,
            patientId: data.patientId || "",
          }
        );

        console.log("[medication] sent:", docSnap.id, result);

        await docSnap.ref.update({
          lastSentDate: today,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("[sendMedicationReminders] error =", error);
    }
  }
);