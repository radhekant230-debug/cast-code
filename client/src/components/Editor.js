const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const dotenv = require("dotenv");

const ACTIONS = require("./Actions");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:3000";

console.log("=================================");
console.log("CodeCast Backend Starting...");
console.log("Frontend URL:", FRONTEND_URL);
console.log("Port:", PORT);
console.log("=================================");

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

// ==================================================
// SOCKET.IO
// ==================================================

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: ["websocket", "polling"],

  // Reconnection settings
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ==================================================
// USER SOCKET MAP
// ==================================================

const userSocketMap = {};

// ==================================================
// GET ALL CONNECTED CLIENTS IN ROOM
// ==================================================

const getAllConnectedClients = (roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);

  if (!room) {
    return [];
  }

  return Array.from(room).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId] || "Unknown User",
  }));
};

// ==================================================
// SOCKET CONNECTION
// ==================================================

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ==================================================
  // JOIN ROOM
  // ==================================================

  socket.on(ACTIONS.JOIN, (data) => {
    try {
      const { roomId, username } = data || {};

      // Validate JOIN data
      if (
        typeof roomId !== "string" ||
        !roomId.trim() ||
        typeof username !== "string" ||
        !username.trim()
      ) {
        console.error("Invalid JOIN request:", data);
        return;
      }

      const cleanRoomId = roomId.trim();
      const cleanUsername = username.trim();

      // Save user
      userSocketMap[socket.id] = cleanUsername;

      // Join room
      socket.join(cleanRoomId);

      // Get current clients
      const clients = getAllConnectedClients(cleanRoomId);

      console.log(
        `${cleanUsername} joined room: ${cleanRoomId}`
      );

      // Notify all users in room
      clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username: cleanUsername,
          socketId: socket.id,
        });
      });
    } catch (error) {
      console.error("JOIN error:", error);
    }
  });

  // ==================================================
  // CODE CHANGE
  // ==================================================

  socket.on(ACTIONS.CODE_CHANGE, (data) => {
    try {
      const { roomId, code } = data || {};

      // Validate code change
      if (
        typeof roomId !== "string" ||
        !roomId.trim() ||
        typeof code !== "string"
      ) {
        console.error("Invalid CODE_CHANGE request:", data);
        return;
      }

      const cleanRoomId = roomId.trim();

      console.log(
        `Code changed in room: ${cleanRoomId}`
      );

      // Send code to everyone except sender
      socket.in(cleanRoomId).emit(ACTIONS.CODE_CHANGE, {
        code,
      });
    } catch (error) {
      console.error("CODE_CHANGE error:", error);
    }
  });

  // ==================================================
  // SYNC CODE
  // ==================================================

  socket.on(ACTIONS.SYNC_CODE, (data) => {
    try {
      const { socketId, code } = data || {};

      // Validate sync request
      if (
        typeof socketId !== "string" ||
        !socketId.trim() ||
        typeof code !== "string"
      ) {
        console.error("Invalid SYNC_CODE request:", data);
        return;
      }

      console.log(
        `Syncing code to socket: ${socketId}`
      );

      // Send current code to newly joined user
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, {
        code,
      });
    } catch (error) {
      console.error("SYNC_CODE error:", error);
    }
  });

  // ==================================================
  // LEAVE ROOM
  // ==================================================

  socket.on(ACTIONS.LEAVE, (data) => {
    try {
      const { roomId } = data || {};

      if (
        typeof roomId !== "string" ||
        !roomId.trim()
      ) {
        return;
      }

      const cleanRoomId = roomId.trim();
      const username = userSocketMap[socket.id];

      // Notify other users
      socket.in(cleanRoomId).emit(
        ACTIONS.DISCONNECTED,
        {
          socketId: socket.id,
          username,
        }
      );

      // Leave room
      socket.leave(cleanRoomId);

      console.log(
        `${username || "User"} left room: ${cleanRoomId}`
      );
    } catch (error) {
      console.error("LEAVE error:", error);
    }
  });

  // ==================================================
  // DISCONNECTING
  // ==================================================

  socket.on("disconnecting", () => {
    try {
      const rooms = [...socket.rooms];
      const username = userSocketMap[socket.id];

      rooms.forEach((roomId) => {
        // Socket.IO automatically puts every socket
        // into a private room with its own socket.id.
        // We don't want to treat that as a CodeCast room.
        if (roomId === socket.id) {
          return;
        }

        socket.in(roomId).emit(
          ACTIONS.DISCONNECTED,
          {
            socketId: socket.id,
            username,
          }
        );

        console.log(
          `${username || "User"} disconnected from room: ${roomId}`
        );
      });

      // Remove user from map
      delete userSocketMap[socket.id];

      console.log(
        "Socket disconnected:",
        socket.id
      );
    } catch (error) {
      console.error(
        "DISCONNECT error:",
        error
      );
    }
  });

  // ==================================================
  // SOCKET ERROR
  // ==================================================

  socket.on("error", (error) => {
    console.error(
      `Socket error (${socket.id}):`,
      error
    );
  });
});

// ==================================================
// BASIC HEALTH CHECK
// ==================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CodeCast server is running",
  });
});

// ==================================================
// SOCKET.IO HEALTH CHECK
// ==================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server and Socket.IO are running",
    connectedUsers: io.engine.clientsCount,
  });
});

// ==================================================
// COMPILE ENDPOINT
// ==================================================

app.post("/compile", async (req, res) => {
  try {
    const { code, language } = req.body || {};

    if (
      typeof code !== "string" ||
      !code.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Code is required",
      });
    }

    if (
      typeof language !== "string" ||
      !language.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Language is required",
      });
    }

    // ==================================================
    // COMPILER API
    // ==================================================
    // Add Judge0 / another compiler API here later.

    return res.status(501).json({
      success: false,
      error: "Compiler API is not configured yet.",
      language,
    });
  } catch (error) {
    console.error("Compile error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ==================================================
// 404 HANDLER
// ==================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ==================================================
// START SERVER
// ==================================================

server.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(
    `CodeCast server running on port ${PORT}`
  );
  console.log(
    `Frontend allowed: ${FRONTEND_URL}`
  );
  console.log("=================================");
});
