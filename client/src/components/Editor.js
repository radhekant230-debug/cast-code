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
  const textareaRef = useRef(null);

  // Initialize CodeMirror
  useEffect(() => {
    if (!textareaRef.current) return;

    const editor = CodeMirror.fromTextArea(textareaRef.current, {
      mode: {
        name: "javascript",
        json: true,
      },
      theme: "dracula",
      autoCloseTags: true,
      autoCloseBrackets: true,
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
    });

    editorRef.current = editor;

    editor.setSize("100%", "100%");

    const handleEditorChange = (instance, changes) => {
      const { origin } = changes;
      const code = instance.getValue();

      // Save current code locally
      onCodeChange(code);

      // Send code changes to other users
      // "setValue" means code came from another user,
      // so don't send it back again.
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
      if (typeof code !== "string") return;
      if (!editorRef.current) return;

      const currentCode = editorRef.current.getValue();

      // Avoid unnecessary updates
      if (currentCode !== code) {
        editorRef.current.setValue(code);
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
    };
  }, [socket]);

  return (
    <div
      style={{
        height: "600px",
        width: "100%",
      }}
    >
      <textarea
        ref={textareaRef}
        id="realtimeEditor"
        defaultValue=""
      />
    </div>
  );
}

export default Editor;
