/* eslint-disable require-jsdoc */
function primaryUid(data) {
  const uid = Object.prototype.hasOwnProperty.call(data, "primaryFamilyUid") ?
    data.primaryFamilyUid : data.createdBy;
  return typeof uid === "string" && uid.length > 0 &&
    Array.isArray(data.families) && data.families.includes(uid) &&
    Array.isArray(data.caregivers) && !data.caregivers.includes(uid) ? uid : null;
}

function secondaryFamilyUids(data) {
  const primary = primaryUid(data);
  if (!primary || !Array.isArray(data.families)) return [];
  const caregivers = new Set(Array.isArray(data.caregivers) ?
    data.caregivers : []);
  return [...new Set(data.families)].filter((uid) =>
    typeof uid === "string" && uid.length > 0 && uid.length <= 128 &&
    uid !== primary && !caregivers.has(uid));
}

function canTransferPrimary(data, actorUid, targetUid) {
  return primaryUid(data) === actorUid &&
    secondaryFamilyUids(data).includes(targetUid);
}

module.exports = {primaryUid, secondaryFamilyUids, canTransferPrimary};
