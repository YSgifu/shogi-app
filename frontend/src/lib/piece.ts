import type { Piece, PieceType, Player } from "@/types/shogi";

// ============================================================================
// 駒の表示名
// ============================================================================

// 通常の駒の表示名
export const pieceNames: Record<PieceType, string> = {
    FU: "歩",
    KY: "香",
    KE: "桂",
    GI: "銀",
    KI: "金",
    KA: "角",
    HI: "飛",
    OU: "王",
};

// 成り駒の表示名
export const promotedPieceNames: Partial<Record<PieceType, string>> = {
    FU: "と",
    KY: "杏",
    KE: "圭",
    GI: "全",
    KA: "馬",
    HI: "龍",
};


// ============================================================================
// 駒の生成
// ============================================================================

// 駒ID生成用カウンタ
let nextPieceId = Date.now();

// 駒を生成
export const createPiece = (
    type: PieceType,
    player: Player
): Piece => ({
    id: nextPieceId++,
    type,
    player,
    promoted: false,
});







