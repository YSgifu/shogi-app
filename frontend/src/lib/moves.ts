import type { Board, Hands, Player, CapturedPieceType, Move, Piece } from "@/types/shogi";
import { createPiece } from "@/lib/piece";

export type Square = {
    row: number;
    col: number;
    };

export function getMovableSquares(
    board: Board,
    row: number,
    col: number
): Square[] {
    const piece = board[row][col];

    if (!piece) {
        return [];
    }

    // 成り駒
    if (piece.promoted) {
        // と金・成香・成桂・成銀 → 金と同じ動き
        if (
            piece.type === "FU" ||
            piece.type === "KY" ||
            piece.type === "KE" ||
            piece.type === "GI"
        ) {
            return getGoldMovableSquares(
                board,
                row,
                col,
                piece.player
            );
        }

        // 馬 → 角 + 上下左右1マス
        if (piece.type === "KA") {
            const movableSquares = getBishopMovableSquares(
                board,
                row,
                col,
                piece.player
            );

            const candidates = [
                { row: row - 1, col },
                { row: row + 1, col },
                { row, col: col - 1 },
                { row, col: col + 1 },
            ];

            for (const candidate of candidates) {
                if (
                    candidate.row < 0 ||
                    candidate.row >= 9 ||
                    candidate.col < 0 ||
                    candidate.col >= 9
                ) {
                    continue;
                }

                const targetPiece =
                    board[candidate.row][candidate.col];

                if (
                    !targetPiece ||
                    targetPiece.player !== piece.player
                ) {
                    movableSquares.push(candidate);
                }
            }

            return movableSquares;
        }

        // 龍 → 飛車 + 斜め1マス
        if (piece.type === "HI") {
            const movableSquares = getRookMovableSquares(
                board,
                row,
                col,
                piece.player
            );

            const candidates = [
                { row: row - 1, col: col - 1 },
                { row: row - 1, col: col + 1 },
                { row: row + 1, col: col - 1 },
                { row: row + 1, col: col + 1 },
            ];

            for (const candidate of candidates) {
                if (
                    candidate.row < 0 ||
                    candidate.row >= 9 ||
                    candidate.col < 0 ||
                    candidate.col >= 9
                ) {
                    continue;
                }

                const targetPiece =
                    board[candidate.row][candidate.col];

                if (
                    !targetPiece ||
                    targetPiece.player !== piece.player
                ) {
                    movableSquares.push(candidate);
                }
            }

            return movableSquares;
        }
    }

    // 歩
    if (piece.type === "FU") {
        const direction = piece.player === "sente" ? -1 : 1;
        const nextRow = row + direction;

        if (nextRow < 0 || nextRow >= 9) {
            return [];
        }

        const targetPiece = board[nextRow][col];

        if (targetPiece && targetPiece.player === piece.player) {
            return [];
        }

        return [
            {
                row: nextRow,
                col,
            },
        ];
    }

    // 香車
    if (piece.type === "KY") {
        const direction = piece.player === "sente" ? -1 : 1;
        const movableSquares: Square[] = [];

        let nextRow = row + direction;

        while (nextRow >= 0 && nextRow < 9) {
            const targetPiece = board[nextRow][col];

            if (!targetPiece) {
                movableSquares.push({
                    row: nextRow,
                    col,
                });
            } else {
                // 相手の駒なら、そのマスまで
                if (targetPiece.player !== piece.player) {
                    movableSquares.push({
                        row: nextRow,
                        col,
                    });
                }

                // 駒があったら、その先には進めない
                break;
            }

            nextRow += direction;
        }

        return movableSquares;
    }

    // 桂馬
    if (piece.type === "KE") {
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction * 2, col: col - 1 },
            { row: row + direction * 2, col: col + 1 },
        ];

        return candidates.filter(({ row, col }) => {
            // 盤外なら移動できない
            if (row < 0 || row >= 9 || col < 0 || col >= 9) {
                return false;
            }

            const targetPiece = board[row][col];

            // 自分の駒があるマスには移動できない
            if (targetPiece && targetPiece.player === piece.player) {
                return false;
            }

            return true;
        });
    }

    // 銀
    if (piece.type === "GI") {
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction, col: col - 1 },
            { row: row + direction, col },
            { row: row + direction, col: col + 1 },
            { row: row - direction, col: col - 1 },
            { row: row - direction, col: col + 1 },
        ];

        return candidates.filter(({ row, col }) => {
            // 盤外なら移動できない
            if (row < 0 || row >= 9 || col < 0 || col >= 9) {
                return false;
            }

            const targetPiece = board[row][col];

            // 自分の駒があるマスには移動できない
            if (targetPiece && targetPiece.player === piece.player) {
                return false;
            }

            return true;
        });
    }

    // 金
    if (piece.type === "KI") {
        return getGoldMovableSquares(
            board,
            row,
            col,
            piece.player
        );
    }

    // 角
    if (piece.type === "KA") {
        return getBishopMovableSquares(
            board,
            row,
            col,
            piece.player
        );
    }

    // 飛車
    if (piece.type === "HI") {
        return getRookMovableSquares(
            board,
            row,
            col,
            piece.player
        );
    }

    // 王
    if (piece.type === "OU") {
        const directions = [
            { row: -1, col: -1 },
            { row: -1, col: 0 },
            { row: -1, col: 1 },
            { row: 0, col: -1 },
            { row: 0, col: 1 },
            { row: 1, col: -1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 },
        ];

        return directions
            .map((direction) => ({
                row: row + direction.row,
                col: col + direction.col,
            }))
            .filter(({ row, col }) => {
                // 盤外なら移動できない
                if (row < 0 || row >= 9 || col < 0 || col >= 9) {
                    return false;
                }

                const targetPiece = board[row][col];

                // 自分の駒があるマスには移動できない
                if (targetPiece && targetPiece.player === piece.player) {
                    return false;
                }

                return true;
            });
    }

    return [];
}

export function canPromote(
    piece: Piece,
    fromRow: number,
    toRow: number
): boolean {
    // 金・王は成れない
    if (piece.type === "KI" || piece.type === "OU") {
        return false;
    }

    // すでに成っている駒は対象外
    if (piece.promoted) {
        return false;
    }

    // 先手は上方向、後手は下方向が相手陣
    const fromInPromotionZone =
        piece.player === "sente"
            ? fromRow <= 2
            : fromRow >= 6;

    const toInPromotionZone =
        piece.player === "sente"
            ? toRow <= 2
            : toRow >= 6;

    return fromInPromotionZone || toInPromotionZone;
}

export function canDropPiece(
    board: Board,
    type: CapturedPieceType,
    player: Player,
    row: number,
    col: number
): boolean {
    // 駒があるマスには打てない
    if (board[row][col]) {
        return false;
    }

    const lastRow = player === "sente" ? 0 : 8;

    if (
            (type === "FU" || type === "KY") &&
            row === lastRow
        ) {
            return false;
        }

        const lastTwoRows =
        player === "sente"
            ? row <= 1
            : row >= 7;

    if (type === "KE" && lastTwoRows) {
        return false;
    }

    if (type === "FU") {
        for (let r = 0; r < 9; r++) {
            const piece = board[r][col];

            if (
                piece &&
                piece.player === player &&
                piece.type === "FU" &&
                !piece.promoted
            ) {
                return false;
            }
        }
    }

    return true;
}

function getGoldMovableSquares(
    board: Board,
    row: number,
    col: number,
    player: Player
): Square[] {
    const direction = player === "sente" ? -1 : 1;

    const candidates = [
        { row: row + direction, col: col - 1 },
        { row: row + direction, col },
        { row: row + direction, col: col + 1 },
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row - direction, col },
    ];

    return candidates.filter(({ row, col }) => {
        if (row < 0 || row >= 9 || col < 0 || col >= 9) {
            return false;
        }

        const targetPiece = board[row][col];

        if (targetPiece && targetPiece.player === player) {
            return false;
        }

        return true;
    });
}

function getBishopMovableSquares(
    board: Board,
    row: number,
    col: number,
    player: Player
): Square[] {
    const directions = [
        { row: -1, col: -1 },
        { row: -1, col: 1 },
        { row: 1, col: -1 },
        { row: 1, col: 1 },
    ];

    const movableSquares: Square[] = [];

    for (const direction of directions) {
        let nextRow = row + direction.row;
        let nextCol = col + direction.col;

        while (
            nextRow >= 0 &&
            nextRow < 9 &&
            nextCol >= 0 &&
            nextCol < 9
        ) {
            const targetPiece = board[nextRow][nextCol];

            if (!targetPiece) {
                movableSquares.push({
                    row: nextRow,
                    col: nextCol,
                });
            } else {
                if (targetPiece.player !== player) {
                    movableSquares.push({
                        row: nextRow,
                        col: nextCol,
                    });
                }

                break;
            }

            nextRow += direction.row;
            nextCol += direction.col;
        }
    }

    return movableSquares;
}

function getRookMovableSquares(
    board: Board,
    row: number,
    col: number,
    player: Player
): Square[] {
    const directions = [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
    ];

    const movableSquares: Square[] = [];

    for (const direction of directions) {
        let nextRow = row + direction.row;
        let nextCol = col + direction.col;

        while (
            nextRow >= 0 &&
            nextRow < 9 &&
            nextCol >= 0 &&
            nextCol < 9
        ) {
            const targetPiece = board[nextRow][nextCol];

            if (!targetPiece) {
                movableSquares.push({
                    row: nextRow,
                    col: nextCol,
                });
            } else {
                if (targetPiece.player !== player) {
                    movableSquares.push({
                        row: nextRow,
                        col: nextCol,
                    });
                }

                break;
            }

            nextRow += direction.row;
            nextCol += direction.col;
        }
    }

    return movableSquares;
}

function getSlidingAttackSquares(
    board: Board,
    row: number,
    col: number,
    directions: Square[]
): Square[] {
    const attackSquares: Square[] = [];

    for (const direction of directions) {
        let nextRow = row + direction.row;
        let nextCol = col + direction.col;

        while (
            nextRow >= 0 &&
            nextRow < 9 &&
            nextCol >= 0 &&
            nextCol < 9
        ) {
            attackSquares.push({
                row: nextRow,
                col: nextCol,
            });

            // 駒にぶつかったら、そのマスまでで終了
            if (board[nextRow][nextCol]) {
                break;
            }

            nextRow += direction.row;
            nextCol += direction.col;
        }
    }

    return attackSquares;
}

export function getAttackSquares(
    board: Board,
    row: number,
    col: number
): Square[] {
    const piece = board[row][col];

    if (!piece) {
        return [];
    }

    if (piece.type === "HI" && !piece.promoted) {
        return getSlidingAttackSquares(
            board,
            row,
            col,
            [
                { row: -1, col: 0 },
                { row: 1, col: 0 },
                { row: 0, col: -1 },
                { row: 0, col: 1 },
            ]
        );
    }
    
    if (piece.type === "KA" && !piece.promoted) {
        return getSlidingAttackSquares(
            board,
            row,
            col,
            [
                { row: -1, col: -1 },
                { row: -1, col: 1 },
                { row: 1, col: -1 },
                { row: 1, col: 1 },
            ]
        );
    }

    if (piece.type === "KY" && !piece.promoted) {
        const direction = piece.player === "sente" ? -1 : 1;

        return getSlidingAttackSquares(
            board,
            row,
            col,
            [
                { row: direction, col: 0 },
            ]
        );
    }

    if (piece.type === "FU" && !piece.promoted) {
        const direction = piece.player === "sente" ? -1 : 1;

        const nextRow = row + direction;

        if (nextRow < 0 || nextRow >= 9) {
            return [];
        }

        return [
            {
                row: nextRow,
                col,
            },
        ];
    }

    if (piece.type === "KE" && !piece.promoted) {
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction * 2, col: col - 1 },
            { row: row + direction * 2, col: col + 1 },
        ];

        return candidates.filter(
            ({ row, col }) =>
                row >= 0 &&
                row < 9 &&
                col >= 0 &&
                col < 9
        );
    }

    if (piece.type === "GI" && !piece.promoted) {
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction, col: col - 1 },
            { row: row + direction, col },
            { row: row + direction, col: col + 1 },
            { row: row - direction, col: col - 1 },
            { row: row - direction, col: col + 1 },
        ];

        return candidates.filter(
            ({ row, col }) =>
                row >= 0 &&
                row < 9 &&
                col >= 0 &&
                col < 9
        );
    }

    if (piece.type === "KI" && !piece.promoted) {
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction, col: col - 1 },
            { row: row + direction, col },
            { row: row + direction, col: col + 1 },
            { row, col: col - 1 },
            { row, col: col + 1 },
            { row: row - direction, col },
        ];

        return candidates.filter(
            ({ row, col }) =>
                row >= 0 &&
                row < 9 &&
                col >= 0 &&
                col < 9
        );
    }

    if (piece.type === "OU") {
        const directions = [
            { row: -1, col: -1 },
            { row: -1, col: 0 },
            { row: -1, col: 1 },
            { row: 0, col: -1 },
            { row: 0, col: 1 },
            { row: 1, col: -1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 },
        ];

        return directions
            .map((direction) => ({
                row: row + direction.row,
                col: col + direction.col,
            }))
            .filter(
                ({ row, col }) =>
                    row >= 0 &&
                    row < 9 &&
                    col >= 0 &&
                    col < 9
            );
    }

    if (piece.type === "KA" && piece.promoted) {
        const attackSquares = getSlidingAttackSquares(
            board,
            row,
            col,
            [
                { row: -1, col: -1 },
                { row: -1, col: 1 },
                { row: 1, col: -1 },
                { row: 1, col: 1 },
            ]
        );

        const candidates = [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 },
        ];

        return [
            ...attackSquares,
            ...candidates.filter(
                ({ row, col }) =>
                    row >= 0 &&
                    row < 9 &&
                    col >= 0 &&
                    col < 9
            ),
        ];
    }

    if (piece.type === "HI" && piece.promoted) {
        const attackSquares = getSlidingAttackSquares(
            board,
            row,
            col,
            [
                { row: -1, col: 0 },
                { row: 1, col: 0 },
                { row: 0, col: -1 },
                { row: 0, col: 1 },
            ]
        );

        const candidates = [
            { row: row - 1, col: col - 1 },
            { row: row - 1, col: col + 1 },
            { row: row + 1, col: col - 1 },
            { row: row + 1, col: col + 1 },
        ];

        return [
            ...attackSquares,
            ...candidates.filter(
                ({ row, col }) =>
                    row >= 0 &&
                    row < 9 &&
                    col >= 0 &&
                    col < 9
            ),
        ];
    }

    if (
        piece.promoted &&
        (
            piece.type === "FU" ||
            piece.type === "KY" ||
            piece.type === "KE" ||
            piece.type === "GI"
        )
    ) {
        return getGoldAttackSquares(
            board,
            row,
            col,
            piece.player
        );
    }

    return [];
}

function getGoldAttackSquares(
    board: Board,
    row: number,
    col: number,
    player: Player
): Square[] {
    const direction = player === "sente" ? -1 : 1;

    const candidates = [
        { row: row + direction, col: col - 1 },
        { row: row + direction, col },
        { row: row + direction, col: col + 1 },
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row - direction, col },
    ];

    return candidates.filter(
        ({ row, col }) =>
            row >= 0 &&
            row < 9 &&
            col >= 0 &&
            col < 9
    );
}

// export const applyMove = (board: Board, hands: Hands, move: Move): {
//     board: Board;
//     hands: Hands;
// } => {
//     const nextBoard = board.map((row) =>
//         row.map((piece) =>
//             piece ? { ...piece } : null
//         )
//     );

//     const nextHands: Hands = {
//         sente: { ...hands.sente },
//         gote: { ...hands.gote },
//     };

//     if (move.from) {
//         const piece = nextBoard[move.from.row][move.from.col];

//         nextBoard[move.from.row][move.from.col] = null;

//         if (piece) {
//                 // ===== 駒を取った場合 =====
//                 if (
//                     move.capturedPieceType 
//                 ) {
//                     nextHands[move.player][move.capturedPieceType] += 1;
//                 }


//             if (move.promote) {
//                 piece.promoted = true;
//             }

//             nextBoard[move.to.row][move.to.col] = piece;
//         }
//     }

//     // ===== 持ち駒を打つ =====
//     if (move.piece) {
//         nextBoard[move.to.row][move.to.col] = createPiece(move.piece, move.player);

//         nextHands[move.player][
//             move.piece as CapturedPieceType
//         ] -= 1;
//     }

//     return {
//         board: nextBoard,
//         hands: nextHands,
//     };
// };