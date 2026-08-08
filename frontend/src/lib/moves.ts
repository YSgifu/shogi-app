import type { Board } from "@/types/shogi";

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
        const direction = piece.player === "sente" ? -1 : 1;

        const candidates = [
            { row: row + direction, col: col - 1 },
            { row: row + direction, col },
            { row: row + direction, col: col + 1 },
            { row, col: col - 1 },
            { row, col: col + 1 },
            { row: row - direction, col },
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

    // 角
    if (piece.type === "KA") {
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
                    // 相手の駒なら、そのマスまで
                    if (targetPiece.player !== piece.player) {
                        movableSquares.push({
                            row: nextRow,
                            col: nextCol,
                        });
                    }

                    // 駒があったら、その先には進めない
                    break;
                }

                nextRow += direction.row;
                nextCol += direction.col;
            }
        }

        return movableSquares;
    }

    // 飛車
    if (piece.type === "HI") {
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
                    // 相手の駒なら、そのマスまで
                    if (targetPiece.player !== piece.player) {
                        movableSquares.push({
                            row: nextRow,
                            col: nextCol,
                        });
                    }

                    // 駒があったら、その先には進めない
                    break;
                }

                nextRow += direction.row;
                nextCol += direction.col;
            }
        }

        return movableSquares;
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