// ============================================================================
// 駒
// ============================================================================

// 駒の種類
export type PieceType =
    | "FU"
    | "KY"
    | "KE"
    | "GI"
    | "KI"
    | "KA"
    | "HI"
    | "OU";

// 先後
export type Player = "sente" | "gote";

// 盤上の駒
export type Piece = {
    id: number;
    type: PieceType;
    player: Player;
    promoted: boolean;
};


// ============================================================================
// 盤面・持ち駒
// ============================================================================

// 盤面
export type Board = (Piece | null)[][];

// 持ち駒にできる駒の種類
export type CapturedPieceType = Exclude<PieceType, "OU">;

// 1種類の持ち駒の枚数
export type CapturedPieces = {
    [key in CapturedPieceType]: number;
};

// 先手・後手の持ち駒
export type Hands = {
    sente: CapturedPieces;
    gote: CapturedPieces;
};


// ============================================================================
// 指し手
// ============================================================================

// 旧Move型（不要なら削除候補）
export type Move_before = {
    player: Player;
    from: { row: number; col: number;} | null;
    to: { row: number; col: number; };
    pieceType: PieceType;
    promoted: boolean;
    capturedPieceType: PieceType | null;
};

// 指し手
export type Move = {
    type: "move";
    player: Player;
    from: {
        row: number;
        col: number;
    } | null;
    to: {
        row: number;
        col: number;
    };
    promote: boolean;
    piece?: PieceType;
    capturedPieceType?: CapturedPieceType;
};

export type Settings = {
    boardBackground: "default" | "ink";
    muteSound: boolean;
};


















