import type { PieceType } from "@/types/shogi";

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

export const promotedPieceNames: Partial<Record<PieceType, string>> = {
    FU: "と",
    KY: "杏",
    KE: "圭",
    GI: "全",
    KA: "馬",
    HI: "龍",
};