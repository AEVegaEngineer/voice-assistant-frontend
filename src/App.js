import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./App.css";

const socket = io("http://localhost:5000");

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    socket.on("question", (question) => {
      setCurrentQuestion(question);
      setConversation((prev) => [
        ...prev,
        { type: "question", content: question },
      ]);
      speakText(question);
    });

    socket.on("feedback", (feedback) => {
      setConversation((prev) => [
        ...prev,
        { type: "feedback", content: feedback },
      ]);
      speakText(feedback);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      socket.off("question");
      socket.off("feedback");
      socket.off("error");
    };
  }, []);

  const startConversation = () => {
    socket.emit("startConversation");
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          audioChunksRef.current = [];

          const formData = new FormData();
          formData.append("audio", audioBlob, "audio.wav");

          try {
            const response = await axios.post(
              "http://localhost:5000/upload-audio",
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
              }
            );

            const { transcription } = response.data;
            setConversation((prev) => [
              ...prev,
              { type: "answer", content: transcription },
            ]);
            socket.emit("submitAnswer", transcription);
          } catch (error) {
            console.error("Error uploading audio:", error);
          }
        };

        mediaRecorderRef.current.start();
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
    setIsRecording(!isRecording);
  };

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="App">
      <h1>Asistente de Voz</h1>
      <button onClick={startConversation}>Iniciar Conversación</button>
      <button onClick={toggleRecording}>
        {isRecording ? "Detener Grabación" : "Iniciar Grabación"}
      </button>
      <div className="conversation">
        {conversation.map((item, index) => (
          <div key={index} className={item.type}>
            <strong>
              {item.type === "question"
                ? "Pregunta: "
                : item.type === "answer"
                ? "Tu respuesta: "
                : "Feedback: "}
            </strong>
            {item.content}
          </div>
        ))}
      </div>
      {currentQuestion && (
        <div className="current-question">
          <strong>Pregunta actual: </strong>
          {currentQuestion}
        </div>
      )}
    </div>
  );
}

export default App;
