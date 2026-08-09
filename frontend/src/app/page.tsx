import Board from "@/components/Board";
import { initialBoard } from "@/lib/initialBoard";

export default function Home() {
  return (
    <main>
      <Board board={initialBoard} />
    </main>
  );
}