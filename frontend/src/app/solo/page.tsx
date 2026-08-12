"use client";

import SoloBoard from "@/components/SoloBoard";
import { initialBoard } from "@/lib/initialBoard";

export default function SoloPage() {
    return (
        <main>
            <h1>ひとりで遊ぶ</h1>

            <SoloBoard board={initialBoard} />
        </main>
    );
}