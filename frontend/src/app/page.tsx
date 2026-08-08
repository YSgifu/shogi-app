import Board from "@/components/Board";
import { initialBoard } from "@/lib/initialBoard";

export default function Home() {
  return (
    <main>
      <h1>将棋アプリ</h1>
      <Board board={initialBoard} />
    </main>
  );
}