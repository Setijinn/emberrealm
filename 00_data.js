// ============================================================
//  ROOM DEFINITIONS — this is our shared level editor.
//  W wall · . floor · c chaser · s shooter · B boss · P player spawn
//  Rooms live on a world grid; doors auto-generate between
//  adjacent rooms (gap carved in the shared wall).
// ============================================================
const ROOM_DEFS = {
 '0,0':{name:'Emberhearth', town:true, map:[
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "W......................................W",
  "W..hhhhhh....hhhhhh.....hhhhhh.........W",
  "W..hhhhhh....hhhhhh.....hhhhhh...hhhhh.W",
  "W..hhhhhh....hhhhhh.....hhhhhh...hhhhh.W",
  "W..hhhhhh...............hhhhhh...hhhhh.W",
  "W......................................W",
  "W......................................W",
  "W...........ffffffffffffffff...........W",
  "W...........flfffffffffffflf........l..W",
  "W...........fffffffHHfffffff...........W",
  "W...........fffffffHHfffffff...........W",
  "W...........ffffffffffffffff...........W",
  "W...........flfffffffffffflf........l..W",
  "W...........ffffffffffffffff...........W",
  "W...................P..................W",
  "W..hhhhhh................hhhhhh..hhhhh.W",
  "W..hhhhhh.....hhhhhh.....hhhhhh..hhhhh.W",
  "W..hhhhhh.....hhhhhh.....hhhhhh..hhhhh.W",
  "W..hhhhhh.....hhhhhh.....hhhhhh........W",
  "W......................................W",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]},
 // THE SIXTEEN LEGACY GRID ROOMS LIVED HERE ('1,0' through '16,0'), and they were orphaned.
 // Nothing in the game could reach them: they carried no portalDefs, no portal anywhere in the
 // codebase targets a grid key (every `to:` is '0,0', 'VAULT', 'PETS', 'GUILD', 'G' or 'ARENA'),
 // and dungeons are generated at runtime into the single reused key rooms['DUN'] by genDungeon().
 // Their only reference outside this file was a grid-checksum fixture in _selftest.
 //
 // They were built every session all the same -- 02_worldbuild walks every ROOM_DEFS key, packs a
 // grid, collects spawns and auto-carves doors between adjacent standard rooms -- so sixteen
 // 40x22 rooms of enemies were allocated and then never visited.
 //
 // And they declared levels 55, 65, 75, 85, 95, 105, 115, 125, 135 and 145, against a hard
 // LV_CAP of 50. Because the door-carving connects every adjacent standard room, anything that
 // ever placed the player in '1,0' opened a walkable chain all the way to Lv145 content. That is
 // the landmine, and runIntegrityCheck now asserts no ROOM_DEFS entry can declare one again.

   // The legacy 378x558 'G' lived here and was 214,742 bytes -- 91.6% of this file. The very
  // next <script> tag (00d_vgrove.js) replaces ROOM_DEFS['G'] wholesale and nothing reads it
  // in between, so every player downloaded, parsed and allocated it purely to discard it --
  // and re-downloaded it on every CACHE bump. Deleted. The live overworld is 00d_vgrove.js.
};
