"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const roomId = params.roomId;

    const wsRef = useRef<WebSocket | null>(null);
    const [player, setPlayer] = useState<"sente" | "gote" | null>(null);

    useEffect(() => {
        console.log("WebSocket connecting...");

        const ws = new WebSocket(
            `ws://localhost:8787/api/rooms/${roomId}/ws`
        );

        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
        };

        ws.onmessage = (event) => {
            console.log("message from server:", event.data);

            const message = JSON.parse(event.data);

            if (message.type === "player-assigned") {
                setPlayer(message.player);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
        };

        ws.onerror = (error) => {
            console.error("WebSocket error", error);
        };

        return () => {
            console.log("WebSocket cleanup");
            ws.close();
        };
    }, [roomId]);

    function sendMessage() {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send("Hello!");
        }
    }

    return (
        <main>
            <h1>オンライン対戦</h1>

            <p>ルームID: {roomId}</p>

            {player && (
                <p>
                    あなたは{player === "sente" ? "先手" : "後手"}です
                </p>
            )}

            <button onClick={sendMessage}>
                メッセージ送信
            </button>
        </main>
    );
}