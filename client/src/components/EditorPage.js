import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

// List of supported languages
const LANGUAGES = [
  "python3",
  "java",
  "cpp",
  "nodejs",
  "c",
  "ruby",
  "go",
  "scala",
  "bash",
  "sql",
  "pascal",
  "csharp",
  "php",
  "swift",
  "rust",
  "r",
];

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompileWindowOpen, setIsCompileWindowOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("python3");

  const codeRef = useRef("");
  const socketRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  useEffect(() => {
    let socket;

    const handleErrors = (err) => {
      console.log("Socket error:", err);
      toast.error("Socket connection failed, Try again later");
      navigate("/");
    };

    const init = async () => {
      try {
        socket = await initSocket();
        socketRef.current = socket;

        socket.on("connect_error", handleErrors);
        socket.on("connect_failed", handleErrors);

        socket.emit(ACTIONS.JOIN, {
          roomId,
          username: location.state?.username,
        });

        socket.on(
          ACTIONS.JOINED,
          ({ clients, username, socketId }) => {
            if (username !== location.state?.username) {
              toast.success(`${username} joined the room.`);
            }

            setClients(clients);

            socket.emit(ACTIONS.SYNC_CODE, {
              code: codeRef.current,
              socketId,
            });
          }
        );

        socket.on(
          ACTIONS.DISCONNECTED,
          ({ socketId, username }) => {
            toast.success(`${username} left the room`);

            setClients((prev) =>
              prev.filter(
                (client) => client.socketId !== socketId
              )
            );
          }
        );
      } catch (error) {
        console.error("Socket initialization failed:", error);
        toast.error("Unable to connect to server");
        navigate("/");
      }
    };

    init();

    return () => {
      if (socket) {
        socket.off("connect_error", handleErrors);
        socket.off("connect_failed", handleErrors);
        socket.off(ACTIONS.JOINED);
        socket.off(ACTIONS.DISCONNECTED);
        socket.disconnect();
      }

      socketRef.current = null;
    };
  }, [roomId, location.state?.username, navigate]);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID is copied");
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the room ID");
    }
  };

  const leaveRoom = () => {
    navigate("/");
  };

  const runCode = async () => {
    setIsCompiling(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/compile`,
        {
          code: codeRef.current,
          language: selectedLanguage,
        }
      );

      console.log("Backend response:", response.data);

      setOutput(
        response.data.output ||
          JSON.stringify(response.data)
      );
    } catch (error) {
      console.error("Error compiling code:", error);

      setOutput(
        error.response?.data?.error ||
          "An error occurred"
      );
    } finally {
      setIsCompiling(false);
    }
  };

  const toggleCompileWindow = () => {
    setIsCompileWindowOpen((prev) => !prev);
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
        {/* Client panel */}
        <div className="col-md-2 bg-dark text-light d-flex flex-column">
          <img
            src="/images/codecast.png"
            alt="Logo"
            className="img-fluid mx-auto"
            style={{
              maxWidth: "150px",
              marginTop: "-43px",
            }}
          />

          <hr style={{ marginTop: "-3rem" }} />

          {/* Client list */}
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>

            {clients.map((client) => (
              <Client
                key={client.socketId}
                username={client.username}
              />
            ))}
          </div>

          <hr />

          {/* Buttons */}
          <div className="mt-auto mb-3">
            <button
              className="btn btn-success w-100 mb-2"
              onClick={copyRoomId}
            >
              Copy Room ID
            </button>

            <button
              className="btn btn-danger w-100"
              onClick={leaveRoom}
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="col-md-10 text-light d-flex flex-column">
          {/* Language selector */}
          <div className="bg-dark p-2 d-flex justify-content-end">
            <select
              className="form-select w-auto"
              value={selectedLanguage}
              onChange={(e) =>
                setSelectedLanguage(e.target.value)
              }
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
      </div>

      {/* Compiler toggle button */}
      <button
        className="btn btn-primary position-fixed bottom-0 end-0 m-3"
        onClick={toggleCompileWindow}
        style={{ zIndex: 1050 }}
      >
        {isCompileWindowOpen
          ? "Close Compiler"
          : "Open Compiler"}
      </button>

      {/* Compiler section */}
      <div
        className={`bg-dark text-light p-3 ${
          isCompileWindowOpen
            ? "d-block"
            : "d-none"
        }`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: isCompileWindowOpen
            ? "30vh"
            : "0",
          transition: "height 0.3s ease-in-out",
          overflowY: "auto",
          zIndex: 1040,
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0">
            Compiler Output ({selectedLanguage})
          </h5>

          <div>
            <button
              className="btn btn-success me-2"
              onClick={runCode}
              disabled={isCompiling}
            >
              {isCompiling
                ? "Compiling..."
                : "Run Code"}
            </button>

            <button
              className="btn btn-secondary"
              onClick={toggleCompileWindow}
            >
              Close
            </button>
          </div>
        </div>

        <pre className="bg-secondary p-3 rounded">
          {output ||
            "Output will appear here after compilation"}
        </pre>
      </div>
    </div>
  );
}

export default EditorPage;
