import type { Board, PieceType, Hands } from "@/types/shogi";
import { createPiece } from "@/lib/piece";

const sente = (type: PieceType) =>
    createPiece(type, "sente");

const gote = (type: PieceType) =>
    createPiece(type, "gote");

export const initialBoard: Board = [
    [
        gote("KY"),
        gote("KE"),
        gote("GI"),
        gote("KI"),
        gote("OU"),
        gote("KI"),
        gote("GI"),
        gote("KE"),
        gote("KY"),
    ],
    [
        null,
        gote("HI"),
        null,
        null,
        null,
        null,
        null,
        gote("KA"),
        null,
    ],
    [
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
        gote("FU"),
    ],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
    [
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
        sente("FU"),
    ],
    [
        null,
        sente("KA"),
        null,
        null,
        null,
        null,
        null,
        sente("HI"),
        null,
    ],
    [
        sente("KY"),
        sente("KE"),
        sente("GI"),
        sente("KI"),
        sente("OU"),
        sente("KI"),
        sente("GI"),
        sente("KE"),
        sente("KY"),
    ],
];

export const initialHands: Hands = {
    sente: {
        FU: 0,
        KY: 0,
        KE: 0,
        GI: 0,
        KI: 0,
        KA: 0,
        HI: 0,
    },
    gote: {
        FU: 0,
        KY: 0,
        KE: 0,
        GI: 0,
        KI: 0,
        KA: 0,
        HI: 0,
    },
};