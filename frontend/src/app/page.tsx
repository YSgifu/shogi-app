"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
    const router = useRouter();

    const [roomId, setRoomId] = useState("");
    const [createdRoomId, setCreatedRoomId] =
        useState<string | null>(null);

    async function createRoom() {
        const response = await fetch(
            "https://backend.asahi-dev.workers.dev/api/rooms",
            {
                method: "POST",
            }
        );

        const data = await response.json();

        setCreatedRoomId(data.roomId);
    }

    function joinRoom() {
        if (!roomId) return;

        router.push(`/room/${roomId.toUpperCase()}`);
    }

    return (
        <main className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>将棋</h1>

                <button
                    className={styles.soloButton}
                    onClick={() => router.push("/solo")}
                >
                    ひとりで遊ぶ
                </button>

                <div className={styles.divider}>
                    <span>オンライン対戦</span>
                </div>

                <section className={styles.section}>
                    <h2>ルームを作る</h2>

                    <button
                        className={styles.primaryButton}
                        onClick={createRoom}
                    >
                        ルームを作成
                    </button>

                    {createdRoomId && (
                        <div className={styles.createdRoom}>
                            <p className={styles.roomLabel}>
                                ルームID
                            </p>

                            <div className={styles.roomId}>
                                {createdRoomId}
                            </div>

                            <p className={styles.hint}>
                                このIDを対戦相手に共有してください
                            </p>

                            <button
                                className={styles.secondaryButton}
                                onClick={() =>
                                    router.push(
                                        `/room/${createdRoomId}`
                                    )
                                }
                            >
                                対局画面へ
                            </button>
                        </div>
                    )}
                </section>

                <section className={styles.section}>
                    <h2>ルームに参加する</h2>

                    <div className={styles.joinForm}>
                        <input
                            className={styles.input}
                            value={roomId}
                            onChange={(e) =>
                                setRoomId(e.target.value)
                            }
                            placeholder="ルームIDを入力"
                            maxLength={6}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    joinRoom();
                                }
                            }}
                        />

                        <button
                            className={styles.joinButton}
                            onClick={joinRoom}
                            disabled={!roomId}
                        >
                            入室
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}