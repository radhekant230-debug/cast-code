import { io } from "socket.io-client";

export const initSocket = async () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Check backend URL
  if (!backendUrl) {
    throw new Error(
      "REACT_APP_BACKEND_URL is not configured."
    );
  }

  const socket = io(backendUrl, {
    transports: ["websocket", "polling"],

    // Reconnection
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    // Connection timeout
    timeout: 10000,

    // Send credentials if required
    withCredentials: true,
  });

  return socket;
};
