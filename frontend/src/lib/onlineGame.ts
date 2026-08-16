import type {
    Board,
    Hands,
    CapturedPieceType,
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

/**
 * Moveを1手だけ適用する。
 *
 * ここではReactのstateを触らない。
 * 単純に
 *
 * Board + Hands + Move
 *        ↓
 * 新しいBoard + Hands
 *
 * を返す。
 */
export function applyMove(
    board: Board,
    hands: Hands,
    move: Move
): {
    board: Board;
    hands: Hands;
} {
    const newBoard =
        cloneBoard(board);

    const newHands =
        cloneHands(hands);

    // ========================================================
    // 持ち駒を打つ
    // ========================================================

    if (move.from === null) {
        const newPiece =
            createPiece(
                move.pieceType,
                move.player
            );

        newPiece.promoted =
            move.promoted;

        newBoard[
            move.to.row
        ][
            move.to.col
        ] = newPiece;

        const handType =
            move.pieceType as CapturedPieceType;

        if (
            newHands[move.player][handType] <= 0
        ) {
            return {
                board: newBoard,
                hands: newHands,
            };
        }

        newHands[move.player][handType] -= 1;

        return {
            board: newBoard,
            hands: newHands,
        };
    }

    // ========================================================
    // 盤上の駒を移動
    // ========================================================

    const movingPiece =
        newBoard[
            move.from.row
        ][
            move.from.col
        ];

    if (!movingPiece) {
        return {
            board: newBoard,
            hands: newHands,
        };
    }

    // ========================================================
    // 駒を取る
    // ========================================================

    const capturedType =
        move.capturedPieceType;

    if (
        capturedType &&
        capturedType !== "OU"
    ) {
        newHands[
            move.player
        ][
            capturedType as CapturedPieceType
        ] += 1;
    }

    // ========================================================
    // 成り
    // ========================================================

    movingPiece.promoted =
        move.promoted;

    // ========================================================
    // 移動
    // ========================================================

    newBoard[
        move.to.row
    ][
        move.to.col
    ] = movingPiece;

    newBoard[
        move.from.row
    ][
        move.from.col
    ] = null;

    return {
        board: newBoard,
        hands: newHands,
    };
}