"use client";

import Board from "@/components/Board";
import { initialBoard } from "@/lib/initialBoard";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  function createRoom() {
      const roomId = Math.random().toString(36).substring(2, 8);

      router.push(`/room/${roomId}`);
  }

  return (
    <main>
      <button className="online-button" onClick={createRoom}>
          オンライン対戦
      </button>

      <Board board={initialBoard} />
    </main>
  );
}