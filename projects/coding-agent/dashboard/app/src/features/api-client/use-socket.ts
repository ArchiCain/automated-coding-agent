import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("/dashboard", {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Dashboard] WebSocket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Dashboard] WebSocket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Dashboard] WebSocket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef.current;
}
