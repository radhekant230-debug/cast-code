const express = require("express");
const app = express();

const http = require("http");
const { Server } = require("socket.io");

const cors = require("cors");
const axios = require("axios");

const ACTIONS = require("./Actions");

require("dotenv").config();

const server = http.createServer(app);

// =========================
// Middleware
// =========================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3000",
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

// =========================
// Socket.IO
// =========================

const io = new Server(server, {
  cors: {
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// =========================
// User Socket Map
// =========================

const userSocketMap = {};

// =========================
// Get Connected Clients
// =========================

const getAllConnectedClients = (
  roomId
) => {
  return Array.from(
    io.sockets.adapter.rooms.get(roomId) || []
  ).map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
    };
  });
};

// =========================
// Socket Connection
// =========================

io.on("connection", (socket) => {
  console.log(
    "Socket connected:",
    socket.id
  );

  // =========================
  // JOIN ROOM
  // =========================

  socket.on(
    ACTIONS.JOIN,
    ({ roomId, username }) => {
      userSocketMap[socket.id] =
        username;

      socket.join(roomId);

      const clients =
        getAllConnectedClients(roomId);

      console.log(
        `${username} joined room: ${roomId}`
      );

      clients.forEach(
        ({ socketId }) => {
          io.to(socketId).emit(
            ACTIONS.JOINED,
            {
              clients,
              username,
              socketId: socket.id,
            }
          );
        }
      );
    }
  );

  // =========================
  // CODE CHANGE
  // =========================

  socket.on(
    ACTIONS.CODE_CHANGE,
    ({ roomId, code }) => {
      console.log(
        `Code changed in room: ${roomId}`
      );

      socket
        .in(roomId)
        .emit(
          ACTIONS.CODE_CHANGE,
          { code }
        );
    }
  );

  // =========================
  // SYNC CODE
  // =========================

  socket.on(
    ACTIONS.SYNC_CODE,
    ({ socketId, code }) => {
      console.log(
        `Syncing code to socket: ${socketId}`
      );

      io.to(socketId).emit(
        ACTIONS.CODE_CHANGE,
        { code }
      );
    }
  );

  // =========================
  // DISCONNECT
  // =========================

  socket.on("disconnecting", () => {
    const rooms = [
      ...socket.rooms,
    ];

    rooms.forEach((roomId) => {
      socket
        .in(roomId)
        .emit(
          ACTIONS.DISCONNECTED,
          {
            socketId: socket.id,
            username:
              userSocketMap[
                socket.id
              ],
          }
        );
    });

    delete userSocketMap[
      socket.id
    ];

    console.log(
      "Socket disconnected:",
      socket.id
    );
  });
});

// =========================
// Health Check
// =========================

app.get("/", (req, res) => {
  res.json({
    message:
      "CodeCast server is running",
  });
});

// =========================
// Compile Endpoint
// =========================

app.post("/compile", async (req, res) => {
  const { code, language } =
    req.body;

  if (!code) {
    return res.status(400).json({
      error: "Code is required",
    });
  }

  /*
   * IMPORTANT:
   * Add your actual compiler API here.
   *
   * Do NOT call:
   * /compile -> /compile
   * because that creates recursion.
   */

  return res.status(501).json({
    error:
      "Compiler API is not configured yet.",
    language,
  });
});

// =========================
// Start Server
// =========================

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server is running on port ${PORT}`
    );
  }
);
