// Deliberately dependency-free: this former debug route must never query users,
// reveal device tokens, or send a push. Real reminder/chat handlers are unchanged.
function retiredTestPush(_req, res) {
  res.set("Cache-Control", "no-store");
  res.status(410).json({error: "This diagnostic endpoint is disabled."});
}
module.exports = {retiredTestPush};
