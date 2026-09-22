/* eslint-disable require-jsdoc */
function primaryUid(data) {
  const uid = Object.prototype.hasOwnProperty.call(data, "primaryFamilyUid") ?
    data.primaryFamilyUid : data.createdBy;
  return typeof uid === "string" && uid.length > 0 &&
    Array.isArray(data.families) && data.families.includes(uid) &&
    Array.isArray(data.caregivers) && !data.caregivers.includes(uid) ? uid : null;
}
module.exports = {primaryUid};
