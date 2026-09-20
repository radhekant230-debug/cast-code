import React, { useEffect, useRef } from "react";
import CodeMirror from "codemirror";

import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/xml/xml";
import "codemirror/mode/clike/clike";
import "codemirror/mode/python/python";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/closetag";

import { ACTIONS } from "../Actions";

function Editor({ socket, socketRef, roomId, onCodeChange }) {
  const editorRef = useRef(null);
  const textareaRef = useRef(null);

  /*
   * Initialize CodeMirror once on mount.
   */
  useEffect(() => {
    editorRef.current = CodeMirror.fromTextArea(textareaRef.current, {
      mode: { name: "javascript", json: true },
      theme: "dracula",
      autoCloseTags: true,
      autoCloseBrackets: true,
      lineNumbers: true,
    });

    editorRef.current.setSize(null, "100%");

    editorRef.current.on("change", (instance, changes) => {
      const { origin } = changes;
      const code = instance.getValue();

      onCodeChange(code);

      // Avoid re-broadcasting changes that came from setValue()
      // (i.e. changes applied by an incoming CODE_CHANGE event).
      if (origin !== "setValue" && socketRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    });

    return () => {
      editorRef.current.toTextArea();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Listen for remote code changes.
   */
  useEffect(() => {
    if (!socket) return;

    const handleCodeChange = ({ code }) => {
      if (code !== null && code !== editorRef.current.getValue()) {
        editorRef.current.setValue(code);
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
    };
  }, [socket]);

  return (
    <div className="codemirror h-100">
      <textarea ref={textareaRef} id="realtimeEditor"></textarea>
    </div>
  );
}

export default Editor;
