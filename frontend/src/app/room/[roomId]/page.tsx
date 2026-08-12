"use client";

import { useParams } from "next/navigation";
import OnlineBoard from "@/components/OnlineBoard";
import { initialBoard } from "@/lib/initialBoard";

export default function RoomPage() {
    const params =
        useParams<{ roomId: string }>();

    const roomId = params.roomId;

    return (
        <main>
            <h1>オンライン対戦</h1>

            <p>
                ルームID: {roomId}
            </p>

            <OnlineBoard
                board={initialBoard}
                roomId={roomId}
            />
        </main>
    );
}