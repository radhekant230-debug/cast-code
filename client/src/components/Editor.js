import React, { useEffect, useRef } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions";

function Editor({ socket, socketRef, roomId, onCodeChange }) {
  const editorRef = useRef(null);

  // Initialize CodeMirror
  useEffect(() => {
    const textarea = document.getElementById("realtimeEditor");

    if (!textarea) return;

    const editor = CodeMirror.fromTextArea(textarea, {
      mode: { name: "javascript", json: true },
      theme: "dracula",
      autoCloseTags: true,
      autoCloseBrackets: true,
      lineNumbers: true,
    });

    editorRef.current = editor;

    editor.setSize(null, "100%");

    const handleEditorChange = (instance, changes) => {
      const { origin } = changes;
      const code = instance.getValue();

      // Save current code
      onCodeChange(code);

      // Send changes to other users
      if (origin !== "setValue" && socketRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    };

    editor.on("change", handleEditorChange);

    return () => {
      editor.off("change", handleEditorChange);

      if (editorRef.current) {
        editorRef.current.toTextArea();
        editorRef.current = null;
      }
    };
  }, [roomId, onCodeChange, socketRef]);

  // Receive code changes from other users
  useEffect(() => {
    if (!socket) return;

    const handleCodeChange = ({ code }) => {
      if (code !== null && editorRef.current) {
        const currentCode = editorRef.current.getValue();

        // Avoid unnecessary setValue
        if (currentCode !== code) {
          editorRef.current.setValue(code);
        }
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
    };
  }, [socket]);

  return (
    <div style={{ height: "600px" }}>
      <textarea id="realtimeEditor"></textarea>
    </div>
  );
}

export default Editor;
