require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });
const db = require("./lib/db");
const { updateRoom } = require("./controllers/room.controller");

async function run() {
  try {
    // 1. Get room ID 4 and user from database
    const rooms = await db.query("SELECT * FROM `room` WHERE id = 4");
    if (!rooms.length) {
      console.log("Room ID 4 does not exist in database.");
      return;
    }
    const testRoom = rooms[0];
    console.log("Found room to test:", testRoom);

    const users = await db.query("SELECT id, role FROM `user` WHERE id = ? LIMIT 1", [testRoom.ownerId]);
    if (!users.length) {
      console.log("No matching user found for room owner:", testRoom.ownerId);
      return;
    }
    const testUser = users[0];
    console.log("Found user to test:", testUser);

    // 2. Mock req and res
    const req = {
      params: { id: testRoom.id },
      user: { userId: testUser.id, role: testUser.role },
      body: {
        roomType: testRoom.roomType,
        capacityAdults: testRoom.capacityAdults,
        capacityChildren: testRoom.capacityChildren,
        price: testRoom.price,
        hasAc: testRoom.hasAc
      }
    };

    const res = {
      status(code) {
        console.log("Response Status Called:", code);
        return this;
      },
      json(data) {
        console.log("Response JSON Called:", data);
        return this;
      }
    };

    // 3. Call updateRoom
    console.log("Calling updateRoom...");
    await updateRoom(req, res);

  } catch (error) {
    console.error("Direct test error:", error);
  } finally {
    process.exit(0);
  }
}

run();
