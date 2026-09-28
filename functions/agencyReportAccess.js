const {HttpsError} = require("firebase-functions/https");
const {FieldValue} = require("firebase-admin/firestore");

async function getAgencyReportContext(request) {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError(
        "unauthenticated",
        "請先登入。",
    );
  }

  const patientId = String(
      request.data?.patientId || "",
  ).trim();

  if (!patientId) {
    throw new HttpsError(
        "invalid-argument",
        "缺少照護對象。",
    );
  }

  const patientSnap = await db
      .collection("patients")
      .doc(patientId)
      .get();

  if (!patientSnap.exists) {
    throw new HttpsError(
        "not-found",
        "找不到照護對象。",
    );
  }

  const patient = patientSnap.data() || {};

  const families = Array.isArray(patient.families) ?
    patient.families.map(String) :
    [];

  if (!families.includes(uid)) {
    throw new HttpsError(
        "permission-denied",
        "你目前沒有這位照護對象的回報權限。",
    );
  }

  const caregiverUids =
    Array.isArray(patient.caregivers) ?
      patient.caregivers.map(String) :
      [];

  const caregivers = [];

  for (const caregiverUid of caregiverUids) {
    const membershipSnap = await db
        .collection("agency_memberships")
        .doc(caregiverUid)
        .get();

    // 沒綁仲介的看護不出現在「回報給仲介」名單
    if (!membershipSnap.exists) {
      continue;
    }

    const membership =
      membershipSnap.data() || {};

    if (!membership.agencyUid) {
      continue;
    }

    const [
      profileSnap,
      userData,
    ] = await Promise.all([
      db.collection("caregiver_profiles")
          .doc(caregiverUid)
          .get(),

      getUserByUid(caregiverUid),
    ]);

    const profile =
      profileSnap.exists ?
        profileSnap.data() || {} :
        {};

    caregivers.push({
      caregiverUid,
      caregiverName: String(
          profile.displayName ||
          userData?.displayName ||
          "看護",
      ),
    });
  }

  return {
    patientId,
    patientName: String(
        patient.name || "照護對象",
    ),
    caregivers,
  };
}

function createAgencyReportService(db) {
  async function getUserByUid(uid) {
    const snap = await db
        .collection("users")
        .where("uid", "==", uid)
        .limit(1)
        .get();

    if (snap.empty) {
      return null;
    }

    return snap.docs[0].data() || {};
  }

  async function getAgencyReportContext(request) {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError(
          "unauthenticated",
          "請先登入。",
      );
    }

    const patientId = String(
        request.data?.patientId || "",
    ).trim();

    if (!patientId) {
      throw new HttpsError(
          "invalid-argument",
          "缺少照護對象。",
      );
    }

    const patientSnap = await db
        .collection("patients")
        .doc(patientId)
        .get();

    if (!patientSnap.exists) {
      throw new HttpsError(
          "not-found",
          "找不到照護對象。",
      );
    }

    const patient = patientSnap.data() || {};

    const families = Array.isArray(patient.families) ?
      patient.families.map(String) :
      [];

    if (!families.includes(uid)) {
      throw new HttpsError(
          "permission-denied",
          "你目前沒有這位照護對象的回報權限。",
      );
    }

    const caregiverUids =
      Array.isArray(patient.caregivers) ?
        patient.caregivers.map(String) :
        [];

    const caregivers = [];

    for (const caregiverUid of caregiverUids) {
      const membershipSnap = await db
          .collection("agency_memberships")
          .doc(caregiverUid)
          .get();

      if (!membershipSnap.exists) {
        continue;
      }

      const membership =
        membershipSnap.data() || {};

      if (!membership.agencyUid) {
        continue;
      }

      const [
        profileSnap,
        userData,
      ] = await Promise.all([
        db.collection("caregiver_profiles")
            .doc(caregiverUid)
            .get(),

        getUserByUid(caregiverUid),
      ]);

      const profile =
        profileSnap.exists ?
          profileSnap.data() || {} :
          {};

      caregivers.push({
        caregiverUid,
        caregiverName: String(
            profile.displayName ||
            userData?.displayName ||
            "看護",
        ),
      });
    }

    return {
      patientId,
      patientName: String(
          patient.name || "照護對象",
      ),
      caregivers,
    };
  }

  function makeAgencyReportId(patientId) {
    const now = new Date();

    const parts = new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        },
    ).formatToParts(now);

    const get = (type) =>
      parts.find((part) => part.type === type)?.value || "00";

    const date = [
      get("year"),
      get("month"),
      get("day"),
    ].join("-");

    const time = [
      get("hour"),
      get("minute"),
      get("second"),
    ].join("-");

    const patientSuffix = String(patientId)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-4) || "none";

    return `${date}_${time}_report_${patientSuffix}`;
  }

  async function createAgencyReport(request) {
    const reporterUid = request.auth?.uid;

    if (!reporterUid) {
      throw new HttpsError(
          "unauthenticated",
          "請先登入再送出回報。",
      );
    }

    const data = request.data || {};

    const patientId = String(
        data.patientId || "",
    ).trim();

    const caregiverUid = String(
        data.caregiverUid || "",
    ).trim();

    const category = String(
        data.category || "",
    ).trim();

    const title = String(
        data.title || "",
    ).trim();

    const description = String(
        data.description || "",
    ).trim();

    if (!patientId || !caregiverUid) {
      throw new HttpsError(
          "invalid-argument",
          "缺少照護對象或看護資料。",
      );
    }

    const allowedCategories = [
      "medication",
      "communication",
      "care",
      "other",
    ];

    if (!allowedCategories.includes(category)) {
      throw new HttpsError(
          "invalid-argument",
          "回報類型不正確。",
      );
    }

    if (!title || title.length > 200) {
      throw new HttpsError(
          "invalid-argument",
          "回報標題不可留白，且最多 200 字。",
      );
    }

    if (description.length > 3000) {
      throw new HttpsError(
          "invalid-argument",
          "問題說明最多 3000 字。",
      );
    }

    const [
      patientSnap,
      reporterData,
    ] = await Promise.all([
      db.collection("patients")
          .doc(patientId)
          .get(),

      getUserByUid(reporterUid),
    ]);

    if (!patientSnap.exists) {
      throw new HttpsError(
          "not-found",
          "找不到照護對象。",
      );
    }

    if (!reporterData) {
      throw new HttpsError(
          "failed-precondition",
          "找不到目前帳號資料。",
      );
    }

    const patient = patientSnap.data() || {};

    const families = Array.isArray(patient.families) ?
      patient.families.map(String) :
      [];

    const caregivers = Array.isArray(patient.caregivers) ?
      patient.caregivers.map(String) :
      [];

    const reporterRole = String(
        reporterData.role || "",
    );

    if (
      reporterRole !== "family" &&
      reporterRole !== "caregiver"
    ) {
      throw new HttpsError(
          "permission-denied",
          "目前帳號無法建立照護回報。",
      );
    }

    const isFamily =
      reporterRole === "family" &&
      families.includes(reporterUid);

    const isCaregiver =
      reporterRole === "caregiver" &&
      caregivers.includes(reporterUid);

    if (!isFamily && !isCaregiver) {
      throw new HttpsError(
          "permission-denied",
          "你目前沒有這位照護對象的回報權限。",
      );
    }

    if (!caregivers.includes(caregiverUid)) {
      throw new HttpsError(
          "failed-precondition",
          "指定的看護目前未綁定這位照護對象。",
      );
    }

    // 看護本人回報時，只能以自己作為對應看護
    if (
      reporterRole === "caregiver" &&
      caregiverUid !== reporterUid
    ) {
      throw new HttpsError(
          "permission-denied",
          "看護只能送出自己的照護回報。",
      );
    }

    const membershipSnap = await db
        .collection("agency_memberships")
        .doc(caregiverUid)
        .get();

    if (!membershipSnap.exists) {
      throw new HttpsError(
          "failed-precondition",
          "此看護目前尚未綁定仲介。",
      );
    }

    const membership =
      membershipSnap.data() || {};

    const agencyUid = String(
        membership.agencyUid || "",
    ).trim();

    if (!agencyUid) {
      throw new HttpsError(
          "failed-precondition",
          "找不到此看護所屬仲介。",
      );
    }

    const [
      caregiverProfileSnap,
      caregiverUserData,
    ] = await Promise.all([
      db.collection("caregiver_profiles")
          .doc(caregiverUid)
          .get(),

      getUserByUid(caregiverUid),
    ]);

    const caregiverProfile =
      caregiverProfileSnap.exists ?
        caregiverProfileSnap.data() || {} :
        {};

    const caregiverName = String(
        caregiverProfile.displayName ||
        caregiverUserData?.displayName ||
        "看護",
    ).trim();

    const reporterName = String(
        reporterData.displayName ||
        reporterData.email ||
        (reporterRole === "family" ? "家屬" : "看護"),
    ).trim();

    const patientName = String(
        patient.name || "照護對象",
    ).trim();

    const reportId =
      makeAgencyReportId(patientId);

    const reportRef = db
        .collection("agency_reports")
        .doc(reportId);

    await reportRef.set({
      agencyUid,

      caregiverUid,
      caregiverName,

      patientId,
      patientName,

      reporterUid,
      reporterRole,
      reporterName,

      category,
      title,
      description,

      // 手動要求仲介協助的回報，初始直接進待處理
      level: "pending",
      status: "open",

      handlingNote: "",

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      handledAt: null,
      handledBy: "",
    });

    return {
      reportId: reportRef.id,
      status: "open",
    };
  }

  return {
    getAgencyReportContext,
    createAgencyReport,
  };
}

module.exports = {
  createAgencyReportService,
};