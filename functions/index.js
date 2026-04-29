/* global Intl */
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
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

function getTaipeiDateBounds() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "01");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "01");
  const taipeiOffsetMs = 8 * 60 * 60 * 1000;

  return {
    todayStart: new Date(Date.UTC(year, month - 1, day) - taipeiOffsetMs),
    tomorrowStart: new Date(Date.UTC(year, month - 1, day + 1) - taipeiOffsetMs),
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
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

async function getUserDocByUid(uid) {
  const snap = await db
    .collection("users")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  if (snap.size > 1) {
    console.log("[push] duplicated user docs found for uid:", uid);
  }

  return snap.docs[0];
}

async function getUserPushTokens(userIds) {
  const tokens = [];

  for (const uid of userIds) {
    const userDoc = await getUserDocByUid(uid);

    if (!userDoc) {
      console.log("[push] user doc not found for uid:", uid);
      continue;
    }

    const deviceSnap = await userDoc.ref
      .collection("devices")
      .where("enabled", "==", true)
      .get();

    deviceSnap.forEach((deviceDoc) => {
      const data = deviceDoc.data();
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

async function writeNotifications({
  recipientUids,
  type,
  title,
  body,
  patientId = "",
  sourceCollection,
  sourceId,
  extra = {},
}) {
  const uniqueRecipientUids = [...new Set((recipientUids || []).map(String).filter(Boolean))];

  if (!uniqueRecipientUids.length) {
    return;
  }

  const writes = uniqueRecipientUids.map((recipientUid) =>
    db.collection("notifications").add({
      recipientUid,
      type,
      title,
      body,
      createdAt: FieldValue.serverTimestamp(),
      isRead: false,
      patientId: patientId || "",
      sourceCollection: sourceCollection || "",
      sourceId: sourceId || "",
      ...extra,
    })
  );

  await Promise.all(writes);
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

        try {
          await writeNotifications({
            recipientUids: notifyUserIds,
            type: "medication_reminder",
            title,
            body,
            patientId: data.patientId || "",
            sourceCollection: "medication_reminders",
            sourceId: docSnap.id,
            extra: {
              prescriptionId: data.prescriptionId || "",
              reminderId: docSnap.id,
            },
          });
        } catch (notificationError) {
          console.error("[medication] notification write failed:", notificationError);
        }

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

// health_records 新增時，自動判斷是否異常並發通知
exports.onHealthRecordCreated = onDocumentCreated(
  {
    document: "health_records/{recordId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const data = snap.data() || {};
      const recordId = event.params.recordId;

      const patientId = String(data.patientId || "");
      if (!patientId) {
        console.log("[health] missing patientId:", recordId);
        return;
      }

      const temperature = Number(data.temperature ?? 0);
      const heartRate = Number(data.heartRate ?? 0);
      const sys = Number(data.bloodPressureSys ?? 0);
      const dia = Number(data.bloodPressureDia ?? 0);
      const bloodSugar = Number(data.bloodSugar ?? 0);

      let abnormalTitle = "健康異常通知";
      let abnormalBody = "";

      if (temperature > 38) {
        abnormalBody = `體溫異常：${temperature}°C`;
      } else if (heartRate > 120) {
        abnormalBody = `心率過高：${heartRate} bpm`;
      } else if (sys > 140 || dia > 90) {
        abnormalBody = `血壓異常：${sys}/${dia} mmHg`;
      } else if (bloodSugar > 200) {
        abnormalBody = `血糖偏高：${bloodSugar} mg/dL`;
      }

      if (!abnormalBody) {
        console.log("[health] no abnormal condition:", recordId);
        return;
      }

      const patientSnap = await db.collection("patients").doc(patientId).get();
      if (!patientSnap.exists) {
        console.log("[health] patient not found:", patientId);
        return;
      }

      const patient = patientSnap.data() || {};
      const families = Array.isArray(patient.families) ? patient.families : [];
      const caregivers = Array.isArray(patient.caregivers) ? patient.caregivers : [];
      const notifyUserIds = [...new Set([...families, ...caregivers])];

      if (!notifyUserIds.length) {
        console.log("[health] no linked users:", patientId);
        return;
      }

      const tokens = await getUserPushTokens(notifyUserIds);

      if (!tokens.length) {
        console.log("[health] no push tokens:", patientId);
        return;
      }

      const result = await sendExpoPush(
        tokens,
        abnormalTitle,
        abnormalBody,
        {
          type: "abnormal_health",
          recordId,
          patientId,
        }
      );

      try {
        await writeNotifications({
          recipientUids: notifyUserIds,
          type: "abnormal_health",
          title: abnormalTitle,
          body: abnormalBody,
          patientId,
          sourceCollection: "health_records",
          sourceId: recordId,
          extra: {
            recordId,
          },
        });
      } catch (notificationError) {
        console.error("[health] notification write failed:", notificationError);
      }

      console.log("[health] abnormal push sent:", {
        recordId,
        patientId,
        abnormalBody,
        notifyUserIds,
        result,
      });
    } catch (error) {
      console.error("[onHealthRecordCreated] error =", error);
    }
  }
);

// 每日 20:00 檢查是否尚未填寫健康紀錄
exports.sendMissingHealthRecordReminder = onSchedule(
  {
    schedule: "0 20 * * *",
    region: "us-central1",
    timeZone: "Asia/Taipei",
  },
  async () => {
    try {
      const {todayStart, tomorrowStart, dateKey} = getTaipeiDateBounds();

      const patientsSnap = await db.collection("patients").get();
      console.log("[health_reminder] patients =", patientsSnap.size, "dateKey =", dateKey);

      for (const patientDoc of patientsSnap.docs) {
        const patientId = patientDoc.id;
        const patient = patientDoc.data() || {};

        const recordSnap = await db
          .collection("health_records")
          .where("patientId", "==", patientId)
          .where("createdAt", ">=", todayStart)
          .where("createdAt", "<", tomorrowStart)
          .get();

        if (!recordSnap.empty) {
          continue;
        }

        const families = Array.isArray(patient.families) ? patient.families : [];
        const caregivers = Array.isArray(patient.caregivers) ? patient.caregivers : [];
        const recipientUids = [...new Set([...families, ...caregivers].map(String).filter(Boolean))];

        if (!recipientUids.length) {
          console.log("[health_reminder] no recipients:", patientId);
          continue;
        }

        const title = "今日健康紀錄未填寫";
        const body = "今天尚未完成健康數據回報，請協助確認長輩狀況。";
        const tokens = await getUserPushTokens(recipientUids);

        if (tokens.length) {
          try {
            const result = await sendExpoPush(tokens, title, body, {
              type: "health_report_missing",
              patientId,
              dateKey,
            });

            console.log("[health_reminder] push sent:", {
              patientId,
              dateKey,
              recipientUids,
              result,
            });
          } catch (pushError) {
            console.error("[health_reminder] push failed:", pushError);
          }
        } else {
          console.log("[health_reminder] no push tokens:", patientId);
        }

        try {
          await writeNotifications({
            recipientUids,
            type: "health_report_missing",
            title,
            body,
            patientId,
            sourceCollection: "health_records",
            sourceId: `${patientId}-${dateKey}`,
            extra: {
              dateKey,
            },
          });
        } catch (notificationError) {
          console.error("[health_reminder] notification write failed:", notificationError);
        }
      }
    } catch (error) {
      console.error("[sendMissingHealthRecordReminder] error =", error);
    }
  }
);

// medication_logs 新增時，同步通知對應家屬
exports.onMedicationLogCreated = onDocumentCreated(
  {
    document: "medication_logs/{logId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const data = snap.data() || {};
      const logId = event.params.logId;
      const patientId = String(data.patientId || "");

      if (!patientId) {
        console.log("[medication_done] missing patientId:", logId);
        return;
      }

      const patientSnap = await db.collection("patients").doc(patientId).get();
      if (!patientSnap.exists) {
        console.log("[medication_done] patient not found:", patientId);
        return;
      }

      const patient = patientSnap.data() || {};
      const families = Array.isArray(patient.families) ? patient.families : [];

      if (!families.length) {
        console.log("[medication_done] no family recipients:", patientId);
        return;
      }

      await writeNotifications({
        recipientUids: families,
        type: "medication_done",
        title: "已完成用藥",
        body: "看護已完成用藥紀錄",
        patientId,
        sourceCollection: "medication_logs",
        sourceId: logId,
        extra: {
          reminderId: String(data.reminderId || ""),
          prescriptionId: String(data.prescriptionId || ""),
        },
      });
    } catch (error) {
      console.error("[onMedicationLogCreated] error =", error);
    }
  }
);

// chats 新增訊息時，同步通知對應家屬與看護
exports.onChatMessageCreated = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const data = snap.data() || {};
      const chatId = String(event.params.chatId || "");
      const messageId = String(event.params.messageId || "");
      const senderId = String(data.senderId || "");

      if (!chatId || !messageId) {
        console.log("[chat_message] missing chatId/messageId:", {
          chatId,
          messageId,
        });
        return;
      }

      const patientSnap = await db.collection("patients").doc(chatId).get();
      if (!patientSnap.exists) {
        console.log("[chat_message] patient not found:", chatId);
        return;
      }

      const patient = patientSnap.data() || {};
      const families = Array.isArray(patient.families) ? patient.families : [];
      const caregivers = Array.isArray(patient.caregivers) ? patient.caregivers : [];
      const recipientUids = [...new Set([...families, ...caregivers].map(String).filter(Boolean))].filter(
        (uid) => uid !== senderId
      );

      if (!recipientUids.length) {
        console.log("[chat_message] no recipients after excluding sender:", {
          chatId,
          senderId,
        });
        return;
      }

      const title = "新訊息";
      const body = String(data.text || "").trim() || "傳送了一張圖片";
      const tokens = await getUserPushTokens(recipientUids);

      if (tokens.length) {
        const result = await sendExpoPush(tokens, title, body, {
          type: "chat_message",
          chatId,
          messageId,
          senderId,
        });

        console.log("[chat_message] push sent:", {
          chatId,
          messageId,
          senderId,
          recipientUids,
          result,
        });
      } else {
        console.log("[chat_message] no push tokens:", {
          chatId,
          messageId,
          recipientUids,
        });
      }

      await writeNotifications({
        recipientUids,
        type: "chat_message",
        title,
        body,
        patientId: chatId,
        sourceCollection: "chats",
        sourceId: messageId,
        extra: {
          chatId,
        },
      });
    } catch (error) {
      console.error("[onChatMessageCreated] error =", error);
    }
  }
);
