import type { Move_before } from "@/types/shogi";
import { pieceNames } from "@/lib/piece";

const files = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];

const ranks = [
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
];

export const formatSquare = (row: number, col: number) => {
    return `${files[col]}${ranks[row]}`;
};

export const formatMove = (move: Move_before) => {
    const playerMark = move.player === "sente" ? "▲" : "△";
    const square = formatSquare(move.to.row, move.to.col);
    const pieceName = pieceNames[move.pieceType];
    const dropMark = move.from === null ? "打" : "";

    return `${playerMark}${square}${pieceName}${move.promoted ? "成" : ""}${dropMark}`;
};