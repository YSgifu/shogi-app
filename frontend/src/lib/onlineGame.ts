import type {
    Board,
    Hands,
    CapturedPieceType,
    Move
} from "@/types/shogi";

import { createPiece } from "@/lib/piece";

export const createEmptyHands = (): Hands => ({
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
});

export function cloneBoard(
    board: Board
): Board {
    return board.map((row) =>
        row.map((piece) =>
            piece
                ? { ...piece }
                : null
        )
    );
}

export function cloneHands(
    hands: Hands
): Hands {
    return {
        sente: {
            ...hands.sente,
        },

        gote: {
            ...hands.gote,
        },
    };
}
