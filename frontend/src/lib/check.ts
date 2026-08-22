import type { Board, Player, CapturedPieceType } from "@/types/shogi";
import { getMovableSquares, canDropPiece } from "@/lib/moves";

// ============================================================================
// 王手判定
// ============================================================================

// 指定したプレイヤーが王手されているか判定
export function isInCheck(
    board: Board,
    player: Player
): boolean {
    let kingPosition: { row: number; col: number } | null = null;

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = board[row][col];

            if (
                piece &&
                piece.type === "OU" &&
                piece.player === player
            ) {
                kingPosition = { row, col };
                break;
            }
        }

        if (kingPosition) break;
    }

    if (!kingPosition) {
        return false;
    }

    const opponent = player === "sente" ? "gote" : "sente";

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = board[row][col];

            if (!piece || piece.player !== opponent) {
                continue;
            }

            const movableSquares = getMovableSquares(
                board,
                row,
                col
            );

            const canAttackKing = movableSquares.some(
                (square) =>
                    square.row === kingPosition.row &&
                    square.col === kingPosition.col
            );

            if (canAttackKing) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// 合法手判定
// ============================================================================

// 指定した盤上の移動が合法か判定
export function isLegalMove(
    board: Board,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
): boolean {
    const movingPiece = board[fromRow][fromCol];

    if (!movingPiece) {
        return false;
    }

    const newBoard = board.map((row) => [...row]);

    newBoard[toRow][toCol] = movingPiece;
    newBoard[fromRow][fromCol] = null;

    return !isInCheck(newBoard, movingPiece.player);
}

// 盤上の駒だけで合法手が存在するか判定
function hasLegalBoardMove(
    board: Board,
    player: Player
): boolean {
    for (let fromRow = 0; fromRow < 9; fromRow++) {
        for (let fromCol = 0; fromCol < 9; fromCol++) {
            const piece = board[fromRow][fromCol];

            if (!piece || piece.player !== player) {
                continue;
            }

            const movableSquares = getMovableSquares(
                board,
                fromRow,
                fromCol
            );

            for (const square of movableSquares) {
                if (
                    isLegalMove(
                        board,
                        fromRow,
                        fromCol,
                        square.row,
                        square.col
                    )
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

// 持ち駒を打って合法手が存在するか判定
function hasLegalDrop(
    board: Board,
    player: Player,
    hands: {
        sente: Record<CapturedPieceType, number>;
        gote: Record<CapturedPieceType, number>;
    }
): boolean {
    const capturedPieceTypes: CapturedPieceType[] = [
        "FU",
        "KY",
        "KE",
        "GI",
        "KI",
        "KA",
        "HI",
    ];

    for (const type of capturedPieceTypes) {
        if (hands[player][type] <= 0) {
            continue;
        }

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (
                    !canDropPiece(
                        board,
                        type,
                        player,
                        row,
                        col
                    )
                ) {
                    continue;
                }

                const newBoard = board.map((row) => [...row]);

                newBoard[row][col] = {
                    id: -1,
                    type,
                    player,
                    promoted: false,
                };

                if (!isInCheck(newBoard, player)) {
                    return true;
                }
            }
        }
    }

    return false;
}


// ============================================================================
// 詰み判定
// ============================================================================

// 指定したプレイヤーが詰んでいるか判定
export function isCheckmate(
    board: Board,
    player: Player,
    hands: {
        sente: Record<CapturedPieceType, number>;
        gote: Record<CapturedPieceType, number>;
    }
): boolean {
    // そもそも王手されていなければ詰みではない
    if (!isInCheck(board, player)) {
        return false;
    }

    // 盤上の駒で王手を解除できるなら詰みではない
    if (hasLegalBoardMove(board, player)) {
        return false;
    }

    // 持ち駒を打って王手を解除できるなら詰みではない
    if (hasLegalDrop(board, player, hands)) {
        return false;
    }

    return true;
}









