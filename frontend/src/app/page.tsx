"use client";

import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    function createRoom() {
        const roomId = Math.random().toString(36).substring(2, 8);
        router.push(`/room/${roomId}`);
    }

    return (
        <main>
            <h1>将棋</h1>

            <button onClick={() => router.push("/solo")}>
                ひとりで遊ぶ
            </button>

            <button onClick={createRoom}>
                オンライン対戦
            </button>
        </main>
    );
}