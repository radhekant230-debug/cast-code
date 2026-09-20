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
});

// ==================================================
// USER SOCKET MAP
// ==================================================

const userSocketMap = {};

// ==================================================
// GET ALL CLIENTS IN ROOM
// ==================================================

const getAllConnectedClients = (roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);

  if (!room) {
    return [];
  }

  return Array.from(room).map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
    };
  });
};

// ==================================================
// SOCKET CONNECTION
// ==================================================

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ==================================================
  // JOIN ROOM
  // ==================================================

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    try {
      userSocketMap[socket.id] = username;

      socket.join(roomId);

      const clients = getAllConnectedClients(roomId);

      console.log(
        `${username} joined room: ${roomId}`
      );

      clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
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

  socket.on(
    ACTIONS.CODE_CHANGE,
    ({ roomId, code }) => {
      try {
        console.log(
          `Code changed in room: ${roomId}`
        );

        socket
          .in(roomId)
          .emit(ACTIONS.CODE_CHANGE, {
            code,
          });
      } catch (error) {
        console.error(
          "CODE_CHANGE error:",
          error
        );
      }
    }
  );

  // ==================================================
  // SYNC CODE
  // ==================================================

  socket.on(
    ACTIONS.SYNC_CODE,
    ({ socketId, code }) => {
      try {
        console.log(
          `Syncing code to socket: ${socketId}`
        );

        io.to(socketId).emit(
          ACTIONS.CODE_CHANGE,
          {
            code,
          }
        );
      } catch (error) {
        console.error(
          "SYNC_CODE error:",
          error
        );
      }
    }
  );

  // ==================================================
  // DISCONNECTING
  // ==================================================

  socket.on("disconnecting", () => {
    try {
      const rooms = [...socket.rooms];

      rooms.forEach((roomId) => {
        socket
          .in(roomId)
          .emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username:
              userSocketMap[socket.id],
          });
      });

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
});

// ==================================================
// HEALTH CHECK
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
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Code is required",
      });
    }

    // Add your compiler API here later.

    return res.status(501).json({
      success: false,
      error:
        "Compiler API is not configured yet.",
      language,
    });
  } catch (error) {
    console.error(
      "Compile error:",
      error
    );

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
// START SERVER
// ==================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `CodeCast server running on port ${PORT}`
    );
    console.log(
      `Frontend allowed: ${FRONTEND_URL}`
    );
  }
);
